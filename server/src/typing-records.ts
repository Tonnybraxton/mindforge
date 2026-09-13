import type { TypingConfig } from '../../shared/typing/types';
export interface RaceParticipant { userId: string; username: string; avatar: string; sessionId: string; progress: number; provisional: boolean; completedAt: string | null; adjustedWpm: number; accuracy: number; rank: number | null; }
export interface TypingRaceRecord { id: string; hostId: string; status: 'waiting' | 'racing' | 'finished'; config: TypingConfig; text: string; createdAt: string; startedAt: string | null; participants: RaceParticipant[]; }
