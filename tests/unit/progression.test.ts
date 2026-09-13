import { describe, expect, it } from 'vitest';
import type { GameResult } from '../../shared/contracts';
import { dailyChallenge } from '../../shared/daily';
import {
  achievementProgress, achievements, adaptiveDifficulty, calculateReward,
  campaignLevel, currentStreak, playerLevel, playerRank, utcDate, worlds,
} from '../../shared/progression';
import { puzzleGames as games, getGame } from '../../shared/registry';
import { generateWorkout } from '../../shared/workout';

function result(patch: Partial<GameResult> = {}): GameResult {
  return {
    id: 'result', slug: 'memory-cards', seed: 'progression', generatorVersion: 1,
    difficulty: 3, score: 400, accuracy: 100, mistakes: 0, moves: 12,
    duration: 60, xp: 50, completedAt: '2026-09-10T12:00:00Z', verified: false,
    ...patch,
  };
}

const categoryOf = (slug: string) => getGame(slug)?.category;

describe('rewards and levels', () => {
  it('rewards accuracy and difficulty while bounding the duration penalty', () => {
    const perfect = { correct: 10, total: 10, moves: 10, mistakes: 0 };
    expect(calculateReward(perfect, 1, 0)).toEqual({ score: 300, accuracy: 100, xp: 40 });
    expect(calculateReward(perfect, 8, 0)).toEqual({ score: 1000, accuracy: 100, xp: 110 });
    const imperfect = calculateReward({ ...perfect, correct: 5, mistakes: 5 }, 3, 0);
    expect(imperfect).toEqual({ score: 250, accuracy: 50, xp: 45 });
    expect(calculateReward(perfect, 3, 900)).toEqual(calculateReward(perfect, 3, 100000));
    expect(calculateReward(perfect, 3, -100)).toEqual(calculateReward(perfect, 3, 0));
    expect(calculateReward(perfect, 3, 900).score).toBeLessThan(calculateReward(perfect, 3, 30).score);
    expect(calculateReward({ ...perfect, correct: 0, total: 0 }, 1, 1)).toEqual({ score: 0, accuracy: 0, xp: 20 });
  });

  it('crosses quadratic XP thresholds without losing overflow', () => {
    expect(playerLevel(0)).toEqual({ level: 1, current: 0, required: 125 });
    expect(playerLevel(124)).toEqual({ level: 1, current: 124, required: 125 });
    expect(playerLevel(125)).toEqual({ level: 2, current: 0, required: 375 });
    expect(playerLevel(525)).toEqual({ level: 3, current: 25, required: 625 });
    expect(playerLevel(125 * 99 ** 2).level).toBe(100);
    expect(playerRank(1)).toBe('Curious Explorer');
    expect(playerRank(6)).toBe('Lifelong Learner');
    expect(playerRank(100)).toBe('MindForge Legend');
  });
});

describe('adaptive difficulty', () => {
  it('waits for three consistent runs and filters unrelated games', () => {
    expect(adaptiveDifficulty([], 'memory-cards')).toBe(1);
    expect(adaptiveDifficulty([result()], 'memory-cards')).toBe(3);
    expect(adaptiveDifficulty([result(), result()], 'memory-cards')).toBe(3);
    expect(adaptiveDifficulty([result(), result(), result(), result({ slug: 'sudoku', difficulty: 8 })], 'memory-cards')).toBe(4);
  });

  it('raises difficulty only for quick accurate play at the same level', () => {
    expect(adaptiveDifficulty([result(), result(), result({ duration: 180 })], 'memory-cards')).toBe(3);
    expect(adaptiveDifficulty([result({ accuracy: 90 }), result({ accuracy: 90 }), result({ accuracy: 90 })], 'memory-cards')).toBe(3);
    expect(adaptiveDifficulty([result({ difficulty: 2 }), result(), result()], 'memory-cards')).toBe(3);
    expect(adaptiveDifficulty([result({ accuracy: 0 }), result({ accuracy: 0 }), result(), result(), result()], 'memory-cards')).toBe(4);
  });

  it('reduces consistently difficult play and stays inside supported bounds', () => {
    const low = Array.from({ length: 3 }, () => result({ accuracy: 30 }));
    expect(adaptiveDifficulty(low, 'memory-cards')).toBe(2);
    expect(adaptiveDifficulty(low.map(r => ({ ...r, difficulty: 1 })), 'memory-cards')).toBe(1);
    expect(adaptiveDifficulty(Array.from({ length: 3 }, () => result({ difficulty: 8 })), 'memory-cards')).toBe(8);
  });
});

