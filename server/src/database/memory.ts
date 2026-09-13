import type { TypingGoal } from '../../../shared/typing/types';
import type { TypingRaceRecord } from '../typing-records';
import { randomUUID } from 'node:crypto';
import type { GameResult, PlayerSettings } from '../../../shared/contracts';
import { playerLevel, playerRank } from '../../../shared/progression';
import { ApiError } from '../shared/errors';
import { defaultSettings, type FriendRecord, type RefreshRecord, type Repository, type SessionRecord, type UserRecord } from './repository';

/** Explicit development/test storage; never select this adapter in production. */
export class MemoryRepository implements Repository {
  kind = 'memory' as const;
  private typingGoals = new Map<string, TypingGoal>();
  private typingRaces = new Map<string, TypingRaceRecord>();
  async getTypingGoal(userId:string) { return structuredClone(this.typingGoals.get(userId) ?? null); }
  async setTypingGoal(userId:string, goal:TypingGoal) { this.typingGoals.set(userId, structuredClone(goal)); }
  async createTypingRace(race:TypingRaceRecord) { this.typingRaces.set(race.id, structuredClone(race)); }
  async getTypingRace(id:string) { return structuredClone(this.typingRaces.get(id) ?? null); }
  async changeTypingRace(id:string, change:(race:TypingRaceRecord)=>TypingRaceRecord) { const race=this.typingRaces.get(id); if(!race) throw new ApiError(404,'RACE_MISSING','Race not found.'); const next=change(structuredClone(race)); this.typingRaces.set(id,structuredClone(next)); return structuredClone(next); }
  async typingRankings(since: Date | null, visibleTo?: string) {
    const accepted = [...this.friendships.values()].filter(f => f.status === 'accepted' && (f.requesterId === visibleTo || f.recipientId === visibleTo));
    return [...this.results.values()].filter(r => r.typing && r.verified && (!since || new Date(r.completedAt) >= since)).flatMap(result => {
      const user = this.users.get(this.sessions.get(result.id)!.userId);
      if (!user) return [];
      const friend = accepted.some(f => f.requesterId === user.id || f.recipientId === user.id);
      const visible = visibleTo ? user.id === visibleTo || friend && user.settings.privacy !== 'private' : user.settings.privacy === 'public';
      return visible ? [{ userId: user.id, username: user.username, result: structuredClone(result) }] : [];
    });
  }

