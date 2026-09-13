import type { GameResult } from '../contracts';
import { baseKeyFor, fingerForKey, typingLessons } from './content';
import type { KeyStat } from './types';

export interface MasteryRow extends KeyStat { accuracy: number; averageLatency: number; mastery: number; finger: string; lastPracticed: string; }
export function typingRank(wpm: number) { return wpm < 20 ? 'Keyboard Explorer' : wpm < 30 ? 'Starter Typist' : wpm < 40 ? 'Developing Typist' : wpm < 50 ? 'Skilled Typist' : wpm < 60 ? 'Fast Typist' : wpm < 80 ? 'Advanced Typist' : wpm < 100 ? 'Expert Typist' : wpm < 120 ? 'Master Typist' : 'Typing Grandmaster'; }
export function summarizeTyping(results: GameResult[], now = new Date()) {
  const history = results.filter(r => r.typing).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const average = (rows: GameResult[], metric: 'adjustedWpm' | 'accuracy' | 'consistency' | 'rhythm' | 'reactionTime') => rows.length ? Math.round(rows.reduce((s, r) => s + r.typing![metric], 0) / rows.length * 10) / 10 : 0;
  const aggregate = (field: 'keyStats' | 'bigrams' | 'trigrams') => {
    const data: Record<string, MasteryRow> = {};
    for (const result of history) for (const stat of Object.values(result.typing![field])) {
      const key = field === 'keyStats' ? baseKeyFor(stat.key) : stat.key;
      const row = data[key] ??= { ...stat, key, attempts: 0, correct: 0, incorrect: 0, totalLatency: 0, samples: 0, accuracy: 0, averageLatency: 0, mastery: 0, finger: fingerForKey(key.at(-1) || ''), lastPracticed: '' };
      row.attempts += stat.attempts; row.correct += stat.correct; row.incorrect += stat.incorrect; row.totalLatency += stat.totalLatency; row.samples += stat.samples; row.lastPracticed = result.completedAt;
    }
    return Object.values(data).map(row => ({ ...row, accuracy: Math.round(row.correct / Math.max(1, row.attempts) * 100), averageLatency: Math.round(row.totalLatency / Math.max(1, row.samples)), mastery: Math.round(row.correct / Math.max(1, row.attempts) * 100 * Math.min(1, row.attempts / 20)) }));
  };
  const keys = aggregate('keyStats'), bigrams = aggregate('bigrams'), trigrams = aggregate('trigrams');
  const weakKeys = keys.filter(k => k.attempts >= 3).sort((a, b) => a.accuracy - b.accuracy || b.averageLatency - a.averageLatency).slice(0, 6);
  const strongKeys = [...keys].filter(k => k.attempts >= 5).sort((a, b) => b.mastery - a.mastery || a.averageLatency - b.averageLatency).slice(0, 6);
  const fingers = [...new Set(keys.map(k => k.finger))].map(finger => { const rows = keys.filter(k => k.finger === finger); const attempts = rows.reduce((s, r) => s + r.attempts, 0); return { finger, attempts, accuracy: Math.round(rows.reduce((s, r) => s + r.correct, 0) / Math.max(1, attempts) * 100), averageLatency: Math.round(rows.reduce((s, r) => s + r.totalLatency, 0) / Math.max(1, rows.reduce((s, r) => s + r.samples, 0))) }; });
  const startDate = new Date(now); startDate.setUTCDate(startDate.getUTCDate() - (startDate.getUTCDay() + 6) % 7); startDate.setUTCHours(0, 0, 0, 0);
  const start = startDate.toISOString().slice(0, 10), previous = new Date(startDate.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const week = history.filter(r => r.completedAt >= start), previousWeek = history.filter(r => r.completedAt >= previous && r.completedAt < start);
  const sum = (rows: GameResult[], field: 'charactersTyped' | 'correctCharacters' | 'incorrectCharacters' | 'correctedErrors' | 'uncorrectedErrors') => rows.reduce((s, r) => s + r.typing![field], 0);
  const averageWpm = average(history, 'adjustedWpm'), xp = history.reduce((s, r) => s + r.xp, 0);
  const bests = Object.values(history.reduce<Record<string, GameResult>>((all, r) => { const key = `${r.typing!.config.mode}:${r.typing!.config.duration || `${r.typing!.config.wordCount}w`}:${r.typing!.config.language || ''}:${r.typing!.config.correction}`; if (r.typing!.passed && r.accuracy >= 95 && (!all[key] || all[key].typing!.adjustedWpm < r.typing!.adjustedWpm)) all[key] = r; return all; }, {}));
  const coaching: string[] = [];
  if (!history.length) coaching.push('Begin with F and J. Find the small bumps and keep your hands relaxed.');
  if (weakKeys.length) coaching.push(`Give ${weakKeys.slice(0, 3).map(k => k.key === ' ' ? 'Space' : k.key.toUpperCase()).join(', ')} some focused practice. These keys have your lowest observed accuracy.`);
  if (week.length && previousWeek.length) coaching.push(`Your average speed moved from ${average(previousWeek, 'adjustedWpm')} to ${average(week, 'adjustedWpm')} WPM this week.`);
  if (history.length && average(history.slice(-5), 'accuracy') < 95) coaching.push('Slow the pacer down and aim for 95% accuracy before adding more speed.');
  const slow = [...bigrams].filter(k => k.samples >= 3).sort((a, b) => b.averageLatency - a.averageLatency)[0];
  if (slow) coaching.push(`The ${JSON.stringify(slow.key)} transition averages ${slow.averageLatency} ms. Try a short combination drill.`);
  if (history.length && !coaching.length) coaching.push('Your recent practice is steady. Try a longer passage at a comfortable pace.');
  return { sessions: history.length, totalMinutes: Math.round(history.reduce((s, r) => s + r.duration, 0) / 60), totalCharacters: sum(history, 'charactersTyped'), correctCharacters: sum(history, 'correctCharacters'), incorrectCharacters: sum(history, 'incorrectCharacters'), correctedErrors: sum(history, 'correctedErrors'), uncorrectedErrors: sum(history, 'uncorrectedErrors'), averageWpm, bestWpm: Math.max(0, ...bests.map(r => r.typing!.adjustedWpm)), averageAccuracy: average(history, 'accuracy'), averageConsistency: average(history, 'consistency'), averageRhythm: average(history, 'rhythm'), reactionTime: average(history, 'reactionTime'), longestCleanStreak: Math.max(0, ...history.map(r => r.typing!.longestCleanStreak)), xp, level: Math.floor(Math.sqrt(xp / 100)) + 1, rank: typingRank(averageWpm), keys, bigrams, trigrams, weakKeys, strongKeys, fingers, weakFingers: [...fingers].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2), coaching, bests, weekly: { start, characters: sum(week, 'charactersTyped'), sessions: week.length, minutes: Math.round(week.reduce((s, r) => s + r.duration, 0) / 60), averageWpm: average(week, 'adjustedWpm'), averageAccuracy: average(week, 'accuracy'), longSessions: week.filter(r => r.duration >= 300).length, previousWpm: average(previousWeek, 'adjustedWpm'), improvement: Math.round((average(week, 'adjustedWpm') - average(previousWeek, 'adjustedWpm')) * 10) / 10 } };
}
export interface TypingAchievement { id: string; name: string; description: string; category: string; metric: 'sessions' | 'wpm' | 'accuracy' | 'clean' | 'code' | 'duration' | 'lessons' | 'campaign' | 'keys'; threshold: number; }
export const typingAchievements: TypingAchievement[] = [
  ...[1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].map(n => ({ id: `typing-sessions-${n}`, name: n === 1 ? 'First Keystroke' : `${n} typing discoveries`, description: `Complete ${n} typing sessions at 80% accuracy or higher.`, category: 'Typing', metric: 'sessions' as const, threshold: n })),
  ...[20, 30, 40, 50, 60, 70, 80, 90, 100, 120].map(n => ({ id: `typing-speed-${n}`, name: n === 100 ? 'Century Club' : `Speed ${n}`, description: `Reach ${n} adjusted WPM at 95% accuracy in a session lasting at least 15 seconds.`, category: 'Typing', metric: 'wpm' as const, threshold: n })),
  ...[1, 5, 10, 20, 50, 100, 250, 500].map(n => ({ id: `typing-accuracy-${n}`, name: n === 20 ? 'Accuracy Master' : `Precision ${n}`, description: `Complete ${n} sessions with at least 98% accuracy.`, category: 'Typing', metric: 'accuracy' as const, threshold: n })),
  ...[20, 50, 100, 200, 350, 500, 1000, 2000].map(n => ({ id: `typing-clean-${n}`, name: `${n} without a stumble`, description: `Type ${n} correct characters in an unbroken streak.`, category: 'Typing', metric: 'clean' as const, threshold: n })),
  ...[1, 5, 10, 25, 50, 100].map(n => ({ id: `typing-code-${n}`, name: n === 100 ? 'Code Warrior' : `CodeType ${n}`, description: `Complete ${n} code typing exercises.`, category: 'Typing', metric: 'code' as const, threshold: n })),
  ...[60, 120, 300, 600, 900, 1800].map(n => ({ id: `typing-endurance-${n}`, name: n === 1800 ? 'Marathon Typist' : `${n / 60}-minute flow`, description: `Complete a ${n / 60}-minute typing session at 90% accuracy.`, category: 'Typing', metric: 'duration' as const, threshold: n })),
  ...[1, 6, 12, 18, 26].map(n => ({ id: `typing-lessons-${n}`, name: n === 6 ? 'Home Row Hero' : `Lesson milestone ${n}`, description: `Complete ${n} distinct touch-typing lessons.`, category: 'Typing', metric: 'lessons' as const, threshold: n })),
  ...[1, 10, 50, 100, 300, 735].map(n => ({ id: `typing-campaign-${n}`, name: `Academy explorer ${n}`, description: `Complete ${n} distinct typing campaign levels.`, category: 'Typing', metric: 'campaign' as const, threshold: n })),
  { id: 'typing-keyboard-master', name: 'Keyboard Master', description: 'Reach 90% mastery on all 26 alphabet keys, with at least 20 attempts on each.', category: 'Typing', metric: 'keys', threshold: 26 },
];
export function typingAchievementProgress(a: TypingAchievement, results: GameResult[]): number {
  const rows = results.filter(r => r.typing?.passed && r.typing.charactersTyped >= 10 && r.duration >= 5);
  if (a.metric === 'wpm') return Math.max(0, ...rows.filter(r => r.duration >= 15 && r.accuracy >= 95).map(r => r.typing!.adjustedWpm));
  if (a.metric === 'accuracy') return rows.filter(r => r.accuracy >= 98).length;
  if (a.metric === 'clean') return Math.max(0, ...rows.map(r => r.typing!.longestCleanStreak));
  if (a.metric === 'code') return rows.filter(r => r.typing!.config.mode === 'code').length;
  if (a.metric === 'duration') return Math.max(0, ...rows.filter(r => r.accuracy >= 90).map(r => r.duration));
  if (a.metric === 'lessons') return new Set(rows.filter(r => r.accuracy >= 90 && typingLessons.some(l => l.id === r.typing!.config.lessonId)).map(r => r.typing!.config.lessonId)).size;
  if (a.metric === 'campaign') return new Set(rows.filter(r => r.typing!.config.region).map(r => `${r.typing!.config.region}:${r.typing!.config.level}`)).size;
  if (a.metric === 'keys') return summarizeTyping(rows).keys.filter(k => /^[a-z]$/.test(k.key) && k.mastery >= 90 && k.attempts >= 20).length;
  return rows.length;
}