describe('UTC streaks and daily challenges', () => {
  it('counts unique consecutive dates, retaining yesterday until today ends', () => {
    const history = ['2026-09-07', '2026-09-08', '2026-09-08', '2026-09-09', '2026-09-10'].map(date => result({ completedAt: `${date}T23:30:00Z` }));
    expect(currentStreak(history, new Date('2026-09-10T23:59:59Z'))).toBe(4);
    expect(currentStreak(history, new Date('2026-09-11T23:59:59Z'))).toBe(4);
    expect(currentStreak(history, new Date('2026-09-12T00:00:00Z'))).toBe(0);
    expect(currentStreak([], new Date('2026-09-11T00:00:00Z'))).toBe(0);
  });

  it('handles leap days and timezone offsets using UTC dates', () => {
    const history = ['2024-02-28', '2024-02-29', '2024-03-01'].map(date => result({ completedAt: `${date}T12:00:00Z` }));
    expect(currentStreak(history, new Date('2024-03-01T12:00:00Z'))).toBe(3);
    expect(utcDate(new Date('2026-09-12T01:00:00+03:00'))).toBe('2026-09-11');
    expect(dailyChallenge(new Date('2026-09-12T01:00:00+03:00'))).toEqual(dailyChallenge(new Date('2026-09-11T01:00:00Z')));
  });

  it('rotates through every available game with stable versioned seeds', () => {
    const challenges = Array.from({ length: 8 }, (_, index) => dailyChallenge(new Date(Date.UTC(2026, 8, 11 + index))));
    expect(new Set(challenges.map(c => c.slug))).toEqual(new Set(games.map(game => game.slug)));
    expect(new Set(challenges.map(c => c.seed)).size).toBe(8);
    for (const challenge of challenges) {
      expect(challenge.seed).toBe(`daily:v1:${challenge.date}`);
      expect(challenge.generatorVersion).toBe(1);
      expect(challenge.difficulty).toBeGreaterThanOrEqual(3);
      expect(challenge.difficulty).toBeLessThanOrEqual(6);
    }
    expect(dailyChallenge(new Date('1969-12-31T23:00:00Z')).slug).toBeTruthy();
  });
});

describe('daily workouts', () => {
  it.each([[5, 3], [10, 5], [15, 7]])('creates %i minute plans with %i distinct playable games', (minutes, count) => {
    const workout = generateWorkout([], minutes, '2026-09-11');
    expect(workout).toHaveLength(count);
    expect(new Set(workout.map(entry => entry.slug)).size).toBe(count);
    workout.forEach((entry, index) => {
      expect(getGame(entry.slug)).toBeDefined();
      expect(entry).toMatchObject({ index, seed: entry.slug === 'typing-academy' ? 'typing-workout:v1:2026-09-11:0' : `workout:v1:2026-09-11:${index}`, difficulty: 1 });
    });
    expect(generateWorkout([], minutes, '2026-09-11')).toEqual(workout);
  });

  it('freezes adaptation before the selected day and keeps the plan after today’s completions', () => {
    const date = '2026-09-11', planned = generateWorkout([], 15, date);
    const slug = planned[0].slug;
    const prior = Array.from({ length: 3 }, () => result({ slug, completedAt: '2026-09-10T23:59:00Z' }));
    const workout = generateWorkout(prior, 15, date);
    expect(workout[0].difficulty).toBe(4);
    const today = Array.from({ length: 3 }, () => result({ slug, difficulty: 8, accuracy: 20, completedAt: `${date}T12:00:00Z` }));
    expect(generateWorkout([...prior, ...today], 15, date)).toEqual(workout);
    expect(generateWorkout(prior, 15, '2026-09-12').map(entry => entry.slug)).not.toEqual(workout.map(entry => entry.slug));
  });
});