  private users = new Map<string, UserRecord>();
  private refresh = new Map<string, RefreshRecord>();
  private sessions = new Map<string, SessionRecord>();
  private results = new Map<string, GameResult>();
  private friendships = new Map<string, FriendRecord>();
  async ping() { /* In-process storage is ready. */ }
  async getUser(id: string) { return structuredClone(this.users.get(id) ?? null); }
  async findUser(email: string) { return structuredClone([...this.users.values()].find(u => u.email === email) ?? null); }
  async findUsername(username: string) { return structuredClone([...this.users.values()].find(u => u.username === username) ?? null); }
  async createUser(input: { email: string; username: string; passwordHash: string }) {
    if ([...this.users.values()].some(u => u.email === input.email || u.username === input.username)) throw new ApiError(409, 'ACCOUNT_EXISTS', 'An account with those details already exists.');
    const user: UserRecord = { email: input.email, username: input.username, passwordHash: input.passwordHash, id: randomUUID(), createdAt: new Date().toISOString(), role: 'user', settings: { ...defaultSettings }, profile: { avatar: 'spark', level: 1, xp: 0, coins: 0, rank: playerRank(1), brainScore: 0, totalGames: 0, totalPlayTime: 0 } };
    this.users.set(user.id, user); return structuredClone(user);
  }
  async updateUser(id: string, input: { username?: string; avatar?: string; settings?: Partial<PlayerSettings> }) {
    const user = this.users.get(id)!;
    if (input.username && [...this.users.values()].some(u => u.username === input.username && u.id !== id)) throw new ApiError(409, 'USERNAME_TAKEN', 'That username is already taken.');
    if (input.username) user.username = input.username;
    if (input.avatar) user.profile.avatar = input.avatar;
    Object.assign(user.settings, input.settings); return structuredClone(user);
  }
  async deleteUser(id: string) {
    this.users.delete(id); this.typingGoals.delete(id);
    for (const [key,race] of this.typingRaces) { if(race.hostId===id) this.typingRaces.delete(key); else race.participants=race.participants.filter(p=>p.userId!==id); }
    for (const [key, value] of this.refresh) if (value.userId === id) this.refresh.delete(key);
    for (const [key, value] of this.sessions) if (value.userId === id) { this.sessions.delete(key); this.results.delete(key); }
    for (const [key, value] of this.friendships) if (value.requesterId === id || value.recipientId === id) this.friendships.delete(key);
  }
  async saveRefresh(record: RefreshRecord) { this.refresh.set(record.hash, structuredClone(record)); }
  async getRefresh(hash: string) { return structuredClone(this.refresh.get(hash) ?? null); }
  async rotateRefresh(hash: string, next: RefreshRecord, now: Date) {
    const previous = this.refresh.get(hash);
    if (!previous || previous.revoked || previous.expiresAt <= now) return false;
    previous.revoked = true; this.refresh.set(next.hash, structuredClone(next)); return true;
  }
  async revokeRefresh(hash: string) { const token = this.refresh.get(hash); if (token) token.revoked = true; }
  async revokeFamily(family: string) { for (const token of this.refresh.values()) if (token.family === family) token.revoked = true; }
  async createSession(session: SessionRecord) { this.sessions.set(session.id, structuredClone(session)); }
  async getSession(id: string) { return structuredClone(this.sessions.get(id) ?? null); }
  async activeSessionCount(userId: string, since: Date) { return [...this.sessions.values()].filter(s => s.userId === userId && s.startedAt >= since && !s.completed).length; }
  async completeSession(session: SessionRecord, result: GameResult) {
    const existing = this.sessions.get(session.id);
    if (!existing || existing.completed) return false;
    if (result.typing && [...this.results.values()].some(r => this.sessions.get(r.id)?.userId === session.userId && r.seed === session.seed && r.completedAt.slice(0, 10) === result.completedAt.slice(0, 10))) { result.xp = 0; result.typing.xp = 0; }
    if (session.context?.mode === 'daily' && [...this.results.values()].some(r => this.sessions.get(r.id)?.userId === session.userId && r.context?.mode === 'daily' && r.context.date === session.context?.date)) throw new ApiError(409, 'DAILY_ALREADY_COMPLETED', 'Today’s ranked challenge is already complete. Practice games are still available.');
    existing.completed = true; this.results.set(session.id, structuredClone(result));
    const profile = this.users.get(session.userId)!.profile;
    profile.xp += result.xp; profile.coins += Math.floor(result.xp / 10); profile.level = playerLevel(profile.xp).level;
    profile.totalGames += 1; profile.totalPlayTime += result.duration;
    profile.brainScore = Math.round((profile.brainScore * (profile.totalGames - 1) + result.accuracy * 10) / profile.totalGames);
    profile.rank = playerRank(profile.level);
    return true;
  }
  async history(userId: string) { return structuredClone([...this.results.values()].filter(r => this.sessions.get(r.id)?.userId === userId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))); }
  async leaderboard(since: Date | null, slug?: string, visibleTo?: string) {
    const rows = new Map<string, { userId: string; username: string; avatar: string; score: number; games: number }>();
    const accepted = [...this.friendships.values()].filter(f => f.status === 'accepted' && (f.requesterId === visibleTo || f.recipientId === visibleTo));
    for (const result of this.results.values()) {
      if (!result.verified) continue;
      if ((since && new Date(result.completedAt) < since) || (slug && result.slug !== slug)) continue;
      const user = this.users.get(this.sessions.get(result.id)!.userId)!;
      const friend = accepted.some(f => f.requesterId === user.id || f.recipientId === user.id);
      if (visibleTo ? !(user.id === visibleTo || (friend && user.settings.privacy !== 'private')) : user.settings.privacy !== 'public') continue;
      const row = rows.get(user.id) ?? { userId: user.id, username: user.username, avatar: user.profile.avatar, score: 0, games: 0 };
      row.score = Math.max(row.score, result.score); row.games += 1; rows.set(user.id, row);
    }
    return [...rows.values()].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username)).slice(0, 100);
  }
  async friends(userId: string) { return structuredClone([...this.friendships.values()].filter(f => f.requesterId === userId || f.recipientId === userId)); }
  async requestFriend(requesterId: string, recipientId: string) {
    const existing = [...this.friendships.values()].find(f => (f.requesterId === requesterId && f.recipientId === recipientId) || (f.requesterId === recipientId && f.recipientId === requesterId));
    if (existing) throw new ApiError(409, 'FRIENDSHIP_EXISTS', 'A friendship or request already exists.');
    const record: FriendRecord = { id: randomUUID(), requesterId, recipientId, status: 'pending', createdAt: new Date().toISOString() };
    this.friendships.set(record.id, record); return structuredClone(record);
  }
  async acceptFriend(id: string, userId: string) {
    const record = this.friendships.get(id);
    if (!record || record.recipientId !== userId || record.status !== 'pending') return null;
    record.status = 'accepted'; return structuredClone(record);
  }
}
