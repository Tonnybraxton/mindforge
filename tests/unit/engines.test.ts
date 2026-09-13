import { winningActions } from '../helpers/game-solutions';
import { describe, expect, it } from 'vitest';
import { applyAction, createGame, getMetrics, type GameState } from '../../shared/games/engine';
import { countSudokuSolutions } from '../../shared/games/sudoku';
import { directions, neighbour, solveSokoban, type Direction } from '../../shared/games/sokoban';
import { seededRandom, shuffle } from '../../shared/games/random';
import { puzzleGames as games } from '../../shared/registry';
import type { GameAction } from '../../shared/contracts';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

describe.each(games.map(game => game.slug))('%s deterministic game contract', slug => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('generates a solvable immutable replay at difficulty %i', difficulty => {
    const state = freeze(createGame(slug, 'contract:2026-09-11', difficulty));
    expect(createGame(slug, state.seed, difficulty)).toEqual(state);
    const actions = winningActions(state);
    expect(actions.length).toBeGreaterThan(0);
    const result = actions.reduce((current, action) => freeze(applyAction(current, freeze(action))), state);
    expect(result.status).toBe('won');
    expect(result.metrics.mistakes).toBe(0);
    expect(result.metrics.correct).toBe(result.metrics.total);
    expect(result.metrics.correct).toBeGreaterThan(0);
    expect(result.metrics.moves).toBeGreaterThan(0);
    expect(actions.reduce(applyAction, createGame(slug, state.seed, difficulty))).toEqual(result);
    expect(applyAction(result, actions[0])).toBe(result);
    const detached = getMetrics(result);
    detached.correct = -1;
    expect(result.metrics.correct).toBeGreaterThan(0);
  });

  it('ignores malformed actions and does not mutate the initial board', () => {
    const state = freeze(createGame(slug, 'invalid-actions', 1));
    const invalid: GameAction[] = [
      { type: 'unsupported' }, { type: 'set', index: -1, value: 1 },
      { type: 'flip', index: 1.5 }, { type: 'tap', index: 100000 },
      { type: 'answer', index: -1, value: Number.NaN },
      { type: 'answer', index: 100, value: Number.POSITIVE_INFINITY },
      { type: 'answer', index: 0.5, value: 0.5 },
      { type: 'answer', value: '2' }, { type: 'move', value: 'north' },
    ];
    for (const action of invalid) expect(applyAction(state, action)).toBe(state);
  });
});

describe('generation boundaries', () => {
  it('clamps supported difficulty levels and rejects unknown games', () => {
    for (const difficulty of [-5, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createGame('memory-cards', 'boundary', difficulty)).toEqual(createGame('memory-cards', 'boundary', 1));
    }
    expect(createGame('memory-cards', 'boundary', 99).difficulty).toBe(8);
    expect(createGame('memory-cards', 'boundary', 3.9).difficulty).toBe(3);
    expect(() => createGame('not-a-game', 'boundary', 1)).toThrow('Unknown game');
  });

  it('produces stable bounded randomness and shuffles without altering the source', () => {
    const random = seededRandom('repeat'), repeat = seededRandom('repeat');
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBe(repeat());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    const source = freeze([1, 2, 3, 4, 5]);
    expect(shuffle(source, seededRandom('shuffle')).sort()).toEqual(source);
    expect(seededRandom('different')()).not.toBe(seededRandom('repeat')());
  });
});

describe('memory cards', () => {
  it('blocks duplicate flips and waits for mismatches to hide before continuing', () => {
    let state = createGame('memory-cards', 'mismatch', 1);
    if (state.slug !== 'memory-cards') throw new Error('Unexpected game');
    const deck = state.deck;
    const first = 0, wrong = deck.findIndex(value => value !== deck[first]);
    const match = deck.findIndex((value, index) => value === deck[first] && index !== first);
    expect(applyAction(state, { type: 'hide' })).toBe(state);
    state = applyAction(state, { type: 'flip', index: first }) as typeof state;
    expect(applyAction(state, { type: 'flip', index: first })).toBe(state);
    state = applyAction(state, { type: 'flip', index: wrong }) as typeof state;
    expect(state.metrics).toEqual({ moves: 2, total: 1, correct: 0, mistakes: 1 });
    expect(applyAction(state, { type: 'flip', index: match })).toBe(state);
    state = applyAction(state, { type: 'hide' }) as typeof state;
    state = applyAction(state, { type: 'flip', index: first }) as typeof state;
    state = applyAction(state, { type: 'flip', index: match }) as typeof state;
    expect(state.matched).toEqual([first, match]);
    expect(applyAction(state, { type: 'flip', index: first })).toBe(state);
  });
});

