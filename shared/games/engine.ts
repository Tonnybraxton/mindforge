import type { GameAction, GameMetrics } from '../contracts';
import { integer, seededRandom, shuffle } from './random';
import { generateSudoku, type SudokuPuzzle } from './sudoku';
import { directions, generateSokoban, neighbour, type Direction, type SokobanPuzzle } from './sokoban';

export const GENERATOR_VERSION = 1;
interface Common { seed: string; difficulty: number; status: 'playing' | 'won' | 'lost'; metrics: GameMetrics; }
export interface MemoryState extends Common { slug: 'memory-cards'; deck: number[]; flipped: number[]; matched: number[]; }
export interface SequenceState extends Common { slug: 'sequence-recall'; gridSize: number; sequences: number[][]; round: number; cursor: number; phase: 'preview' | 'input'; lastTile: number | null; }
export interface SudokuState extends Common, SudokuPuzzle { slug: 'sudoku'; cells: number[]; }
export interface MathQuestion { prompt: string; answer: number; }
export interface MathState extends Common { slug: 'mental-math'; questions: MathQuestion[]; question: number; feedback: { correct: boolean; answer: number } | null; }
export interface MazeState extends Common { slug: 'maze-runner'; width: number; height: number; walls: number[]; player: number; exit: number; trail: number[]; shortestPath: Direction[]; }
export interface SokobanState extends Common, SokobanPuzzle { slug: 'sokoban'; initialPlayer: number; initialBoxes: number[]; history: { player: number; boxes: number[] }[]; pushes: number; }
export const inkColors = [
  { name: 'Blue', hex: '#71a9ff' }, { name: 'Coral', hex: '#ff8390' },
  { name: 'Green', hex: '#74dfb7' }, { name: 'Gold', hex: '#f4cb70' },
  { name: 'Violet', hex: '#bd9cff' }, { name: 'Orange', hex: '#ffa660' },
] as const;
export interface StroopQuestion { word: number; ink: number; }
export interface StroopState extends Common { slug: 'stroop-challenge'; questions: StroopQuestion[]; question: number; colorCount: number; feedback: boolean | null; }
export interface PatternTile { shape: number; rotation: number; dots: number; }
export interface PatternQuestion { tiles: PatternTile[]; options: PatternTile[]; answer: number; rule: string; }
export interface PatternState extends Common { slug: 'pattern-matrix'; questions: PatternQuestion[]; question: number; rejected: number[]; }
export type GameState = MemoryState | SequenceState | SudokuState | MathState | MazeState | SokobanState | StroopState | PatternState;
export type { GameAction, GameMetrics } from '../contracts';

function makeMathQuestion(difficulty: number, round: number, random: () => number): MathQuestion {
  const level = Math.min(8, difficulty + Math.floor(round / 5));
  const operation = integer(random, 0, level <= 2 ? 1 : level <= 4 ? 3 : 5);
  const max = level <= 2 ? 10 + level * 5 : 15 + level * 9;
  const a = integer(random, 2, max), b = integer(random, 2, max);
  if (operation === 0) return { prompt: `${a} + ${b}`, answer: a + b };
  if (operation === 1) return { prompt: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: Math.abs(a - b) };
  const factor = integer(random, 2, Math.min(20, level * 2 + 2));
  const other = integer(random, 2, level * 2 + 2);
  if (operation === 2) return { prompt: `${factor} × ${other}`, answer: factor * other };
  if (operation === 3) return { prompt: `${factor * other} ÷ ${factor}`, answer: other };
  if (operation === 4) {
    const percent = [10, 20, 25, 50, 75][integer(random, 0, 4)];
    const base = integer(random, 1, level + 2) * 100;
    return { prompt: `${percent}% of ${base}`, answer: base * percent / 100 };
  }
  const denominator = integer(random, 2, 8), numerator = integer(random, 1, denominator - 1);
  const base = denominator * integer(random, 2, level * 3);
  return { prompt: `${numerator}/${denominator} of ${base}`, answer: base / denominator * numerator };
}

