import { typingRouter } from './typing';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { GameResult } from '../../shared/contracts';
import { dailyChallenge } from '../../shared/daily';
import { applyAction, createGame, GENERATOR_VERSION } from '../../shared/games/engine';
import { achievementProgress, achievements, calculateReward, campaignLevel, currentStreak, worlds } from '../../shared/progression';
import { games, getGame } from '../../shared/registry';
import { publicUser, type Repository, type RefreshRecord, type UserRecord } from './database/repository';
import { ApiError, requireValue } from './shared/errors';

const REFRESH_COOKIE = 'mindforge_refresh';
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL = 24 * 60 * 60 * 1000;
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const username = z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/, 'Use letters, numbers, and underscores.');
const password = z.string().min(10).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes.');
const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password }).strict();
const settingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'midnight', 'ocean', 'forest', 'cosmic', 'minimal']).optional(),
  sound: z.boolean().optional(), volume: z.number().min(0).max(1).optional(), reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(), largeText: z.boolean().optional(), colorBlind: z.boolean().optional(),
  privacy: z.enum(['private', 'friends', 'public']).optional(),
}).strict();
const contextSchema = z.object({
  mode: z.enum(['practice', 'daily', 'campaign', 'workout']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  world: z.string().max(60).optional(), level: z.number().int().min(1).max(200).optional(),
}).strict();
const startSchema = z.object({ difficulty: z.number().int().min(1).max(8).default(1), seed: z.string().min(1).max(128).optional(), context: contextSchema.optional() }).strict();
const completeSchema = z.object({ sessionId: z.string().uuid(), actions: z.array(z.object({ type: z.string().min(1).max(32), index: z.number().int().min(0).max(10_000).optional(), value: z.union([z.string().max(64), z.number().finite()]).optional() }).strict()).min(1).max(2_000) }).strict();

export interface AppOptions {
  repository: Repository;
  accessSecret: string;
  appOrigin: string;
  production?: boolean;
  now?: () => Date;
  passwordRounds?: number;
}

/** A deterministic clock and repository make security flows testable without PostgreSQL. */
export function createApp(options: AppOptions) {
  const { repository, accessSecret, appOrigin, production = false, now = () => new Date(), passwordRounds = 12 } = options;
  if (accessSecret.length < 32) throw new Error('ACCESS_TOKEN_SECRET must contain at least 32 characters.');
  if (production && repository.kind !== 'postgres') throw new Error('Production requires persistent PostgreSQL storage.');
  if (production && new URL(appOrigin).protocol !== 'https:') throw new Error('Production APP_ORIGIN must use HTTPS.');
  if (production && passwordRounds < 12) throw new Error('Production requires bcrypt cost 12 or higher.');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: appOrigin, credentials: true }));
  app.use('/api/typing', express.json({ limit: '4mb' }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1_000, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' } } }));
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if ((origin && origin !== appOrigin) || req.get('sec-fetch-site') === 'cross-site') return next(new ApiError(403, 'ORIGIN_REJECTED', 'This request must come from the MindForge application.'));
    if (req.headers['content-length'] && Number(req.headers['content-length']) > 0 && !req.is('application/json')) return next(new ApiError(415, 'JSON_REQUIRED', 'Send this request as JSON.'));
    next();
  });
  const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { code: 'AUTH_RATE_LIMITED', message: 'Too many sign-in attempts. Please try again in 15 minutes.' } } });
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict' as const, path: '/api/auth' };
  const success = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
  const clearCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, cookieOptions);
  const refreshMaterial = (userId: string, family: string = randomUUID()) => {
    const token = randomBytes(48).toString('base64url');
    const record: RefreshRecord = { hash: hashToken(token), userId, family, expiresAt: new Date(now().getTime() + REFRESH_TTL), revoked: false };
    return { token, record };
  };
  const sendAccess = (res: Response, user: UserRecord, material: ReturnType<typeof refreshMaterial>, status = 200) => {
    res.cookie(REFRESH_COOKIE, material.token, { ...cookieOptions, maxAge: REFRESH_TTL });
    const accessToken = jwt.sign({ sub: user.id, rid: material.record.hash, type: 'access', iat: Math.floor(now().getTime() / 1000) }, accessSecret, { algorithm: 'HS256', expiresIn: '15m', issuer: 'mindforge', audience: 'mindforge-web' });
    return success(res, { user: publicUser(user), accessToken }, status);
  };
  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const bearer = req.get('authorization');
    if (!bearer?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to access your account.');
    let claims: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(bearer.slice(7), accessSecret, { algorithms: ['HS256'], issuer: 'mindforge', audience: 'mindforge-web', clockTimestamp: Math.floor(now().getTime() / 1000) });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.rid !== 'string' || decoded.type !== 'access') throw new Error('Invalid access token.');
      claims = decoded;
    } catch { throw new ApiError(401, 'INVALID_TOKEN', 'Your sign-in has expired. Please sign in again.'); }
    const record = await repository.getRefresh(claims.rid as string);
    if (!record || record.revoked || record.userId !== claims.sub || record.expiresAt <= now()) throw new ApiError(401, 'SESSION_REVOKED', 'Your sign-in has expired. Please sign in again.');
    const user = requireValue(await repository.getUser(claims.sub!), 401, 'UNAUTHENTICATED', 'Your account is no longer available.');
    res.locals.user = user;
    next();
  };
  const account = (res: Response): UserRecord => res.locals.user as UserRecord;

  app.use('/api/typing', typingRouter(repository, authenticate, now));
  app.get('/api/health', async (_req, res) => { await repository.ping(); success(res, { status: 'ok', database: repository.kind, generatorVersion: GENERATOR_VERSION }); });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = credentials.extend({ username }).parse(req.body);
    const user = await repository.createUser({ email: input.email, username: input.username, passwordHash: await bcrypt.hash(input.password, passwordRounds) });
    const material = refreshMaterial(user.id);
    await repository.saveRefresh(material.record);
    sendAccess(res, user, material, 201);
  });
  // The dummy hash keeps unknown-account and wrong-password comparisons similar in cost.
  const dummyHash = bcrypt.hashSync('dummy-password-never-accepted', passwordRounds);
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await repository.findUser(input.email);
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const material = refreshMaterial(user.id);
    await repository.saveRefresh(material.record);
    sendAccess(res, user, material);
  });
  app.post('/api/auth/refresh', async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (typeof token !== 'string' || token.length > 256) { clearCookie(res); throw new ApiError(401, 'REFRESH_REQUIRED', 'Please sign in to continue.'); }
    const record = await repository.getRefresh(hashToken(token));
    if (!record || record.revoked || record.expiresAt <= now()) {
      if (record) await repository.revokeFamily(record.family);
      clearCookie(res);
      throw new ApiError(401, 'REFRESH_REJECTED', 'Your sign-in has expired. Please sign in again.');
    }
    const user = requireValue(await repository.getUser(record.userId), 401, 'UNAUTHENTICATED', 'Your account is no longer available.');
    const material = refreshMaterial(user.id, record.family);
    if (!await repository.rotateRefresh(record.hash, material.record, now())) {
      await repository.revokeFamily(record.family); clearCookie(res);
      throw new ApiError(401, 'REFRESH_REUSED', 'Your sign-in has expired. Please sign in again.');
    }
    sendAccess(res, user, material);
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (typeof token === 'string' && token.length <= 256) {
      const record = await repository.getRefresh(hashToken(token));
      if (record) await repository.revokeFamily(record.family);
    }
    clearCookie(res); success(res, { loggedOut: true });
  });
  app.get(['/api/auth/me', '/api/users/me'], authenticate, (_req, res) => success(res, publicUser(account(res))));
  app.patch('/api/users/me', authenticate, async (req, res) => {
    const input = z.object({ username: username.optional(), avatar: z.enum(['spark', 'leaf', 'moon', 'sun', 'wave', 'star']).optional(), settings: settingsSchema.optional() }).strict().parse(req.body);
    success(res, publicUser(await repository.updateUser(account(res).id, input)));
  });
  app.patch('/api/users/me/settings', authenticate, async (req, res) => success(res, publicUser(await repository.updateUser(account(res).id, { settings: settingsSchema.parse(req.body) }))));
  app.delete('/api/users/me', authenticate, authLimit, async (req, res) => {
    const input = z.object({ password }).strict().parse(req.body);
    if (!await bcrypt.compare(input.password, account(res).passwordHash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Password is incorrect.');
    await repository.deleteUser(account(res).id);
    clearCookie(res); success(res, { deleted: true });
  });
  const progression = (history: GameResult[]) => ({
    streak: currentStreak(history, now()),
    achievements: achievements.filter(a => achievementProgress(a, history, slug => getGame(slug)?.category) >= a.threshold).map(a => a.id),
    campaign: history.filter(r => r.context?.mode === 'campaign' && (!r.typing || r.typing.passed)).reduce<Record<string, { score: number; stars: number }>>((levels, result) => {
      const key = `${result.context!.world}:${result.context!.level}`;
      const stars = result.accuracy >= 95 ? 3 : result.accuracy >= 70 ? 2 : 1;
      levels[key] = { score: Math.max(levels[key]?.score ?? 0, result.score), stars: Math.max(levels[key]?.stars ?? 0, stars) };
      return levels;
    }, {}),
  });
  app.get('/api/users/me/history', authenticate, async (_req, res) => success(res, await repository.history(account(res).id)));
  app.get('/api/users/me/export', authenticate, async (_req, res) => {
    const user = account(res), history = await repository.history(user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="mindforge-account.json"');
    success(res, { exportedAt: now().toISOString(), account: publicUser(user), history, friendships: await repository.friends(user.id), progression: progression(history) });
  });
  app.get('/api/users/me/stats', authenticate, async (_req, res) => {
    const history = await repository.history(account(res).id);
    success(res, { profile: account(res).profile, ...progression(history) });
  });
  app.get('/api/games', (_req, res) => success(res, games));
  app.get('/api/daily', (_req, res) => success(res, dailyChallenge(now())));
  app.get('/api/campaign', (_req, res) => success(res, worlds.map(world => ({ ...world, available: world.games.every(slug => !!getGame(slug)) }))));
  app.post('/api/games/:slug/start', authenticate, async (req, res) => {
    const slug = String(req.params.slug);
    if (slug === 'typing-academy') throw new ApiError(400, 'TYPING_ROUTE', 'Use the Typing Academy session endpoint.');
    requireValue(getGame(slug), 404, 'GAME_NOT_FOUND', 'This game is not available.');
    const input = startSchema.parse(req.body ?? {}), user = account(res);
    let difficulty = input.difficulty, seed = input.seed ?? randomBytes(24).toString('hex');
    let context: GameResult['context'] = { mode: input.context?.mode ?? 'practice' };
    if (context.mode === 'daily') {
      const daily = dailyChallenge(now());
      if (slug !== daily.slug || (input.context?.date && input.context.date !== daily.date)) throw new ApiError(400, 'DAILY_MISMATCH', 'Start the current daily challenge to record a daily result.');
      if ((await repository.history(user.id)).some(r => r.context?.mode === 'daily' && r.context.date === daily.date)) throw new ApiError(409, 'DAILY_ALREADY_COMPLETED', 'Today’s ranked challenge is already complete. Practice games are still available.');
      difficulty = daily.difficulty; seed = daily.seed; context = { mode: 'daily', date: daily.date };
    } else if (context.mode === 'campaign') {
      const world = worlds.find(w => w.id === input.context?.world), level = input.context?.level;
      if (!world || !level || level > world.levels) throw new ApiError(400, 'CAMPAIGN_INVALID', 'Choose an existing campaign level.');
      const puzzle = campaignLevel(world.id, level);
      if (puzzle.slug !== slug) throw new ApiError(400, 'CAMPAIGN_MISMATCH', 'This game does not match the selected campaign level.');
      if (level > 1 && !(await repository.history(user.id)).some(r => r.context?.mode === 'campaign' && r.context.world === world.id && r.context.level === level - 1)) throw new ApiError(403, 'CAMPAIGN_LOCKED', 'Complete the previous level in this world first.');
      difficulty = puzzle.difficulty; seed = puzzle.seed; context = { mode: 'campaign', world: world.id, level };
    } else if (context.mode === 'workout') {
      context = { mode: 'workout', date: now().toISOString().slice(0, 10) };
    }
    if (await repository.activeSessionCount(user.id, new Date(now().getTime() - SESSION_TTL)) >= 20) throw new ApiError(429, 'SESSION_LIMIT', 'Finish an active puzzle before starting another one.');
    const session = { id: randomUUID(), userId: user.id, slug, seed, difficulty, generatorVersion: GENERATOR_VERSION, startedAt: now(), completed: false, context };
    await repository.createSession(session);
    success(res, { sessionId: session.id, seed, difficulty, generatorVersion: GENERATOR_VERSION, context, startedAt: session.startedAt.toISOString() }, 201);
  });
  app.post('/api/games/:slug/complete', authenticate, async (req, res) => {
    const input = completeSchema.parse(req.body);
    const session = requireValue(await repository.getSession(input.sessionId), 404, 'SESSION_NOT_FOUND', 'This puzzle session was not found.');
    if (session.userId !== account(res).id || session.slug !== req.params.slug) throw new ApiError(404, 'SESSION_NOT_FOUND', 'This puzzle session was not found.');
    if (session.typingConfig) throw new ApiError(400, 'TYPING_ROUTE', 'Use the typing session completion endpoint.');
    if (session.completed) throw new ApiError(409, 'SESSION_COMPLETED', 'This puzzle result has already been recorded.');
    if (session.generatorVersion !== GENERATOR_VERSION) throw new ApiError(409, 'GENERATOR_CHANGED', 'Start a new puzzle with the current game version.');
    const completedAt = now(), elapsed = completedAt.getTime() - session.startedAt.getTime();
    if (elapsed < 1_000 || elapsed > SESSION_TTL) throw new ApiError(422, 'INVALID_DURATION', 'The session duration is invalid or this puzzle session has expired.');
    let state = createGame(session.slug, session.seed, session.difficulty);
    for (const action of input.actions) {
      const next = applyAction(state, action);
      if (state === next) throw new ApiError(422, 'INVALID_REPLAY', 'The recorded puzzle actions are invalid. Start a new puzzle.');
      state = next;
    }
    if (state.status !== 'won') throw new ApiError(422, 'PUZZLE_INCOMPLETE', 'Complete the puzzle successfully before submitting a result.');
    const duration = Math.round(elapsed / 100) / 10;
    const result: GameResult = { id: session.id, slug: session.slug, seed: session.seed, generatorVersion: session.generatorVersion, difficulty: session.difficulty, ...calculateReward(state.metrics, session.difficulty, duration), mistakes: state.metrics.mistakes, moves: state.metrics.moves, duration, completedAt: completedAt.toISOString(), xp: calculateReward(state.metrics, session.difficulty, duration).xp, verified: true, context: session.context };
    if (!await repository.completeSession(session, result)) throw new ApiError(409, 'SESSION_COMPLETED', 'This puzzle result has already been recorded.');
    success(res, result);
  });
  app.get('/api/leaderboards', async (req, res, next) => {
    if (req.query.scope === 'friends') return authenticate(req, res, next);
    next();
  }, async (req, res) => {
    const query = z.object({ period: z.enum(['daily', 'weekly', 'monthly', 'all']).default('weekly'), scope: z.enum(['global', 'friends']).default('global'), slug: z.string().max(60).optional() }).strict().parse(req.query);
    if (query.slug) requireValue(getGame(query.slug), 404, 'GAME_NOT_FOUND', 'This game is not available.');
    const start = new Date(now());
    start.setUTCHours(0, 0, 0, 0);
    if (query.period === 'weekly') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    if (query.period === 'monthly') start.setUTCDate(1);
    success(res, await repository.leaderboard(query.period === 'all' ? null : start, query.slug, query.scope === 'friends' ? account(res).id : undefined));
  });
  app.get('/api/friends', authenticate, async (_req, res) => {
    const user = account(res);
    const records = await repository.friends(user.id);
    const enriched = await Promise.all(records.map(async record => {
      const friend = await repository.getUser(record.requesterId === user.id ? record.recipientId : record.requesterId);
      return { ...record, username: friend?.username ?? 'Deleted account', avatar: friend?.profile.avatar ?? 'spark' };
    }));
    success(res, enriched);
  });
  app.post('/api/friends', authenticate, async (req, res) => {
    const input = z.object({ username }).strict().parse(req.body), user = account(res);
    const recipient = requireValue(await repository.findUsername(input.username), 404, 'PLAYER_NOT_FOUND', 'No player with that username was found.');
    if (recipient.id === user.id) throw new ApiError(400, 'SELF_FRIEND', 'Choose another player to send a friend request.');
    if ((await repository.friends(user.id)).length >= 100) throw new ApiError(409, 'FRIEND_LIMIT', 'You have reached the limit of 100 friends and pending requests.');
    success(res, await repository.requestFriend(user.id, recipient.id), 201);
  });
  app.post('/api/friends/:id/accept', authenticate, async (req, res) => success(res, requireValue(await repository.acceptFriend(String(req.params.id), account(res).id), 404, 'REQUEST_NOT_FOUND', 'This pending friend request was not found.')));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'This API route was not found.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) { res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Check the request fields.' } }); return; }
    if (error instanceof ApiError) { res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } }); return; }
    const detail = error as { code?: string; type?: string; status?: number };
    if (detail?.code === 'P2002') { res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'An account, friendship, or result with those details already exists.' } }); return; }
    if (detail?.type === 'entity.parse.failed' || detail?.type === 'entity.too.large') { res.status(detail.status ?? 400).json({ success: false, error: { code: 'INVALID_BODY', message: 'Send a valid JSON request smaller than 256 KB.' } }); return; }
    // Log only the error category: request data may include passwords or tokens.
    console.error('MindForge API error', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The account service could not complete this request. Please try again.' } });
  });
  return app;
}
