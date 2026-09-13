import type { TypingSummary } from './typing/types';
export const categories = ['Memory', 'Logic', 'Math', 'Language', 'Spatial', 'Focus', 'Strategy', 'Speed', 'Patterns', 'Typing'] as const;
export type Category = typeof categories[number];
export const difficulties = ['Beginner', 'Easy', 'Normal', 'Challenging', 'Hard', 'Expert', 'Master', 'Grandmaster'] as const;
export interface GameDefinition { slug: string; name: string; category: Category; description: string; duration: number; icon: string; accent: string; tutorial: string[]; }
export interface GameAction { type: string; index?: number; value?: string | number; }
export interface GameResult { typing?: TypingSummary; id: string; slug: string; seed: string; generatorVersion: number; difficulty: number; score: number; accuracy: number; mistakes: number; moves: number; duration: number; xp: number; completedAt: string; verified: boolean; context?: { mode: 'practice' | 'daily' | 'workout' | 'campaign'; level?: number; world?: string; date?: string; }; }
export interface GameMetrics { correct: number; total: number; moves: number; mistakes: number; }
export interface PlayerSettings { theme: 'dark' | 'light' | 'midnight' | 'ocean' | 'forest' | 'cosmic' | 'minimal'; sound: boolean; volume: number; reducedMotion: boolean; highContrast: boolean; largeText: boolean; colorBlind: boolean; privacy: 'private' | 'friends' | 'public'; }