describe('campaign', () => {
  it('defines 1,120 unique reproducible levels and ten-level bosses', () => {
    expect(worlds).toHaveLength(10);
    expect(worlds.reduce((sum, world) => sum + world.levels, 0)).toBe(1120);
    const seeds = new Set<string>();
    for (const world of worlds) {
      for (let level = 1; level <= world.levels; level++) {
        const challenge = campaignLevel(world.id, level);
        expect(campaignLevel(world.id, level)).toEqual(challenge);
        expect(challenge.boss).toBe(level % 10 === 0);
        expect(world.games).toContain(challenge.slug);
        expect(challenge.difficulty).toBeGreaterThanOrEqual(1);
        expect(challenge.difficulty).toBeLessThanOrEqual(8);
        seeds.add(challenge.seed);
      }
      expect(campaignLevel(world.id, 1).difficulty).toBe(1);
      expect(campaignLevel(world.id, world.levels).difficulty).toBe(8);
    }
    expect(seeds.size).toBe(1120);
  });

  it('rejects missing worlds and invalid or out-of-range levels', () => {
    expect(() => campaignLevel('missing', 1)).toThrow('Unknown campaign level');
    for (const level of [0, -1, 1.5, Number.NaN, 101]) {
      expect(() => campaignLevel('memory-valley', level)).toThrow('Unknown campaign level');
    }
  });
});

describe('achievement progress', () => {
  it('has at least 150 uniquely identified achievements with no invented starting progress', () => {
    expect(achievements.length).toBeGreaterThanOrEqual(150);
    expect(new Set(achievements.map(a => a.id)).size).toBe(achievements.length);
    for (const achievement of achievements) expect(achievementProgress(achievement, [], categoryOf)).toBe(0);
  });

  it('counts completed category games, perfect results, and earned XP', () => {
    const history = [result(), result({ slug: 'sequence-recall', accuracy: 80, xp: 35 }), result({ slug: 'sudoku', xp: 75 })];
    expect(achievementProgress(achievements.find(a => a.id === 'memory-5')!, history, categoryOf)).toBe(2);
    expect(achievementProgress(achievements.find(a => a.id === 'first-steps')!, history, categoryOf)).toBe(3);
    expect(achievementProgress(achievements.find(a => a.id === 'perfect-10')!, history, categoryOf)).toBe(2);
    expect(achievementProgress(achievements.find(a => a.id === 'xp-10000')!, history, categoryOf)).toBe(160);
  });

  it('counts unique campaign levels and retains historical streak achievements', () => {
    const history = [
      result({ completedAt: '2026-08-01T12:00:00Z', context: { mode: 'campaign', world: 'memory-valley', level: 1 } }),
      result({ completedAt: '2026-08-02T12:00:00Z', context: { mode: 'campaign', world: 'memory-valley', level: 1 } }),
      result({ completedAt: '2026-08-03T12:00:00Z', context: { mode: 'campaign', world: 'logic-citadel', level: 1 } }),
      result({ completedAt: '2026-09-11T12:00:00Z', context: { mode: 'practice' } }),
    ];
    expect(achievementProgress(achievements.find(a => a.id === 'journey-10')!, history, categoryOf)).toBe(2);
    expect(currentStreak(history, new Date('2026-09-11T12:00:00Z'))).toBe(1);
    expect(achievementProgress(achievements.find(a => a.id === 'streak-3')!, history, categoryOf)).toBe(3);
  });
});