function makeMaze(difficulty: number, random: () => number): Omit<MazeState, keyof Common | 'slug'> {
  const width = 7 + 2 * Math.floor((difficulty - 1) / 2), height = width;
  const floor = new Set<number>([width + 1]);
  const stack = [width + 1];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = shuffle(directions, random).flatMap(direction => {
      const middle = neighbour(current, direction, width, height);
      const next = neighbour(middle, direction, width, height);
      if (next <= width || next >= width * (height - 1) || next % width === 0 || next % width === width - 1 || floor.has(next)) return [];
      return [{ next, middle }];
    });
    if (!choices.length) { stack.pop(); continue; }
    floor.add(choices[0].middle); floor.add(choices[0].next); stack.push(choices[0].next);
  }
  const player = width + 1, exit = width * (height - 1) - 2;
  const queue: { cell: number; path: Direction[] }[] = [{ cell: player, path: [] }];
  const seen = new Set([player]);
  let shortestPath: Direction[] = [];
  for (let pointer = 0; pointer < queue.length; pointer++) {
    if (queue[pointer].cell === exit) { shortestPath = queue[pointer].path; break; }
    for (const direction of directions) {
      const next = neighbour(queue[pointer].cell, direction, width, height);
      if (!floor.has(next) || seen.has(next)) continue;
      seen.add(next); queue.push({ cell: next, path: [...queue[pointer].path, direction] });
    }
  }
  return { width, height, player, exit, trail: [player], shortestPath, walls: Array.from({ length: width * height }, (_, i) => i).filter(i => !floor.has(i)) };
}

function makePattern(difficulty: number, random: () => number): PatternQuestion {
  const baseDots = integer(random, 0, 3), baseShape = integer(random, 0, 3), baseRotation = integer(random, 0, 3);
  const dotStep = difficulty <= 2 || difficulty >= 5 ? 1 : 0;
  const rotationStep = difficulty >= 3 && difficulty <= 4 || difficulty >= 7 ? 1 : 0;
  const shapeStep = difficulty >= 5 ? 1 : 0;
  const tile = (row: number, col: number): PatternTile => ({
    dots: 1 + (baseDots + dotStep * (row + col)) % 4,
    shape: (baseShape + shapeStep * (row + col)) % 4,
    rotation: (baseRotation + rotationStep * (row + col)) % 4,
  });
  const tiles = Array.from({ length: 8 }, (_, i) => tile(Math.floor(i / 3), i % 3));
  const correct = tile(2, 2);
  const key = (value: PatternTile) => `${value.dots}:${value.shape}:${value.rotation}`;
  const choices = new Map([[key(correct), correct]]);
  while (choices.size < 4) {
    const candidate: PatternTile = { ...correct };
    if (dotStep) candidate.dots = integer(random, 1, 4);
    if (shapeStep) candidate.shape = integer(random, 0, 3);
    if (rotationStep) candidate.rotation = integer(random, 0, 3);
    choices.set(key(candidate), candidate);
  }
  const options = shuffle([...choices.values()], random);
  const rules = [dotStep ? 'The dot count advances 1 → 2 → 3 → 4 → 1.' : '', rotationStep ? 'The small pointer turns one quarter clockwise.' : '', shapeStep ? 'The outline advances circle → square → diamond → hexagon → circle.' : ''].filter(Boolean);
  return { tiles, options, answer: options.findIndex(option => key(option) === key(correct)), rule: `Across each row and down each column: ${rules.join(' ')}` };
}

