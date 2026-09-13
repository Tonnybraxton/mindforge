import { typingAchievements, typingAchievementProgress } from './typing/analytics';
import type { Category, GameMetrics, GameResult } from './contracts';

export function calculateReward(metrics: GameMetrics, difficulty: number, duration: number) {
  const d = Math.max(1, Math.min(8, Math.floor(difficulty)));
  const accuracy = Math.round(Math.min(1, Math.max(0, metrics.correct / Math.max(1, metrics.total))) * 100);
  const efficiency = Math.max(0.25, 1 - Math.min(0.75, Math.max(0, duration) / 1200));
  const score = Math.round((200 + d * 100) * (accuracy / 100) * (0.75 + efficiency * 0.25));
  return { score, accuracy, xp: Math.max(5, Math.round((30 + d * 10) * (0.5 + accuracy / 200))) };
}
export const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);
export function playerLevel(xp: number) { const level = Math.floor(Math.sqrt(Math.max(0, xp) / 125)) + 1; const floor = 125 * (level - 1) ** 2; return { level, current: xp - floor, required: 125 * level ** 2 - floor }; }
export function playerRank(level: number) { return level < 6 ? 'Curious Explorer' : level < 11 ? 'Lifelong Learner' : level < 21 ? 'Problem Solver' : level < 31 ? 'Analyst' : level < 41 ? 'Strategist' : level < 51 ? 'Expert' : level < 66 ? 'Master Thinker' : level < 81 ? 'Grandmaster' : level < 100 ? 'Mind Architect' : 'MindForge Legend'; }
export function currentStreak(results: GameResult[], now = new Date()) { const dates = new Set(results.map(r => r.completedAt.slice(0, 10))); const cursor = new Date(utcDate(now) + 'T12:00:00Z'); if (!dates.has(utcDate(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1); let days = 0; while (dates.has(utcDate(cursor))) { days++; cursor.setUTCDate(cursor.getUTCDate() - 1); } return days; }
export function adaptiveDifficulty(results: GameResult[], slug: string) { const recent = results.filter(r => r.slug === slug).slice(-5); if (!recent.length) return 1; const last = recent.at(-1)!.difficulty; if (recent.length < 3) return last; const window = recent.slice(-3); const accuracy = window.reduce((sum, r) => sum + r.accuracy, 0) / window.length; const consistent = window.every(r => r.difficulty === last); return Math.max(1, Math.min(8, last + (consistent && accuracy > 90 && window.every(r => r.duration < 180) ? 1 : consistent && accuracy < 50 ? -1 : 0))); }
export interface CampaignWorld { id: string; name: string; category: Category; levels: number; description: string; accent: string; games: string[]; }
export const worlds: CampaignWorld[] = [
  { id: 'memory-valley', name: 'Memory Valley', category: 'Memory', levels: 100, description: 'Every great journey starts with a little curiosity.', accent: '#99dab0', games: ['memory-cards', 'sequence-recall'] },
  { id: 'logic-citadel', name: 'Logic Citadel', category: 'Logic', levels: 120, description: 'Find clarity in a world of possibilities.', accent: '#c4b5fd', games: ['sudoku'] },
  { id: 'numbers-nexus', name: 'Numbers Nexus', category: 'Math', levels: 100, description: 'Discover the rhythm behind the numbers.', accent: '#f5c47c', games: ['mental-math'] },
  { id: 'language-kingdom', name: 'Language Kingdom', category: 'Language', levels: 100, description: 'A world waiting to be put into words.', accent: '#f0a9bc', games: ['anagram-challenge'] },
  { id: 'spatial-realm', name: 'Spatial Realm', category: 'Spatial', levels: 100, description: 'Change your perspective. Find your way.', accent: '#96c5eb', games: ['maze-runner'] },
  { id: 'focus-district', name: 'Focus District', category: 'Focus', levels: 100, description: 'Tune into the details that make a difference.', accent: '#edbb88', games: ['stroop-challenge'] },
  { id: 'strategy-summit', name: 'Strategy Summit', category: 'Strategy', levels: 100, description: 'Small moves. Extraordinary possibilities.', accent: '#b6cf80', games: ['sokoban'] },
  { id: 'speed-circuit', name: 'Speed Circuit', category: 'Speed', levels: 100, description: 'Find your flow, one quick decision at a time.', accent: '#e9d47a', games: ['rapid-comparison'] },
  { id: 'pattern-dimension', name: 'Pattern Dimension', category: 'Patterns', levels: 100, description: 'There is a connection hiding in plain sight.', accent: '#b8a9e5', games: ['pattern-matrix'] },
  { id: 'grandmaster-realm', name: 'Grandmaster Realm', category: 'Logic', levels: 200, description: 'Bring everything you have learned together.', accent: '#d9b571', games: ['memory-cards', 'sudoku', 'mental-math', 'maze-runner', 'sokoban', 'stroop-challenge', 'pattern-matrix'] },
];
export function campaignLevel(worldId: string, level: number) { const world = worlds.find(w => w.id === worldId); if (!world || !Number.isInteger(level) || level < 1 || level > world.levels) throw new Error('Unknown campaign level.'); return { world: world.id, level, slug: world.games[(level - 1) % world.games.length], seed: `campaign:v1:${world.id}:${level}`, difficulty: Math.min(8, 1 + Math.floor((level - 1) * 8 / world.levels)), boss: level % 10 === 0 }; }
export interface AchievementDefinition { id: string; name: string; description: string; category: string; threshold: number; metric: 'games' | 'perfect' | 'streak' | 'xp' | 'campaign' | 'typing'; targetCategory?: Category; }
const categoryNames: Category[] = ['Memory', 'Logic', 'Math', 'Language', 'Spatial', 'Focus', 'Strategy', 'Speed', 'Patterns'];
const milestones = [1, 5, 10, 25, 50, 100, 200, 350, 500, 1000];
export const achievements: AchievementDefinition[] = [
  ...typingAchievements.map(a => ({ id: a.id, name: a.name, description: a.description, category: a.category, threshold: a.threshold, metric: 'typing' as const })),
  ...categoryNames.flatMap(category => milestones.map((threshold, i) => ({ id: `${category.toLowerCase()}-${threshold}`, name: `${category} ${['Spark', 'Explorer', 'Apprentice', 'Thinker', 'Specialist', 'Master', 'Champion', 'Architect', 'Legend', 'Luminary'][i]}`, description: `Complete ${threshold.toLocaleString()} ${category.toLowerCase()} ${threshold === 1 ? 'puzzle' : 'puzzles'}.`, category, targetCategory: category, threshold, metric: 'games' as const }))),
  { id: 'first-steps', name: 'First steps', description: 'Complete your very first puzzle.', category: 'Milestones', threshold: 1, metric: 'games' },
  ...[3, 7, 14, 30, 100].map(n => ({ id: `streak-${n}`, name: `${n}-day rhythm`, description: `Play on ${n} consecutive days.`, category: 'Consistency', threshold: n, metric: 'streak' as const })),
  ...[1, 10].map(n => ({ id: `perfect-${n}`, name: n === 1 ? 'Picture perfect' : 'Perfect ten', description: `Finish ${n} ${n === 1 ? 'puzzle' : 'puzzles'} with 100% accuracy.`, category: 'Mastery', threshold: n, metric: 'perfect' as const })),
  { id: 'journey-10', name: 'Trailblazer', description: 'Complete 10 different campaign levels.', category: 'Journey', threshold: 10, metric: 'campaign' },
  { id: 'xp-10000', name: 'A brilliant beginning', description: 'Earn 10,000 XP through play.', category: 'Milestones', threshold: 10000, metric: 'xp' },
];
export function achievementProgress(a: AchievementDefinition, results: GameResult[], categoryOf: (slug: string) => string | undefined): number { if (a.metric === 'typing') return typingAchievementProgress(typingAchievements.find(t => t.id === a.id)!, results); if (a.metric === 'streak') { let best = 0; for (const date of new Set(results.map(r => r.completedAt.slice(0, 10)))) best = Math.max(best, currentStreak(results, new Date(date + 'T12:00:00Z'))); return best; } if (a.metric === 'xp') return results.reduce((s, r) => s + r.xp, 0); if (a.metric === 'perfect') return results.filter(r => r.accuracy === 100).length; if (a.metric === 'campaign') return new Set(results.filter(r => r.context?.mode === 'campaign').map(r => `${r.context?.world}:${r.context?.level}`)).size; return results.filter(r => !a.targetCategory || categoryOf(r.slug) === a.targetCategory).length; }
