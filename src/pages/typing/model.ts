import { defaultTypingConfig, type TypingConfig, type TypingGoal, type TypingState } from '../../../shared/typing/types';
import { normalizeTypingConfig } from '../../../shared/typing/engine';
import { campaignTypingConfig, dailyTypingConfig, typingLessons } from '../../../shared/typing/content';
export interface TypingPreferences { font: string; fontSize: number; lineHeight: number; spacing: number; caret: 'line' | 'block' | 'underline'; errorStyle: 'highlight' | 'underline' | 'minimal'; zen: boolean; keyboard: boolean; sound: boolean; volume: number; pacer: boolean; ghost: boolean; }
export const defaultTypingPreferences: TypingPreferences = { font: 'Consolas', fontSize: 24, lineHeight: 1.9, spacing: 0, caret: 'line', errorStyle: 'underline', zen: false, keyboard: true, sound: false, volume: .2, pacer: true, ghost: false };
export interface TypingProfile { goal: TypingGoal; preferences: TypingPreferences; draft?: { id: string; state: TypingState; sessionId?: string }; }
export const defaultTypingProfile: TypingProfile = { goal: { wpm: 60, accuracy: 97, minutes: 10 }, preferences: defaultTypingPreferences };
export function typingUrl(config: Partial<TypingConfig>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(config)) if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  return `/typing/train?${params}`;
}
export function configFromSearch(search: string): TypingConfig {
  const params = new URLSearchParams(search), raw: Record<string, unknown> = { ...defaultTypingConfig, seed: params.get('seed') || crypto.randomUUID() };
  for (const [key, value] of params) {
    if (['difficulty', 'duration', 'wordCount', 'targetWpm', 'level', 'workoutIndex'].includes(key)) raw[key] = Number(value);
    else if (key === 'ranked') raw[key] = value === 'true';
    else if (key === 'focusKeys' || key === 'focusPatterns') raw[key] = value.split(',');
    else raw[key] = value;
  }
  if (params.get('mode') === 'workout') Object.assign(raw, { mode: 'adaptive', workoutIndex: 0, duration: 120, wordCount: 0 });
  if (raw.region) return campaignTypingConfig(String(raw.region), Number(raw.level || 1));
  if (params.get('daily') === 'true') return dailyTypingConfig();
  if (raw.lessonId) { if (!typingLessons.some(l => l.id === raw.lessonId)) throw new Error('This lesson does not exist.'); Object.assign(raw, { mode: 'lesson', duration: 0, wordCount: 0, correction: 'strict', ranked: false }); }
  return normalizeTypingConfig(raw as Partial<TypingConfig>);
}