export function createGame(slug: string, seed: string, difficulty: number): GameState {
  const level = Number.isFinite(difficulty) ? Math.max(1, Math.min(8, Math.floor(difficulty))) : 1;
  const random = seededRandom(`${GENERATOR_VERSION}:${slug}:${seed}:${level}`);
  const common: Common = { seed, difficulty: level, status: 'playing', metrics: { correct: 0, total: 0, moves: 0, mistakes: 0 } };
  switch (slug) {
    case 'memory-cards': {
      const pairCount = [2, 4, 6, 8, 10, 12, 18, 24][level - 1];
      const symbols = shuffle(Array.from({ length: 24 }, (_, index) => index), random).slice(0, pairCount);
      return { ...common, slug, deck: shuffle([...symbols, ...symbols], random), flipped: [], matched: [] };
    }
    case 'sequence-recall': {
      const gridSize = level <= 4 ? 9 : 16;
      const rounds = level <= 4 ? 3 : 4;
      const length = 2 + Math.floor((level - 1) / 2);
      return { ...common, slug, gridSize, sequences: Array.from({ length: rounds }, (_, round) => Array.from({ length: length + round }, () => integer(random, 0, gridSize - 1))), round: 0, cursor: 0, phase: 'preview', lastTile: null };
    }
    case 'sudoku': {
      const puzzle = generateSudoku(level, random);
      return { ...common, slug, ...puzzle, cells: [...puzzle.givens] };
    }
    case 'mental-math': return { ...common, slug, questions: Array.from({ length: 8 + level }, (_, round) => makeMathQuestion(level, round, random)), question: 0, feedback: null };
    case 'maze-runner': return { ...common, slug, ...makeMaze(level, random) };
    case 'sokoban': {
      const puzzle = generateSokoban(level, random);
      return { ...common, slug, ...puzzle, initialBoxes: [...puzzle.boxes], initialPlayer: puzzle.player, history: [], pushes: 0 };
    }
    case 'stroop-challenge': {
      const colorCount = level <= 4 ? 4 : 6;
      const questions = Array.from({ length: 10 + level * 2 }, () => {
        const ink = integer(random, 0, colorCount - 1);
        const word = random() < 0.15 ? ink : (ink + integer(random, 1, colorCount - 1)) % colorCount;
        return { ink, word };
      });
      return { ...common, slug, questions, question: 0, colorCount, feedback: null };
    }
    case 'pattern-matrix': return { ...common, slug, questions: Array.from({ length: 4 + Math.floor(level / 2) }, () => makePattern(level, random)), question: 0, rejected: [] };
    default: throw new Error(`Unknown game: ${slug}`);
  }
}

const validIndex = (index: number | undefined, length: number): index is number => Number.isInteger(index) && index! >= 0 && index! < length;
function attempt(metrics: GameMetrics, correct: boolean): GameMetrics {
  return { correct: metrics.correct + Number(correct), total: metrics.total + 1, moves: metrics.moves + 1, mistakes: metrics.mistakes + Number(!correct) };
}
function spatialMistake<T extends MazeState | SokobanState>(state: T): T {
  return { ...state, metrics: { ...state.metrics, moves: state.metrics.moves + 1, mistakes: state.metrics.mistakes + 1, total: state.metrics.total + 1 } };
}

