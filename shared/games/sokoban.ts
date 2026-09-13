import { integer, shuffle } from './random';

export const directions = ['up', 'right', 'down', 'left'] as const;
export type Direction = typeof directions[number];
export interface SokobanPuzzle { width: number; height: number; walls: number[]; targets: number[]; boxes: number[]; player: number; solution: Direction[]; }

export function neighbour(position: number, direction: Direction, width: number, height: number): number {
  const row = Math.floor(position / width), col = position % width;
  if (direction === 'up') return row > 0 ? position - width : -1;
  if (direction === 'down') return row < height - 1 ? position + width : -1;
  if (direction === 'left') return col > 0 ? position - 1 : -1;
  return col < width - 1 ? position + 1 : -1;
}

export function solveSokoban(puzzle: Omit<SokobanPuzzle, 'solution'>, maxStates = 120000): Direction[] | null {
  const walls = new Set(puzzle.walls);
  const key = (player: number, boxes: number[]) => `${player}:${[...boxes].sort((a, b) => a - b).join(',')}`;
  const queue: { player: number; boxes: number[]; parent: number; direction?: Direction }[] = [{ player: puzzle.player, boxes: [...puzzle.boxes], parent: -1 }];
  const seen = new Set([key(puzzle.player, puzzle.boxes)]);
  for (let cursor = 0; cursor < queue.length && cursor < maxStates; cursor++) {
    const current = queue[cursor];
    if (current.boxes.every(box => puzzle.targets.includes(box))) {
      const result: Direction[] = [];
      let pointer = cursor;
      while (queue[pointer].parent !== -1) { result.push(queue[pointer].direction!); pointer = queue[pointer].parent; }
      return result.reverse();
    }
    for (const direction of directions) {
      const next = neighbour(current.player, direction, puzzle.width, puzzle.height);
      if (next < 0 || walls.has(next)) continue;
      let boxes = current.boxes;
      if (boxes.includes(next)) {
        const beyond = neighbour(next, direction, puzzle.width, puzzle.height);
        if (beyond < 0 || walls.has(beyond) || boxes.includes(beyond)) continue;
        boxes = boxes.map(box => box === next ? beyond : box);
      }
      const stateKey = key(next, boxes);
      if (seen.has(stateKey)) continue;
      seen.add(stateKey);
      queue.push({ player: next, boxes, parent: cursor, direction });
    }
  }
  return null;
}

/** Start solved, then legally pull boxes backwards. Reversing the walk proves solvability. */
export function generateSokoban(difficulty: number, random: () => number): SokobanPuzzle {
  const width = difficulty <= 4 ? 6 : 7, height = 6;
  const walls = Array.from({ length: width * height }, (_, index) => index).filter(index => index < width || index >= width * (height - 1) || index % width === 0 || index % width === width - 1);
  const floor = Array.from({ length: width * height }, (_, index) => index).filter(index => !walls.includes(index));
  const interior = floor.filter(index => index % width > 1 && index % width < width - 2 && Math.floor(index / width) > 1 && Math.floor(index / width) < height - 2);
  const count = difficulty <= 2 ? 1 : difficulty <= 5 ? 2 : 3;
  const targets = shuffle(interior, random).slice(0, count);
  let boxes = [...targets];
  let player = shuffle(floor.filter(index => !boxes.includes(index)), random)[0];
  const reverse: Direction[] = [];
  for (let step = 0; step < 55 + difficulty * 24; step++) {
    const candidates = shuffle(directions, random).flatMap(direction => {
      const next = neighbour(player, direction, width, height);
      if (walls.includes(next) || next < 0 || boxes.includes(next)) return [];
      const opposite = directions[(directions.indexOf(direction) + 2) % 4];
      const behind = neighbour(player, opposite, width, height);
      return [{ next, direction, opposite, behind, pull: boxes.includes(behind) }];
    });
    if (!candidates.length) break;
    const pulls = candidates.filter(candidate => candidate.pull);
    const chosen = pulls.length && random() < 0.85 ? pulls[integer(random, 0, pulls.length - 1)] : candidates[0];
    if (chosen.pull) boxes = boxes.map(box => box === chosen.behind ? player : box);
    player = chosen.next;
    reverse.push(chosen.opposite);
  }
  if (boxes.every(box => targets.includes(box))) {
    // A guaranteed legal one-crate challenge if an unlucky walk returned to the solved state.
    const target = 2 * width + 2;
    return { width, height, walls, targets: [target], boxes: [target + 1], player: target + 2, solution: ['left'] };
  }
  const puzzle = { width, height, walls, targets, boxes, player };
  return { ...puzzle, solution: solveSokoban(puzzle) ?? reverse.reverse() };
}
