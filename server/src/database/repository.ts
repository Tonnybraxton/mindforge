import type { TypingConfig, TypingGoal } from '../../../shared/typing/types';
import type { TypingRaceRecord } from '../typing-records';
import type { GameResult, PlayerSettings } from '../../../shared/contracts';

export const defaultSettings: PlayerSettings = {
  theme: 'dark', sound: true, volume: 0.5, reducedMotion: false,
  highContrast: false, largeText: false, colorBlind: false, privacy: 'private',
};

export interface ProfileRecord {
  avatar: string; level: number; xp: number; coins: number; rank: string;
  brainScore: number; totalGames: number; totalPlayTime: number;
}
export interface UserRecord {
  id: string; email: string; username: string; passwordHash: string;
  createdAt: string; role: string; profile: ProfileRecord; settings: PlayerSettings;
}
export interface RefreshRecord { hash: string; userId: string; family: string; expiresAt: Date; revoked: boolean }
export interface SessionRecord { typingConfig?: TypingConfig;
  id: string; userId: string; slug: string; seed: string; difficulty: number;
  startedAt: Date; completed: boolean; generatorVersion: number; context: GameResult['context'];
}
export interface FriendRecord { id: string; requesterId: string; recipientId: string; status: 'pending' | 'accepted'; createdAt: string }
export interface LeaderboardRow { userId: string; username: string; avatar: string; score: number; games: number }
export interface Repository {
  kind: 'memory' | 'postgres';
  getTypingGoal(userId:string):Promise<TypingGoal | null>;
  setTypingGoal(userId:string, goal:TypingGoal):Promise<void>;
  createTypingRace(race:TypingRaceRecord):Promise<void>;
  getTypingRace(id:string):Promise<TypingRaceRecord | null>;
  changeTypingRace(id:string, change:(race:TypingRaceRecord)=>TypingRaceRecord):Promise<TypingRaceRecord>;
  typingRankings(since:Date|null, visibleTo?:string):Promise<{userId:string;username:string;result:GameResult}[]>;
  ping(): Promise<void>;
  getUser(id: string): Promise<UserRecord | null>;
  findUser(email: string): Promise<UserRecord | null>;
  findUsername(username: string): Promise<UserRecord | null>;
  createUser(input: { email: string; username: string; passwordHash: string }): Promise<UserRecord>;
  updateUser(id: string, input: { username?: string; avatar?: string; settings?: Partial<PlayerSettings> }): Promise<UserRecord>;
  deleteUser(id: string): Promise<void>;
  saveRefresh(record: RefreshRecord): Promise<void>;
  rotateRefresh(hash: string, next: RefreshRecord, now: Date): Promise<boolean>;
  getRefresh(hash: string): Promise<RefreshRecord | null>;
  revokeRefresh(hash: string): Promise<void>;
  revokeFamily(family: string): Promise<void>;
  createSession(session: SessionRecord): Promise<void>;
  getSession(id: string): Promise<SessionRecord | null>;
  activeSessionCount(userId: string, since: Date): Promise<number>;
  completeSession(session: SessionRecord, result: GameResult): Promise<boolean>;
  history(userId: string): Promise<GameResult[]>;
  leaderboard(since: Date | null, slug?: string, visibleTo?: string): Promise<LeaderboardRow[]>;
  friends(userId: string): Promise<FriendRecord[]>;
  requestFriend(requesterId: string, recipientId: string): Promise<FriendRecord>;
  acceptFriend(id: string, userId: string): Promise<FriendRecord | null>;
}

export function publicUser(user: UserRecord) {
  return { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt, profile: user.profile, settings: user.settings };
}