describe('sequence recall', () => {
  it('requires a preview and loses after the third wrong sequence', () => {
    let state = createGame('sequence-recall', 'three-errors', 3);
    if (state.slug !== 'sequence-recall') throw new Error('Unexpected game');
    expect(applyAction(state, { type: 'tap', index: state.sequences[0][0] })).toBe(state);
    const wrong = (state.sequences[0][0] + 1) % state.gridSize;
    for (let i = 1; i <= 3; i++) {
      state = applyAction(state, { type: 'preview-end' }) as typeof state;
      expect(applyAction(state, { type: 'preview-end' })).toBe(state);
      state = applyAction(state, { type: 'tap', index: wrong }) as typeof state;
      expect(state.cursor).toBe(0);
      expect(state.phase).toBe('preview');
      expect(state.metrics.mistakes).toBe(i);
      expect(state.status).toBe(i === 3 ? 'lost' : 'playing');
    }
    expect(applyAction(state, { type: 'preview-end' })).toBe(state);
  });
});

describe('Sudoku', () => {
  it.each([1, 3, 5, 8])('preserves clues and has exactly one legal solution at difficulty %i', difficulty => {
    for (const seed of ['unique-a', 'unique-b']) {
      const state = createGame('sudoku', seed, difficulty);
      if (state.slug !== 'sudoku') throw new Error('Unexpected game');
      expect(countSudokuSolutions(state.givens, state.size, state.boxRows, state.boxCols)).toBe(1);
      expect(state.givens.some(value => value === 0)).toBe(true);
      expect(state.givens.every((value, index) => !value || value === state.solution[index])).toBe(true);
      const expected = Array.from({ length: state.size }, (_, index) => index + 1);
      for (let index = 0; index < state.size; index++) {
        expect(state.solution.slice(index * state.size, (index + 1) * state.size).sort()).toEqual(expected);
        expect(Array.from({ length: state.size }, (_, row) => state.solution[row * state.size + index]).sort()).toEqual(expected);
      }
      const clue = state.givens.findIndex(Boolean);
      expect(applyAction(state, { type: 'set', index: clue, value: 0 })).toBe(state);
    }
  });

  it('tracks corrections and clearing without rewarding repeated answers', () => {
    const initial = createGame('sudoku', 'correction', 1);
    if (initial.slug !== 'sudoku') throw new Error('Unexpected game');
    const index = initial.givens.indexOf(0), answer = initial.solution[index];
    const wrong = applyAction(initial, { type: 'set', index, value: answer % initial.size + 1 });
    expect(wrong.metrics.mistakes).toBe(1);
    const corrected = applyAction(wrong, { type: 'set', index, value: answer });
    expect(corrected.metrics).toEqual({ moves: 2, total: 2, correct: 1, mistakes: 1 });
    expect(applyAction(corrected, { type: 'set', index, value: answer })).toBe(corrected);
    const cleared = applyAction(corrected, { type: 'set', index, value: 0 });
    expect(cleared.metrics).toEqual({ moves: 3, total: 1, correct: 0, mistakes: 1 });
    expect(countSudokuSolutions([1, 1, ...Array<number>(14).fill(0)], 4, 2, 2)).toBe(0);
  });
});

describe.each(['mental-math', 'stroop-challenge'])('%s completion threshold', slug => {
  it.each([true, false])('awards a win only when at least half of the answers are correct (%s)', shouldWin => {
    let state = createGame(slug, 'threshold', 2);
    if (state.slug !== 'mental-math' && state.slug !== 'stroop-challenge') throw new Error('Unexpected game');
    const required = Math.ceil(state.questions.length / 2);
    const target = required - Number(!shouldWin);
    for (let i = 0; i < state.questions.length; i++) {
      const correct = i < target;
      const action = state.slug === 'mental-math'
        ? { type: 'answer', value: state.questions[i].answer + Number(!correct) }
        : { type: 'answer', index: (state.questions[i].ink + Number(!correct)) % state.colorCount };
      state = applyAction(state, action) as typeof state;
    }
    expect(state.status).toBe(shouldWin ? 'won' : 'lost');
    expect(state.metrics.correct).toBe(target);
    expect(state.metrics.total).toBe(state.questions.length);
  });
});

