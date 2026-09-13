export const typingModes = ['test', 'lesson', 'words', 'sentences', 'paragraphs', 'numbers', 'symbols', 'punctuation', 'adaptive', 'code', 'terminal', 'numpad', 'data-entry', 'transcription', 'spelling', 'memory', 'flash', 'reaction', 'falling', 'defense', 'space', 'adventure', 'completion', 'puzzle'] as const;
export type TypingMode = typeof typingModes[number];
export type CorrectionMode = 'strict' | 'free' | 'no-backspace' | 'perfect';
export interface TypingConfig {
  mode: TypingMode; seed: string; difficulty: number; duration: number; wordCount: number;
  correction: CorrectionMode; ranked: boolean; targetWpm: number;
  lessonId?: string; language?: string; topic?: string; indentation?: '2' | '4' | 'tab';
  focusKeys?: string[]; focusPatterns?: string[]; region?: string; level?: number;
  date?: string; workoutIndex?: number; raceId?: string;
}
export interface TypingEvent { type: 'input' | 'backspace'; value?: string; at: number; }
export interface KeyStat { key: string; attempts: number; correct: number; incorrect: number; totalLatency: number; samples: number; }
export interface TypingMetrics {
  rawWpm: number; adjustedWpm: number; cleanWpm: number; cpm: number; accuracy: number; errorRate: number;
  correctCharacters: number; incorrectCharacters: number; correctedErrors: number; uncorrectedErrors: number;
  charactersTyped: number; consistency: number; rhythm: number; reactionTime: number; duration: number;
  longestCleanStreak: number; burst5: number; burst10: number; progress: number;
}
export interface TypingSummary extends TypingMetrics {
  config: TypingConfig; passed: boolean; keyStats: Record<string, KeyStat>;
  bigrams: Record<string, KeyStat>; trigrams: Record<string, KeyStat>;
  timeline: { at: number; index: number }[]; score: number; xp: number;
}
export interface TypingState {
  config: TypingConfig; text: string; typed: string; events: TypingEvent[];
  status: 'ready' | 'playing' | 'complete'; elapsed: number;
}
export interface TypingLesson { id: string; name: string; description: string; keys: string; stage: string; order: number; minAccuracy: number; }
export interface TypingRegion { id: string; name: string; description: string; levels: number; mode: TypingMode; accent: string; }
export interface TypingGoal { wpm: number; accuracy: number; minutes: number; }
export const defaultTypingConfig: TypingConfig = { mode: 'test', seed: 'practice', difficulty: 1, duration: 60, wordCount: 0, correction: 'free', ranked: false, targetWpm: 40, language: 'JavaScript', indentation: '2' };
