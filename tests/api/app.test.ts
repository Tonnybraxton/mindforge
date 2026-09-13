import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request, { type Response } from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { GameAction } from '../../shared/contracts';
import { dailyChallenge } from '../../shared/daily';
import { createGame, type MemoryState } from '../../shared/games/engine';
import { campaignLevel } from '../../shared/progression';
import { puzzleGames as games } from '../../shared/registry';
import { createApp } from '../../server/src/app';
import { MemoryRepository } from '../../server/src/database/memory';
import { winningActions } from '../helpers/game-solutions';

const secret = 'test-only-secret-with-at-least-thirty-two-characters';
const origin = 'http://localhost:5173';
const password = 'correct horse battery staple';
const refreshHash = (cookie: string) => createHash('sha256').update(cookie.split('=')[1]).digest('hex');
function cookieOf(response: Response) {
  const value = response.headers['set-cookie'];
  expect(value).toBeDefined();
  return (Array.isArray(value) ? value[0] : value as string).split(';')[0];
}

function fixture() {
  const clock = new Date('2026-09-11T12:00:00Z');
  while (dailyChallenge(clock).slug !== 'memory-cards') clock.setUTCDate(clock.getUTCDate() + 1);
  const repository = new MemoryRepository();
  const app = createApp({ repository, accessSecret: secret, appOrigin: origin, passwordRounds: 4, now: () => new Date(clock) });
  const advance = (milliseconds = 3_000) => clock.setTime(clock.getTime() + milliseconds);
  const register = async (username = 'player_one') => {
    const response = await request(app).post('/api/auth/register').send({ email: `${username}@example.com`, username, password }).expect(201);
    return { token: response.body.data.accessToken as string, userId: response.body.data.user.id as string, cookie: cookieOf(response), response };
  };
  const start = async (token: string, context?: Record<string, unknown>, seed = 'api-test') => {
    const response = await request(app).post('/api/games/memory-cards/start').auth(token, { type: 'bearer' }).send({ difficulty: 1, seed, context }).expect(201);
    return response.body.data as { sessionId: string; seed: string; difficulty: number; context: Record<string, unknown> };
  };
  const complete = (token: string, session: { sessionId: string; seed: string; difficulty: number }, actions = memorySolution(session.seed, session.difficulty)) =>
    request(app).post('/api/games/memory-cards/complete').auth(token, { type: 'bearer' }).send({ sessionId: session.sessionId, actions });
  const win = async (token: string) => { const session = await start(token); advance(); return complete(token, session).expect(200); };
  return { app, repository, clock, advance, register, start, complete, win };
}

function memorySolution(seed: string, difficulty: number, withMistake = false): GameAction[] {
  const state = createGame('memory-cards', seed, difficulty) as MemoryState;
  const actions: GameAction[] = [];
  if (withMistake) actions.push({ type: 'flip', index: 0 }, { type: 'flip', index: state.deck.findIndex(value => value !== state.deck[0]) }, { type: 'hide' });
  for (const symbol of new Set(state.deck)) {
    state.deck.forEach((value, index) => { if (value === symbol) actions.push({ type: 'flip', index }); });
  }
  return actions;
}

