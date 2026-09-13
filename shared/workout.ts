import type { GameResult } from './contracts';
import { adaptiveDifficulty, utcDate } from './progression';
import { games } from './registry';

/** The date fixes the rotation; recent performance chooses a starting difficulty. */
export function generateWorkout(results: GameResult[], minutes = 10, date = utcDate()) {
  const count = minutes <= 5 ? 3 : minutes <= 10 ? 5 : 7;
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const available = games.filter(g => ['memory-cards', 'mental-math', 'sequence-recall', 'stroop-challenge', 'pattern-matrix', 'maze-runner', 'sokoban'].includes(g.slug));
  return Array.from({ length: Math.min(count, available.length) }, (_, index) => {
    if (index === Math.min(count, available.length) - 1) return { slug: 'typing-academy', seed: `typing-workout:v1:${date}:0`, difficulty: 1, index };
    const game = available[((day + index) % available.length + available.length) % available.length];
    // Freeze adaptation to earlier days so today's results do not change today's workout.
    return { slug: game.slug, seed: `workout:v1:${date}:${index}`, difficulty: adaptiveDifficulty(results.filter(r => r.completedAt.slice(0, 10) < date), game.slug), index };
  });
}