/** Pure replay reducer. Unsupported, out-of-range and out-of-phase actions are ignored. */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.status !== 'playing' || !action || typeof action.type !== 'string') return state;
  switch (state.slug) {
    case 'memory-cards': {
      if (action.type === 'hide') return state.flipped.length === 2 ? { ...state, flipped: [] } : state;
      if (action.type !== 'flip' || !validIndex(action.index, state.deck.length) || state.flipped.length >= 2 || state.matched.includes(action.index) || state.flipped.includes(action.index)) return state;
      const flipped = [...state.flipped, action.index];
      if (flipped.length === 1) return { ...state, flipped, metrics: { ...state.metrics, moves: state.metrics.moves + 1 } };
      const matchedPair = state.deck[flipped[0]] === state.deck[flipped[1]];
      const metrics = attempt(state.metrics, matchedPair);
      const matched = matchedPair ? [...state.matched, ...flipped] : state.matched;
      return { ...state, flipped: matchedPair ? [] : flipped, matched, metrics, status: matched.length === state.deck.length ? 'won' : 'playing' };
    }
    case 'sequence-recall': {
      if (action.type === 'preview-end') return state.phase === 'preview' ? { ...state, phase: 'input' } : state;
      if (action.type !== 'tap' || state.phase !== 'input' || !validIndex(action.index, state.gridSize)) return state;
      const sequence = state.sequences[state.round];
      if (action.index !== sequence[state.cursor]) {
        const metrics = attempt(state.metrics, false);
        return { ...state, cursor: 0, phase: 'preview', lastTile: action.index, metrics, status: metrics.mistakes >= 3 ? 'lost' : 'playing' };
      }
      if (state.cursor + 1 === sequence.length) {
        const won = state.round + 1 === state.sequences.length;
        return { ...state, cursor: 0, round: won ? state.round : state.round + 1, phase: 'preview', lastTile: action.index, metrics: attempt(state.metrics, true), status: won ? 'won' : 'playing' };
      }
      return { ...state, cursor: state.cursor + 1, lastTile: action.index, metrics: { ...state.metrics, moves: state.metrics.moves + 1 } };
    }
    case 'sudoku': {
      if (action.type !== 'set' || !validIndex(action.index, state.cells.length) || state.givens[action.index] || typeof action.value !== 'number' || !Number.isInteger(action.value) || action.value < 0 || action.value > state.size || state.cells[action.index] === action.value) return state;
      const cells = [...state.cells];
      cells[action.index] = action.value;
      const correct = cells.filter((value, index) => !state.givens[index] && value === state.solution[index]).length;
      const mistake = action.value !== 0 && action.value !== state.solution[action.index];
      const mistakes = state.metrics.mistakes + Number(mistake);
      const metrics = { correct, total: correct + mistakes, moves: state.metrics.moves + 1, mistakes };
      return { ...state, cells, metrics, status: cells.every((value, index) => value === state.solution[index]) ? 'won' : 'playing' };
    }
    case 'mental-math': {
      if (action.type !== 'answer' || typeof action.value !== 'number' || !Number.isFinite(action.value) || !Number.isInteger(action.value) || Math.abs(action.value) > 1_000_000) return state;
      const answer = state.questions[state.question].answer;
      const correct = action.value === answer;
      const metrics = attempt(state.metrics, correct);
      const complete = state.question + 1 === state.questions.length;
      return { ...state, metrics, question: complete ? state.question : state.question + 1, feedback: { correct, answer }, status: complete ? metrics.correct >= Math.ceil(state.questions.length * 0.5) ? 'won' : 'lost' : 'playing' };
    }
    case 'maze-runner': {
      if (action.type !== 'move' || !directions.includes(action.value as Direction)) return state;
      const next = neighbour(state.player, action.value as Direction, state.width, state.height);
      if (next < 0 || state.walls.includes(next)) return spatialMistake(state);
      const won = next === state.exit;
      return { ...state, player: next, trail: [...new Set([...state.trail, next])], metrics: { ...state.metrics, correct: Number(won), total: state.metrics.mistakes + Number(won), moves: state.metrics.moves + 1 }, status: won ? 'won' : 'playing' };
    }
    case 'sokoban': {
      if (action.type === 'undo') {
        const last = state.history[state.history.length - 1];
        if (!last) return state;
        return { ...state, player: last.player, boxes: [...last.boxes], history: state.history.slice(0, -1), metrics: { ...state.metrics, moves: state.metrics.moves + 1 } };
      }
      if (action.type === 'reset') return { ...state, player: state.initialPlayer, boxes: [...state.initialBoxes], history: [], metrics: { ...state.metrics, moves: state.metrics.moves + 1 } };
      if (action.type !== 'move' || !directions.includes(action.value as Direction)) return state;
      const next = neighbour(state.player, action.value as Direction, state.width, state.height);
      if (next < 0 || state.walls.includes(next)) return spatialMistake(state);
      let boxes = state.boxes;
      if (boxes.includes(next)) {
        const beyond = neighbour(next, action.value as Direction, state.width, state.height);
        if (beyond < 0 || state.walls.includes(beyond) || boxes.includes(beyond)) return spatialMistake(state);
        boxes = boxes.map(box => box === next ? beyond : box);
      }
      const won = boxes.every(box => state.targets.includes(box));
      return { ...state, player: next, boxes, history: [...state.history, { player: state.player, boxes: [...state.boxes] }], pushes: state.pushes + Number(boxes !== state.boxes), metrics: { ...state.metrics, correct: Number(won), total: state.metrics.mistakes + Number(won), moves: state.metrics.moves + 1 }, status: won ? 'won' : 'playing' };
    }
    case 'stroop-challenge': {
      if (action.type !== 'answer' || !validIndex(action.index, state.colorCount)) return state;
      const correct = action.index === state.questions[state.question].ink;
      const metrics = attempt(state.metrics, correct);
      const complete = state.question + 1 === state.questions.length;
      return { ...state, metrics, question: complete ? state.question : state.question + 1, feedback: correct, status: complete ? metrics.correct >= Math.ceil(state.questions.length * 0.5) ? 'won' : 'lost' : 'playing' };
    }
    case 'pattern-matrix': {
      if (action.type !== 'answer' || !validIndex(action.index, 4) || state.rejected.includes(action.index)) return state;
      const correct = action.index === state.questions[state.question].answer;
      const metrics = attempt(state.metrics, correct);
      const complete = correct && state.question + 1 === state.questions.length;
      return { ...state, metrics, question: correct && !complete ? state.question + 1 : state.question, rejected: correct ? [] : [...state.rejected, action.index], status: complete ? 'won' : 'playing' };
    }
  }
}

export function getMetrics(state: GameState): GameMetrics { return { ...state.metrics }; }