describe('account authentication and credential isolation', () => {
  it('normalizes email, persists only a bcrypt hash, and returns a scoped HttpOnly refresh cookie', async () => {
    const { app, repository } = fixture();
    const createUser = vi.spyOn(repository, 'createUser');
    const response = await request(app).post('/api/auth/register').send({ email: ' Player@EXAMPLE.com ', username: 'Player', password }).expect(201);
    expect(createUser).toHaveBeenCalledWith({ email: 'player@example.com', username: 'Player', passwordHash: expect.stringMatching(/^\$2[aby]\$/) });
    const stored = await repository.getUser(response.body.data.user.id);
    expect(stored).not.toHaveProperty('password');
    expect(await bcrypt.compare(password, stored!.passwordHash)).toBe(true);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.user).not.toHaveProperty('role');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/auth');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(await repository.getRefresh(refreshHash(cookieOf(response)))).toMatchObject({ userId: stored!.id, revoked: false });
    await request(app).post('/api/auth/login').send({ email: 'PLAYER@example.com', password }).expect(200);
  });

  it('rejects duplicate identities, weak/overlong passwords, and privileged registration fields', async () => {
    const { app, register } = fixture();
    await register();
    await request(app).post('/api/auth/register').send({ email: 'PLAYER_ONE@example.com', username: 'other', password }).expect(409);
    await request(app).post('/api/auth/register').send({ email: 'other@example.com', username: 'player_one', password }).expect(409);
    for (const invalid of ['short', '😀'.repeat(20)]) await request(app).post('/api/auth/register').send({ email: 'other@example.com', username: 'other', password: invalid }).expect(400);
    await request(app).post('/api/auth/register').send({ email: 'other@example.com', username: 'other', password, role: 'admin' }).expect(400);
  });

  it('uses the same public error for unknown accounts and wrong passwords', async () => {
    const { app, register } = fixture();
    await register();
    const unknown = await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password }).expect(401);
    const wrong = await request(app).post('/api/auth/login').send({ email: 'player_one@example.com', password: 'incorrect-password' }).expect(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it('rotates refresh tokens and revokes the descendant family when a spent token is replayed', async () => {
    const { app, repository, register } = fixture();
    const player = await register();
    const otherLogin = await request(app).post('/api/auth/login').send({ email: 'player_one@example.com', password }).expect(200);
    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', player.cookie).expect(200);
    const nextCookie = cookieOf(refreshed);
    expect(nextCookie).not.toBe(player.cookie);
    expect(await repository.getRefresh(refreshHash(player.cookie))).toMatchObject({ revoked: true });
    await request(app).get('/api/auth/me').auth(player.token, { type: 'bearer' }).expect(401);
    await request(app).get('/api/auth/me').auth(refreshed.body.data.accessToken, { type: 'bearer' }).expect(200);
    await request(app).post('/api/auth/refresh').set('Cookie', player.cookie).expect(401);
    await request(app).get('/api/auth/me').auth(refreshed.body.data.accessToken, { type: 'bearer' }).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', nextCookie).expect(401);
    await request(app).get('/api/auth/me').auth(otherLogin.body.data.accessToken, { type: 'bearer' }).expect(200);
  });

  it('allows one concurrent refresh and invalidates the surviving token after detecting reuse', async () => {
    const { app, register } = fixture();
    const player = await register();
    const responses = await Promise.all([request(app).post('/api/auth/refresh').set('Cookie', player.cookie), request(app).post('/api/auth/refresh').set('Cookie', player.cookie)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 401]);
    const winner = responses.find(response => response.status === 200)!;
    await request(app).get('/api/auth/me').auth(winner.body.data.accessToken, { type: 'bearer' }).expect(401);
  });

  it('revokes access on logout and rejects expired, tampered, and cross-account tokens', async () => {
    const { app, clock, advance, register } = fixture();
    const player = await register();
    const other = await register('player_two');
    const forged = jwt.sign({ sub: other.userId, rid: refreshHash(player.cookie), type: 'access', iat: Math.floor(clock.getTime() / 1000) }, secret, { algorithm: 'HS256', expiresIn: '15m', issuer: 'mindforge', audience: 'mindforge-web' });
    await request(app).get('/api/auth/me').auth(forged, { type: 'bearer' }).expect(401);
    await request(app).get('/api/auth/me').auth(`${player.token}tampered`, { type: 'bearer' }).expect(401);
    const logout = await request(app).post('/api/auth/logout').set('Cookie', player.cookie).expect(200);
    expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    await request(app).get('/api/auth/me').auth(player.token, { type: 'bearer' }).expect(401);
    advance(16 * 60_000);
    await request(app).get('/api/auth/me').auth(other.token, { type: 'bearer' }).expect(401);
    advance(31 * 86_400_000);
    await request(app).post('/api/auth/refresh').set('Cookie', other.cookie).expect(401);
  });

  it('requires authentication and rejects cross-origin writes and non-JSON request bodies', async () => {
    const { app, register } = fixture();
    const player = await register();
    await request(app).get('/api/users/me/history').expect(401);
    await request(app).get('/api/leaderboards?scope=friends').expect(401);
    await request(app).patch('/api/users/me/settings').auth(player.token, { type: 'bearer' }).set('Origin', 'https://attacker.example').send({ privacy: 'public' }).expect(403);
    await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site').expect(403);
    await request(app).post('/api/auth/login').type('form').send({ email: 'player_one@example.com', password }).expect(415);
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{invalid').expect(400);
  });

  it('lets a player update settings without modifying identity, balances, or another account', async () => {
    const { app, repository, register } = fixture();
    const player = await register();
    const other = await register('player_two');
    const response = await request(app).patch('/api/users/me').auth(player.token, { type: 'bearer' }).send({ username: 'renamed', avatar: 'leaf', settings: { privacy: 'friends', volume: 0.2 } }).expect(200);
    expect(response.body.data).toMatchObject({ username: 'renamed', profile: { avatar: 'leaf', xp: 0 }, settings: { privacy: 'friends', volume: 0.2, theme: 'dark' } });
    for (const payload of [{ id: other.userId }, { profile: { xp: 999999 } }, { role: 'admin' }, { email: 'hijack@example.com' }]) await request(app).patch('/api/users/me').auth(player.token, { type: 'bearer' }).send(payload).expect(400);
    await request(app).patch('/api/users/me/settings').auth(player.token, { type: 'bearer' }).send({ privacy: 'everybody' }).expect(400);
    expect(await repository.getUser(other.userId)).toMatchObject({ username: 'player_two', settings: { privacy: 'private' } });
  });
});

describe('authoritative game sessions and rewards', () => {
  it.each(games.map(game => game.slug))('records a legal %s replay with rewards calculated by the server', async slug => {
    const { app, advance, register } = fixture();
    const player = await register();
    const started = await request(app).post(`/api/games/${slug}/start`).auth(player.token, { type: 'bearer' }).send({ difficulty: 3, seed: `api:${slug}` }).expect(201);
    const session = started.body.data;
    const actions = winningActions(createGame(slug, session.seed, session.difficulty));
    advance(30_000);
    const response = await request(app).post(`/api/games/${slug}/complete`).auth(player.token, { type: 'bearer' }).send({ sessionId: session.sessionId, actions }).expect(200);
    expect(response.body.data).toMatchObject({ slug, verified: true, difficulty: 3, accuracy: 100, duration: 30, xp: 60 });
  });

  it('replays a legal win and credits history and XP exactly once under concurrent submissions', async () => {
    const { app, repository, advance, register, start, complete } = fixture();
    const player = await register();
    const session = await start(player.token);
    advance();
    const responses = await Promise.all([complete(player.token, session), complete(player.token, session)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const result = responses.find(response => response.status === 200)!.body.data;
    expect(result).toMatchObject({ id: session.sessionId, verified: true, accuracy: 100, mistakes: 0, duration: 3, xp: 40 });
    const history = await request(app).get('/api/users/me/history').auth(player.token, { type: 'bearer' }).expect(200);
    expect(history.body.data).toEqual([result]);
    expect((await repository.getUser(player.userId))!.profile).toMatchObject({ xp: result.xp, totalGames: 1, coins: 4, totalPlayTime: 3 });
  });

  it('rejects unfinished, illegal, post-win, and client-scored replays without awarding XP', async () => {
    const { app, repository, advance, register, start, complete } = fixture();
    const player = await register();
    const session = await start(player.token);
    advance();
    const incomplete = await complete(player.token, session, [{ type: 'flip', index: 0 }]).expect(422);
    expect(incomplete.body.error.code).toBe('PUZZLE_INCOMPLETE');
    for (const actions of [[{ type: 'flip', index: 999 }], [{ type: 'win' }], [...memorySolution(session.seed, session.difficulty), { type: 'flip', index: 0 }]]) {
      const response = await complete(player.token, session, actions).expect(422);
      expect(response.body.error.code).toBe('INVALID_REPLAY');
    }
    await request(app).post('/api/games/memory-cards/complete').auth(player.token, { type: 'bearer' }).send({ sessionId: session.sessionId, actions: memorySolution(session.seed, session.difficulty), score: 100000, verified: true }).expect(400);
    expect(await repository.history(player.userId)).toEqual([]);
    expect((await repository.getUser(player.userId))!.profile.xp).toBe(0);
    await complete(player.token, session).expect(200);
  });

  it('conceals other players’ sessions and keeps their histories separate', async () => {
    const { app, advance, register, start, complete } = fixture();
    const player = await register();
    const other = await register('player_two');
    const session = await start(player.token);
    advance();
    const foreign = await complete(other.token, session).expect(404);
    const missing = await complete(other.token, { ...session, sessionId: randomUUID() }).expect(404);
    expect(foreign.body).toEqual(missing.body);
    await request(app).post('/api/games/sudoku/complete').auth(player.token, { type: 'bearer' }).send({ sessionId: session.sessionId, actions: [{ type: 'flip', index: 0 }] }).expect(404);
    await complete(player.token, session).expect(200);
    const otherHistory = await request(app).get('/api/users/me/history').auth(other.token, { type: 'bearer' }).expect(200);
    expect(otherHistory.body.data).toEqual([]);
  });

  it('requires a plausible server duration and refuses expired or incompatible sessions', async () => {
    const { repository, clock, advance, register, start, complete } = fixture();
    const player = await register();
    const session = await start(player.token);
    expect((await complete(player.token, session).expect(422)).body.error.code).toBe('INVALID_DURATION');
    const record = (await repository.getSession(session.sessionId))!;
    await repository.createSession({ ...record, startedAt: new Date(clock.getTime() - 86_400_001) });
    expect((await complete(player.token, session).expect(422)).body.error.code).toBe('INVALID_DURATION');
    advance();
    await repository.createSession({ ...record, generatorVersion: 0 });
    expect((await complete(player.token, session).expect(409)).body.error.code).toBe('GENERATOR_CHANGED');
  });

  it('does not expose a guest import or arbitrary reward endpoint and limits outstanding sessions', async () => {
    const { app, register, start } = fixture();
    const player = await register();
    await request(app).post('/api/users/me/history').auth(player.token, { type: 'bearer' }).send({ xp: 5000 }).expect(404);
    await request(app).post('/api/games/missing/start').auth(player.token, { type: 'bearer' }).send({}).expect(404);
    await request(app).post('/api/games/memory-cards/start').auth(player.token, { type: 'bearer' }).send({ difficulty: 99 }).expect(400);
    for (let index = 0; index < 20; index++) await start(player.token);
    const limited = await request(app).post('/api/games/memory-cards/start').auth(player.token, { type: 'bearer' }).send({}).expect(429);
    expect(limited.body.error.code).toBe('SESSION_LIMIT');
  });

  it('uses the current canonical daily puzzle and allows only one daily reward across sessions', async () => {
    const { app, repository, clock, advance, register, start, complete } = fixture();
    const player = await register();
    const daily = dailyChallenge(clock);
    const first = await start(player.token, { mode: 'daily', date: daily.date }, 'client-choice');
    const second = await start(player.token, { mode: 'daily' });
    expect(first).toMatchObject({ seed: daily.seed, difficulty: daily.difficulty, context: { mode: 'daily', date: daily.date } });
    advance();
    const results = await Promise.all([complete(player.token, first), complete(player.token, second)]);
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
    expect(await repository.history(player.userId)).toHaveLength(1);
    await request(app).post('/api/games/memory-cards/start').auth(player.token, { type: 'bearer' }).send({ context: { mode: 'daily' } }).expect(409);
    await request(app).post('/api/games/memory-cards/start').auth(player.token, { type: 'bearer' }).send({ context: { mode: 'daily', date: '2000-01-01' } }).expect(400);
    await request(app).post('/api/games/sudoku/start').auth(player.token, { type: 'bearer' }).send({ context: { mode: 'daily' } }).expect(400);
  });

  it('locks campaign successors, uses canonical seeds, and keeps the best stars and score across replays', async () => {
    const { app, advance, register, start, complete } = fixture();
    const player = await register();
    const level2 = campaignLevel('memory-valley', 2);
    const next = () => request(app).post(`/api/games/${level2.slug}/start`).auth(player.token, { type: 'bearer' }).send({ context: { mode: 'campaign', world: 'memory-valley', level: 2 } });
    await next().expect(403);
    const context = { mode: 'campaign', world: 'memory-valley', level: 1 };
    const first = await start(player.token, context);
    expect(first.seed).toBe(campaignLevel('memory-valley', 1).seed);
    advance();
    await complete(player.token, first, memorySolution(first.seed, first.difficulty, true)).expect(200);
    await next().expect(201);
    const improved = await start(player.token, context);
    advance();
    const result = await complete(player.token, improved).expect(200);
    const stats = await request(app).get('/api/users/me/stats').auth(player.token, { type: 'bearer' }).expect(200);
    expect(stats.body.data.campaign['memory-valley:1']).toEqual({ score: result.body.data.score, stars: 3 });
    expect(stats.body.data.achievements).toContain('first-steps');
  });
});

describe('social visibility and account privacy', () => {
  it('shows only public global scores and accepted, consenting friends in friend leaderboards', async () => {
    const { app, register, win } = fixture();
    const a = await register('private_player'), b = await register('friend_player'), c = await register('public_player');
    for (const player of [a, b, c]) await win(player.token);
    const settings = (token: string, privacy: string) => request(app).patch('/api/users/me/settings').auth(token, { type: 'bearer' }).send({ privacy });
    await settings(b.token, 'friends').expect(200);
    await settings(c.token, 'public').expect(200);
    const global = await request(app).get('/api/leaderboards?period=all').expect(200);
    expect(global.body.data.map((row: { userId: string }) => row.userId)).toEqual([c.userId]);
    expect(global.body.data[0]).not.toHaveProperty('email');
    const invited = await request(app).post('/api/friends').auth(b.token, { type: 'bearer' }).send({ username: 'private_player' }).expect(201);
    const friendId = invited.body.data.id as string;
    const friendBoard = async (token: string) => (await request(app).get('/api/leaderboards?scope=friends&period=all').auth(token, { type: 'bearer' }).expect(200)).body.data.map((row: { userId: string }) => row.userId);
    expect(await friendBoard(a.token)).toEqual([a.userId]);
    for (const player of [b, c]) await request(app).post(`/api/friends/${friendId}/accept`).auth(player.token, { type: 'bearer' }).expect(404);
    await request(app).post(`/api/friends/${friendId}/accept`).auth(a.token, { type: 'bearer' }).expect(200);
    expect(new Set(await friendBoard(a.token))).toEqual(new Set([a.userId, b.userId]));
    expect(await friendBoard(b.token)).toEqual([b.userId]);
    await settings(a.token, 'friends').expect(200);
    expect(new Set(await friendBoard(b.token))).toEqual(new Set([a.userId, b.userId]));
    await settings(b.token, 'private').expect(200);
    expect(await friendBoard(a.token)).toEqual([a.userId]);
    await request(app).post('/api/friends').auth(a.token, { type: 'bearer' }).send({ username: 'friend_player' }).expect(409);
    await request(app).post('/api/friends').auth(a.token, { type: 'bearer' }).send({ username: 'private_player' }).expect(400);
  });

  it('exports only the requesting account and deletes credentials, results, sessions, and friendships', async () => {
    const { app, repository, register, win } = fixture();
    const player = await register();
    const other = await register('player_two');
    const result = await win(player.token);
    await win(other.token);
    await request(app).post('/api/friends').auth(player.token, { type: 'bearer' }).send({ username: 'player_two' }).expect(201);
    const exported = await request(app).get('/api/users/me/export').auth(player.token, { type: 'bearer' }).expect(200);
    expect(exported.body.data.history).toHaveLength(1);
    expect(exported.body.data.history[0].id).toBe(result.body.data.id);
    expect(exported.body.data.account.id).toBe(player.userId);
    expect(JSON.stringify(exported.body)).not.toContain('passwordHash');
    expect(JSON.stringify(exported.body)).not.toContain('player_two@example.com');
    await request(app).delete('/api/users/me').auth(player.token, { type: 'bearer' }).send({ password: 'incorrect-password' }).expect(401);
    expect(await repository.getUser(player.userId)).not.toBeNull();
    await request(app).delete('/api/users/me').auth(player.token, { type: 'bearer' }).send({ password }).expect(200);
    expect(await repository.getUser(player.userId)).toBeNull();
    expect(await repository.getRefresh(refreshHash(player.cookie))).toBeNull();
    expect(await repository.getSession(result.body.data.id)).toBeNull();
    expect(await repository.history(player.userId)).toEqual([]);
    expect(await repository.friends(other.userId)).toEqual([]);
    expect(await repository.history(other.userId)).toHaveLength(1);
    await request(app).get('/api/users/me').auth(player.token, { type: 'bearer' }).expect(401);
    await request(app).post('/api/auth/refresh').set('Cookie', player.cookie).expect(401);
    await request(app).get('/api/users/me').auth(other.token, { type: 'bearer' }).expect(200);
  });

  it('refuses insecure production configuration', () => {
    const repository = new MemoryRepository();
    expect(() => createApp({ repository, accessSecret: 'short', appOrigin: origin })).toThrow('at least 32');
    expect(() => createApp({ repository, accessSecret: secret, appOrigin: 'https://mindforge.example', production: true })).toThrow('persistent PostgreSQL');
  });
});
