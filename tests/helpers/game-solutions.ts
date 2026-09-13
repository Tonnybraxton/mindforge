import { expect } from 'vitest';
import type { GameState, PatternTile } from '../../shared/games/engine';
import type { GameAction } from '../../shared/contracts';
function answerEquation(prompt: string): number {
  const numbers = prompt.match(/\d+/g)!.map(Number);
  const [a, b, c] = numbers;
  if (prompt.includes('+')) return a + b;
  if (prompt.includes('−')) return a - b;
  if (prompt.includes('×')) return a * b;
  if (prompt.includes('÷')) return a / b;
  if (prompt.includes('%')) return a * b / 100;
  if (prompt.includes('/')) return a / b * c;
  throw new Error(`Unsupported equation: ${prompt}`);
}

function missingTile(tiles: PatternTile[]): PatternTile {
  // Continue the final row's observed change, independently of the stored answer.
  const first = tiles[6], second = tiles[7];
  return {
    dots: ((2 * (second.dots - 1) - (first.dots - 1)) % 4 + 4) % 4 + 1,
    shape: ((2 * second.shape - first.shape) % 4 + 4) % 4,
    rotation: ((2 * second.rotation - first.rotation) % 4 + 4) % 4,
  };
}

export function winningActions(state: GameState): GameAction[] {
  switch (state.slug) {
    case 'memory-cards': {
      const pairs = new Map<number, number[]>();
      state.deck.forEach((symbol, index) => pairs.set(symbol, [...(pairs.get(symbol) ?? []), index]));
      expect([...pairs.values()].every(pair => pair.length === 2)).toBe(true);
      return [...pairs.values()].flatMap(pair => pair.map(index => ({ type: 'flip', index })));
    }
    case 'sequence-recall': return state.sequences.flatMap(sequence => [{ type: 'preview-end' }, ...sequence.map(index => ({ type: 'tap', index }))]);
    case 'sudoku': return state.solution.flatMap((value, index) => state.givens[index] ? [] : [{ type: 'set', index, value }]);
    case 'mental-math': return state.questions.map(question => {
      const value = answerEquation(question.prompt);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBe(question.answer);
      return { type: 'answer', value };
    });
    case 'maze-runner': return state.shortestPath.map(value => ({ type: 'move', value }));
    case 'sokoban': return state.solution.map(value => ({ type: 'move', value }));
    case 'stroop-challenge': return state.questions.map(question => ({ type: 'answer', index: question.ink }));
    case 'pattern-matrix': return state.questions.map(question => {
      expect(new Set(question.options.map(option => JSON.stringify(option))).size).toBe(4);
      const correct = missingTile(question.tiles);
      const index = question.options.findIndex(option => JSON.stringify(option) === JSON.stringify(correct));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBe(question.answer);
      return { type: 'answer', index };
    });
  }
}
