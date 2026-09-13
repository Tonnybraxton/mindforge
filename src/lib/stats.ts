import { categories } from '../../shared/contracts';
import type { GameResult } from '../../shared/contracts';
import { getGame } from '../../shared/registry';
export function summarize(results: GameResult[]) {
  const skills = categories.map(category => {
    const recent = results.filter(r => getGame(r.slug)?.category === category).slice(-20);
    return { category, samples: recent.length, score: recent.length ? Math.round(recent.reduce((sum, r) => sum + r.accuracy * (0.6 + r.difficulty * 0.05), 0) / recent.length) : 0 };
  });
  const trained = skills.filter(s => s.samples);
  return { skills, brainScore: trained.length ? Math.round(trained.reduce((s, r) => s + r.score, 0) / trained.length * 10) : 0, xp: results.reduce((s, r) => s + r.xp, 0), accuracy: results.length ? Math.round(results.reduce((s, r) => s + r.accuracy, 0) / results.length) : 0, minutes: Math.round(results.reduce((s, r) => s + r.duration, 0) / 60) };
}