describe('spatial puzzles', () => {
  it('never wraps grid movement onto an adjacent row', () => {
    expect(neighbour(6, 'left', 6, 6)).toBe(-1);
    expect(neighbour(5, 'right', 6, 6)).toBe(-1);
    expect(neighbour(3, 'up', 6, 6)).toBe(-1);
    expect(neighbour(32, 'down', 6, 6)).toBe(-1);
  });

  it.each([1, 4, 8])('generates connected mazes with a shortest route at difficulty %i', difficulty => {
    for (const seed of ['maze-a', 'maze-b']) {
      const state = createGame('maze-runner', seed, difficulty);
      if (state.slug !== 'maze-runner') throw new Error('Unexpected game');
      const distance = new Map([[state.player, 0]]), queue = [state.player];
      for (let i = 0; i < queue.length; i++) {
        for (const direction of directions) {
          const next = neighbour(queue[i], direction, state.width, state.height);
          if (next < 0 || state.walls.includes(next) || distance.has(next)) continue;
          distance.set(next, distance.get(queue[i])! + 1);
          queue.push(next);
        }
      }
      expect(distance.size).toBe(state.width * state.height - state.walls.length);
      expect(distance.get(state.exit)).toBe(state.shortestPath.length);
      const blocked = applyAction(state, { type: 'move', value: 'up' });
      expect(blocked.metrics.mistakes).toBe(1);
      expect(blocked).toMatchObject({ player: state.player, trail: state.trail });
    }
  });

  it.each([1, 4, 8])('validates Sokoban solutions across seeds at difficulty %i', difficulty => {
    for (const seed of ['sokoban-a', 'sokoban-b']) {
      const state = createGame('sokoban', seed, difficulty);
      if (state.slug !== 'sokoban') throw new Error('Unexpected game');
      expect(state.boxes.every(box => state.targets.includes(box))).toBe(false);
      expect(new Set(state.boxes).size).toBe(state.targets.length);
      expect(state.walls).not.toContain(state.player);
      const result = state.solution.reduce((current: GameState, value) => applyAction(current, { type: 'move', value }), state);
      expect(result.status).toBe('won');
      expect(result.metrics.mistakes).toBe(0);
    }
  });

  it('can undo and reset a crate push and rejects pushes into a wall', () => {
    const generated = createGame('sokoban', 'control', 1);
    if (generated.slug !== 'sokoban') throw new Error('Unexpected game');
    // A controlled board separates undo/reset behavior from random level selection.
    const state = freeze({ ...generated, player: 14, boxes: [15], targets: [8], initialPlayer: 14, initialBoxes: [15], solution: [] as Direction[] });
    const moved = applyAction(state, { type: 'move', value: 'right' });
    expect(moved).toMatchObject({ player: 15, boxes: [16], pushes: 1 });
    const blocked = applyAction(moved, { type: 'move', value: 'right' });
    expect(blocked).toMatchObject({ player: 15, boxes: [16] });
    expect(blocked.metrics.mistakes).toBe(1);
    expect(applyAction(moved, { type: 'undo' })).toMatchObject({ player: 14, boxes: [15], history: [] });
    expect(applyAction(moved, { type: 'reset' })).toMatchObject({ player: 14, boxes: [15], history: [] });
    expect(applyAction(state, { type: 'undo' })).toBe(state);
    expect(solveSokoban({ ...state, boxes: [7] })).toBeNull();
  });
});

describe('pattern matrix', () => {
  it('rejects an incorrect option once and clears rejected options for the next question', () => {
    let state = createGame('pattern-matrix', 'rejected', 8);
    if (state.slug !== 'pattern-matrix') throw new Error('Unexpected game');
    const answer = state.questions[0].answer, wrong = (answer + 1) % 4;
    state = applyAction(state, { type: 'answer', index: wrong }) as typeof state;
    expect(state).toMatchObject({ question: 0, rejected: [wrong] });
    expect(state.metrics.mistakes).toBe(1);
    expect(applyAction(state, { type: 'answer', index: wrong })).toBe(state);
    state = applyAction(state, { type: 'answer', index: answer }) as typeof state;
    expect(state).toMatchObject({ question: 1, rejected: [] });
    expect(state.metrics).toEqual({ correct: 1, total: 2, mistakes: 1, moves: 2 });
  });
});
