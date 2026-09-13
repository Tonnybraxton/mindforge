import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app';
import { MemoryRepository } from '../../server/src/database/memory';
import type { TypingConfig, TypingEvent } from '../../shared/typing/types';

function fixture() {
  const clock = new Date('2026-09-12T12:00:00Z'), repository = new MemoryRepository();
  const app = createApp({ repository, accessSecret: 'typing-tests-only-secret-with-at-least-32-characters', appOrigin: 'http://localhost:5173', passwordRounds: 4, now: () => new Date(clock) });
  const advance = (seconds: number) => clock.setTime(clock.getTime() + seconds * 1000);
  const register = async (username = 'typing_one') => { const res = await request(app).post('/api/auth/register').send({ email: `${username}@example.com`, username, password: 'correct horse battery staple' }).expect(201); return { token: res.body.data.accessToken as string, id: res.body.data.user.id as string }; };
  const post = (token: string, url: string, body: object = {}) => request(app).post(`/api/typing${url}`).auth(token, { type: 'bearer' }).send(body);
  const get = (token: string, url: string) => request(app).get(`/api/typing${url}`).auth(token, { type: 'bearer' });
  const start = async (token: string, config: Partial<TypingConfig> = { lessonId: 'lesson-1' }) => (await post(token, '/session/start', { config }).expect(200)).body.data as { sessionId: string; text: string; config: TypingConfig };
  const keys = (text: string, interval = 300): TypingEvent[] => Array.from(text, (value, i) => ({ type: 'input', value, at: (i + 1) * interval }));
  return { app, repository, clock, advance, register, post, get, start, keys };
}
describe('typing academy account API', () => {
  it('exposes catalog and challenge publicly but protects personal telemetry', async () => {
    const { app } = fixture();
    expect((await request(app).get('/api/typing/lessons').expect(200)).body.data).toHaveLength(26);
    expect((await request(app).get('/api/typing/campaign').expect(200)).body.data).toHaveLength(10);
    expect((await request(app).get('/api/typing/challenge/daily').expect(200)).body.data.config.seed).toBe('typing-daily:v1:2026-09-12');
    for (const endpoint of ['/stats', '/stats/keys', '/stats/weaknesses', '/dashboard', '/personal-bests', '/workout/today']) await request(app).get(`/api/typing${endpoint}`).expect(401);
  });
  it('replays a first lesson, awards XP once, and opens the next lesson', async () => {
    const { register, start, post, get, keys, advance, repository } = fixture(); const owner = await register();
    await post(owner.token, '/session/start', { config: { lessonId: 'lesson-2' } }).expect(403);
    const session = await start(owner.token); const input = { sessionId: session.sessionId, events: keys(session.text), duration: 8 }; advance(8);
    const saved = (await post(owner.token, '/session/complete', input).expect(200)).body.data;
    expect(saved.verified).toBe(true); expect(saved.xp).toBeGreaterThan(0); expect(saved.typing).toMatchObject({ passed: true, accuracy: 100 });
    await post(owner.token, '/session/complete', input).expect(200);
    expect(await repository.history(owner.id)).toHaveLength(1);
    await start(owner.token, { lessonId: 'lesson-2' });
    expect((await get(owner.token, '/stats/keys').expect(200)).body.data.length).toBe(3);
    expect((await get(owner.token, '/personal-bests').expect(200)).body.data).toHaveLength(1);
  });
  it('does not give duplicate seed XP or let another player submit a session', async () => {
    const { register, start, post, keys, advance } = fixture(); const owner = await register(), other = await register('typing_two');
    const first = await start(owner.token, { lessonId: 'lesson-1', seed: 'same' }); advance(8);
    await post(other.token, '/session/complete', { sessionId: first.sessionId, events: keys(first.text), duration: 8 }).expect(404);
    await post(owner.token, '/session/complete', { sessionId: first.sessionId, events: keys(first.text), duration: 8 }).expect(200);
    const repeat = await start(owner.token, { lessonId: 'lesson-1', seed: 'same' }); advance(8);
    expect((await post(owner.token, '/session/complete', { sessionId: repeat.sessionId, events: keys(repeat.text), duration: 8 }).expect(200)).body.data.xp).toBe(0);
  });
  it('rejects forged configurations, timing, bulk replays, low accuracy, and incomplete ranked runs', async () => {
    const { register, start, post, keys, advance } = fixture(); const owner = await register();
    await post(owner.token, '/session/start', { config: { mode: 'test', xp: 9999 } }).expect(400);
    await post(owner.token, '/session/start', { config: { mode: 'adaptive', ranked: true } }).expect(400);
    const session = await start(owner.token, { mode: 'test', duration: 15, ranked: true });
    const sample = session.text.slice(0, 45);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(sample), duration: 15 }).expect(422);
    advance(15);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(sample, 1), duration: 15 }).expect(422);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys('x'.repeat(45)), duration: 15 }).expect(422);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(sample), duration: 10 }).expect(422);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(sample), duration: 15 }).expect(200);
  });
  it('keeps private scores out of global boards and excludes unranked practice', async () => {
    const { app, register, start, post, keys, advance, repository } = fixture(); const owner = await register();
    const session = await start(owner.token, { mode: 'test', duration: 15, ranked: true }); advance(15);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(session.text.slice(0, 45)), duration: 15 }).expect(200);
    expect((await request(app).get('/api/typing/leaderboards').expect(200)).body.data).toEqual([]);
    await repository.updateUser(owner.id, { settings: { privacy: 'public' } });
    expect((await request(app).get('/api/typing/leaderboards').expect(200)).body.data).toHaveLength(1);
    expect((await request(app).get('/api/typing/leaderboards?mode=60').expect(200)).body.data).toEqual([]);
    await request(app).get('/api/typing/leaderboards?scope=friends').expect(401);
  });
  it('canonicalizes campaign settings, protects unlocks, and persists goals', async () => {
    const { register, start, post, get, keys, advance } = fixture(); const owner = await register();
    await post(owner.token, '/session/start', { config: { region: 'home-row-plains', level: 2 } }).expect(403);
    const session = await start(owner.token, { region: 'home-row-plains', level: 1, seed: 'forged', difficulty: 8 });
    expect(session.config).toMatchObject({ seed: 'typing-campaign:v1:home-row-plains:1', difficulty: 1 }); advance(8);
    await post(owner.token, '/session/complete', { sessionId: session.sessionId, events: keys(session.text), duration: 8 }).expect(200);
    await start(owner.token, { region: 'home-row-plains', level: 2 });
    await post(owner.token, '/goals', { wpm: 80, accuracy: 98, minutes: 20 }).expect(200);
    expect((await get(owner.token, '/workout/today').expect(200)).body.data.map((c: TypingConfig) => c.duration)).toEqual([240, 240, 240, 240, 240]);
    expect((await get(owner.token, '/dashboard').expect(200)).body.data.goal).toMatchObject({ wpm: 80, accuracy: 98, minutes: 20 });
  });
});
describe('real typing race rooms', () => {
  it('requires two players, limits host controls, shares text, hides session IDs, and validates a winner', async () => {
    const { register, post, get, keys, advance } = fixture(); const host = await register(), guest = await register('typing_guest');
    const room = (await post(host.token, '/races').expect(200)).body.data;
    await post(host.token, `/races/${room.id}/start`).expect(409);
    await get(guest.token, `/races/${room.id}`).expect(403);
    const joined = (await post(guest.token, `/races/${room.id}/join`).expect(200)).body.data;
    expect(joined.text).toBe(room.text); expect(joined.participants[0]).not.toHaveProperty('sessionId'); expect(joined.sessionId).not.toBe(room.sessionId);
    await post(guest.token, `/races/${room.id}/start`).expect(409);
    const started = (await post(host.token, `/races/${room.id}/start`).expect(200)).body.data; expect(started.status).toBe('racing');
    await post(guest.token, `/races/${room.id}/progress`, { events: keys(room.text.slice(0, 20)), duration: 6 }).expect(422);
    advance(3 + room.text.length * .3);
    const duration = room.text.length * .3;
    await post(host.token, '/session/complete', { sessionId: room.sessionId, events: keys(room.text), duration }).expect(200);
    const finished = (await get(guest.token, `/races/${room.id}`).expect(200)).body.data;
    expect(finished.participants[0]).toMatchObject({ rank: 1, progress: 100, provisional: false, accuracy: 100 });
    await post(guest.token, '/session/complete', { sessionId: joined.sessionId, events: keys(room.text), duration }).expect(200);
    expect((await get(host.token, `/races/${room.id}`).expect(200)).body.data.status).toBe('finished');
  });
  it('caps rooms at eight and removes account data on deletion', async () => {
    const { register, post, repository } = fixture(); const host = await register(); const room = (await post(host.token, '/races').expect(200)).body.data;
    for (let i = 0; i < 7; i++) { const player = await register(`racer_${i}`); await post(player.token, `/races/${room.id}/join`).expect(200); }
    const ninth = await register('racer_nine'); await post(ninth.token, `/races/${room.id}/join`).expect(409);
    await repository.deleteUser(host.id); expect(await repository.getTypingRace(room.id)).toBeNull();
  });
});
