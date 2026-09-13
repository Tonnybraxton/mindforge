import { randomUUID } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { GameResult } from '../../shared/contracts';
import { summarizeTyping } from '../../shared/typing/analytics';
import { campaignTypingConfig, dailyTypingConfig, generateTypingText, typingLessons, typingRegions, typingWorkout } from '../../shared/typing/content';
import { normalizeTypingConfig, replayTyping, validateTypingReplay } from '../../shared/typing/engine';
import { defaultTypingConfig, typingModes, type TypingConfig } from '../../shared/typing/types';
import type { Repository, SessionRecord, UserRecord } from './database/repository';
import type { TypingRaceRecord } from './typing-records';
import { ApiError, requireValue } from './shared/errors';

const configSchema = z.object({ mode: z.enum(typingModes).optional(), seed: z.string().max(128).optional(), difficulty: z.number().int().min(1).max(8).optional(), duration: z.number().int().min(0).max(1800).optional(), wordCount: z.number().int().min(0).max(1000).optional(), correction: z.enum(['strict', 'free', 'no-backspace', 'perfect']).optional(), ranked: z.boolean().optional(), targetWpm: z.number().min(10).max(250).optional(), lessonId: z.string().max(40).optional(), language: z.string().max(32).optional(), indentation: z.enum(['2', '4', 'tab']).optional(), focusKeys: z.array(z.string().max(1)).max(20).optional(), focusPatterns: z.array(z.string().max(4)).max(20).optional(), region: z.string().max(60).optional(), level: z.number().int().min(1).max(100).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), workoutIndex: z.number().int().min(0).max(4).optional(), raceId: z.string().uuid().optional() }).strict();
const eventsSchema = z.array(z.object({ type: z.enum(['input', 'backspace']), value: z.string().length(1).optional(), at: z.number().finite().min(0).max(1900000) }).strict()).min(1).max(50000);
const completeSchema = z.object({ sessionId: z.string().uuid(), events: eventsSchema, duration: z.number().finite().min(1).max(1900) }).strict();
const goalSchema = z.object({ wpm: z.number().int().min(10).max(250), accuracy: z.number().int().min(80).max(100), minutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]) }).strict();
export function typingRouter(repository: Repository, authenticate: RequestHandler, now: () => Date) {
  const router = Router();
  const user = (res: { locals: Record<string, unknown> }) => res.locals.user as UserRecord;
  const today = () => now().toISOString().slice(0, 10);
  const success = (res: Parameters<RequestHandler>[1], data: unknown) => res.json({ success: true, data });
  const history = async (id: string) => (await repository.history(id)).filter(r => r.typing);
  router.get('/lessons', (_req, res) => success(res, typingLessons));
  router.get('/lessons/:id', (req, res) => success(res, requireValue(typingLessons.find(l => l.id === req.params.id), 404, 'LESSON_MISSING', 'Lesson not found.')));
  router.get('/campaign', (_req, res) => success(res, typingRegions));
  router.get('/challenge/daily', (_req, res) => { const config = dailyTypingConfig(today()); success(res, { config, text: generateTypingText(config) }); });
  router.get('/leaderboards', async (req, res, next) => { if (req.query.scope === 'friends') return authenticate(req, res, next); next(); }, async (req, res) => {
    const query = z.object({ period: z.enum(['daily', 'weekly', 'all']).default('weekly'), scope: z.enum(['global', 'friends']).default('global'), metric: z.enum(['wpm', 'accuracy', 'score']).default('wpm'), mode: z.enum(['all', 'code', '60', '300', 'daily']).default('all') }).parse(req.query);
    const start = now(); start.setUTCHours(0, 0, 0, 0); if (query.period === 'weekly') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    const rows = await repository.typingRankings(query.period === 'all' ? null : start, query.scope === 'friends' ? user(res).id : undefined);
    const eligible = rows.filter(r => r.result.verified && r.result.typing?.config.ranked && r.result.typing.passed && r.result.accuracy >= 95 && r.result.duration >= 15 && (query.mode === 'all' || query.mode === 'code' && r.result.typing.config.mode === 'code' || query.mode === 'daily' && r.result.typing.config.seed === dailyTypingConfig(today()).seed || Number(query.mode) === r.result.typing.config.duration));
    const value = (r: typeof eligible[number]) => query.metric === 'accuracy' ? r.result.accuracy : query.metric === 'score' ? r.result.score : r.result.typing!.adjustedWpm;
    eligible.sort((a, b) => value(b) - value(a) || b.result.accuracy - a.result.accuracy);
    const seen = new Set<string>(); success(res, eligible.filter(row => !seen.has(row.userId) && !!seen.add(row.userId)).slice(0, 100).map(row => ({ userId: row.userId, username: row.username, wpm: row.result.typing!.adjustedWpm, accuracy: row.result.accuracy, score: row.result.score, duration: row.result.duration })));
  });
  router.use(authenticate);
  router.get(['/dashboard', '/stats'], async (_req, res) => success(res, { ...summarizeTyping(await history(user(res).id), now()), goal: await repository.getTypingGoal(user(res).id) }));
  router.get('/stats/keys', async (_req, res) => success(res, summarizeTyping(await history(user(res).id), now()).keys));
  router.get('/stats/weaknesses', async (_req, res) => { const data = summarizeTyping(await history(user(res).id), now()); success(res, { keys: data.weakKeys, fingers: data.weakFingers, bigrams: data.bigrams, trigrams: data.trigrams, coaching: data.coaching }); });
  router.get('/personal-bests', async (_req, res) => success(res, summarizeTyping(await history(user(res).id), now()).bests));
  router.post('/goals', async (req, res) => { const goal = goalSchema.parse(req.body); await repository.setTypingGoal(user(res).id, goal); success(res, goal); });
  router.get('/workout/today', async (_req, res) => success(res, typingWorkout(await history(user(res).id), (await repository.getTypingGoal(user(res).id))?.minutes ?? 10, today())));
  router.post('/workout/generate', async (req, res) => { const { minutes } = z.object({ minutes: z.number().int().min(5).max(30) }).parse(req.body); success(res, typingWorkout(await history(user(res).id), minutes, today())); });
  async function canonicalConfig(input: Partial<TypingConfig>, userId: string) {
    let config = normalizeTypingConfig({ ...input, seed: input.seed || randomUUID() });
    const rows = await history(userId);
    if (config.raceId) throw new ApiError(400, 'RACE_REQUIRED', 'Join a race room to start a race session.');
    if (config.region) {
      config = campaignTypingConfig(config.region, config.level ?? 1);
      if (config.level! > 1 && !rows.some(r => r.typing!.passed && r.typing!.config.region === config.region && r.typing!.config.level === config.level! - 1)) throw new ApiError(403, 'TYPING_LOCKED', 'Complete the previous campaign level first.');
    } else if (config.lessonId) {
      const lesson = requireValue(typingLessons.find(l => l.id === config.lessonId), 400, 'LESSON_MISSING', 'Choose an available lesson.');
      if (lesson.order > 1 && !rows.some(r => r.typing!.passed && r.accuracy >= 90 && r.typing!.config.lessonId === `lesson-${lesson.order - 1}`)) throw new ApiError(403, 'LESSON_LOCKED', 'Complete the previous lesson at 90% accuracy.');
      config = { ...config, mode: 'lesson', duration: 0, wordCount: 0, ranked: false, correction: 'strict' };
    } else if (config.date && config.workoutIndex === undefined) {
      if (config.date !== today()) throw new ApiError(400, 'DAILY_EXPIRED', 'Choose today’s typing challenge.');
      config = dailyTypingConfig(today());
    } else if (config.workoutIndex !== undefined) {
      config = typingWorkout(rows, (await repository.getTypingGoal(userId))?.minutes ?? 10, today())[config.workoutIndex];
    }
    if (config.ranked && (!['test', 'words', 'sentences', 'paragraphs', 'code', 'numbers', 'symbols', 'punctuation'].includes(config.mode) || config.focusKeys?.length || config.focusPatterns?.length)) throw new ApiError(400, 'RANKED_MODE', 'Choose a standard text test for ranked play.');
    return config;
  }
  const contextFor = (config: TypingConfig): GameResult['context'] => config.region ? { mode: 'campaign', world: `typing:${config.region}`, level: config.level } : config.workoutIndex !== undefined ? { mode: 'workout', date: config.date } : { mode: 'practice', date: config.date };
  router.post('/session/start', async (req, res) => {
    const { config: input } = z.object({ config: configSchema }).strict().parse(req.body);
    const owner = user(res), config = await canonicalConfig(input, owner.id);
    if (await repository.activeSessionCount(owner.id, new Date(now().getTime() - 3600000)) >= 30) throw new ApiError(429, 'SESSION_LIMIT', 'Finish an active session before starting another.');
    const session: SessionRecord = { id: randomUUID(), userId: owner.id, slug: 'typing-academy', seed: config.seed, difficulty: config.difficulty, generatorVersion: 1, startedAt: now(), completed: false, context: contextFor(config), typingConfig: config };
    await repository.createSession(session); success(res, { sessionId: session.id, config, text: generateTypingText(config), startedAt: session.startedAt.toISOString() });
  });
  router.post(['/session/complete', '/challenge/submit'], async (req, res) => {
    const input = completeSchema.parse(req.body), owner = user(res);
    const session = requireValue(await repository.getSession(input.sessionId), 404, 'SESSION_MISSING', 'Typing session not found.');
    if (session.userId !== owner.id || !session.typingConfig) throw new ApiError(404, 'SESSION_MISSING', 'Typing session not found.');
    if (session.completed) { const existing = (await history(owner.id)).find(r => r.id === session.id); return success(res, existing); }
    const config = session.typingConfig;
    let summary;
    try { summary = validateTypingReplay(config, generateTypingText(config), input.events, input.duration, (now().getTime() - session.startedAt.getTime()) / 1000); }
    catch (error) { throw new ApiError(422, 'TYPING_REPLAY_REJECTED', error instanceof Error ? error.message : 'Invalid replay.'); }
    // Repeating the identical exercise on the same day keeps statistics but grants no extra XP.
    const previous = await history(owner.id);
    if (previous.some(r => r.seed === config.seed && r.completedAt.slice(0, 10) === today())) summary.xp = 0;
    const result: GameResult = { id: session.id, slug: 'typing-academy', seed: config.seed, generatorVersion: 1, difficulty: config.difficulty, score: summary.score, xp: summary.xp, accuracy: summary.accuracy, mistakes: summary.incorrectCharacters, moves: summary.charactersTyped, duration: summary.duration, completedAt: now().toISOString(), verified: true, context: session.context, typing: summary };
    if (!await repository.completeSession(session, result)) throw new ApiError(409, 'ALREADY_SAVED', 'This result is already saved.');
    if (config.raceId) await repository.changeTypingRace(config.raceId, race => {
      const participant = race.participants.find(p => p.userId === owner.id);
      if (participant) Object.assign(participant, { progress: 100, provisional: false, completedAt: result.completedAt, adjustedWpm: summary.adjustedWpm, accuracy: summary.accuracy });
      const finished = race.participants.filter(p => p.completedAt).sort((a, b) => b.adjustedWpm * b.accuracy / 100 - a.adjustedWpm * a.accuracy / 100);
      finished.forEach((p, index) => { p.rank = index + 1; });
      if (finished.length === race.participants.length) race.status = 'finished';
      return race;
    });
    success(res, result);
  });
  const raceFor = async (id: string, userId: string) => { const race = requireValue(await repository.getTypingRace(id), 404, 'RACE_MISSING', 'Race not found.'); if (!race.participants.some(p => p.userId === userId)) throw new ApiError(403, 'RACE_PRIVATE', 'Join this room to view its race.'); if (now().getTime() - Date.parse(race.createdAt) > 3600000) throw new ApiError(410, 'RACE_EXPIRED', 'This room expired. Create a fresh race.'); return race; };
  const raceView = (race: TypingRaceRecord, userId: string) => ({ ...race, sessionId: race.participants.find(p => p.userId === userId)?.sessionId, participants: race.participants.map(({ sessionId, ...p }) => ({ ...p, ...(p.userId === userId ? { sessionId } : {}) })) });
  router.post('/races', async (_req, res) => {
    const owner = user(res), id = randomUUID(), config: TypingConfig = { ...defaultTypingConfig, mode: 'words', duration: 0, wordCount: 50, difficulty: 3, seed: `typing-race:v1:${id}`, ranked: true, raceId: id };
    const race: TypingRaceRecord = { id, hostId: owner.id, status: 'waiting', config, text: generateTypingText(config), createdAt: now().toISOString(), startedAt: null, participants: [{ userId: owner.id, username: owner.username, avatar: owner.profile.avatar, sessionId: randomUUID(), progress: 0, provisional: true, completedAt: null, adjustedWpm: 0, accuracy: 0, rank: null }] };
    await repository.createTypingRace(race); success(res, raceView(race, owner.id));
  });
  router.post('/races/:id/join', async (req, res) => {
    const owner = user(res);
    const race = await repository.changeTypingRace(String(req.params.id), row => {
      if (now().getTime() - Date.parse(row.createdAt) > 3600000) throw new ApiError(410, 'RACE_EXPIRED', 'This room expired.');
      if (row.participants.some(p => p.userId === owner.id)) return row;
      if (row.status !== 'waiting' || row.participants.length >= 8) throw new ApiError(409, 'RACE_FULL', 'The room has started or is full.');
      row.participants.push({ userId: owner.id, username: owner.username, avatar: owner.profile.avatar, sessionId: randomUUID(), progress: 0, provisional: true, completedAt: null, adjustedWpm: 0, accuracy: 0, rank: null }); return row;
    }); success(res, raceView(race, owner.id));
  });
  router.get('/races/:id', async (req, res) => success(res, raceView(await raceFor(String(req.params.id), user(res).id), user(res).id)));
  router.post('/races/:id/start', async (req, res) => {
    const owner = user(res), id = String(req.params.id); await raceFor(id, owner.id);
    const race = await repository.changeTypingRace(id, row => { if (row.hostId !== owner.id || row.status !== 'waiting' || row.participants.length < 2) throw new ApiError(409, 'RACE_NOT_READY', 'The host can start once at least two players join.'); row.status = 'racing'; row.startedAt = new Date(now().getTime() + 3000).toISOString(); return row; });
    for (const participant of race.participants) await repository.createSession({ id: participant.sessionId, userId: participant.userId, slug: 'typing-academy', seed: race.config.seed, difficulty: race.config.difficulty, generatorVersion: 1, startedAt: new Date(race.startedAt!), completed: false, context: { mode: 'practice' }, typingConfig: race.config });
    success(res, raceView(race, owner.id));
  });
  router.post('/races/:id/progress', async (req, res) => {
    const input = z.object({ events: eventsSchema, duration: z.number().finite().min(0).max(1800) }).strict().parse(req.body);
    const owner = user(res), id = String(req.params.id), current = await raceFor(id, owner.id), wall = (now().getTime() - Date.parse(current.startedAt ?? '')) / 1000;
    if (current.status !== 'racing' || !Number.isFinite(wall) || wall < 0 || input.duration > wall + 2 || input.events.some(e => e.at > (wall + 2) * 1000)) throw new ApiError(422, 'INVALID_RACE_TIME', 'Race timing is invalid.');
    let summary; try { summary = replayTyping(current.config, current.text, input.events, Math.max(1, input.duration)); } catch { throw new ApiError(422, 'INVALID_PREFIX', 'Race input is invalid.'); }
    if (summary.rawWpm > 250) throw new ApiError(422, 'INVALID_SPEED', 'Progress timing is implausible.');
    const race = await repository.changeTypingRace(id, row => { const p = row.participants.find(p => p.userId === owner.id)!; if (!p.completedAt) { p.progress = summary.accuracy >= 80 ? summary.progress : 0; p.adjustedWpm = summary.adjustedWpm; p.accuracy = summary.accuracy; } return row; });
    success(res, raceView(race, owner.id));
  });
  return router;
}
