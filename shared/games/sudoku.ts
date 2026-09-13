import { shuffle } from './random';

export interface SudokuPuzzle {
  size: number;
  boxRows: number;
  boxCols: number;
  givens: number[];
  solution: number[];
}

/** MRV backtracking, stopping at the requested limit instead of counting every solution. */
export function countSudokuSolutions(input: number[], size: number, boxRows: number, boxCols: number, limit = 2): number {
  if (input.length !== size * size || boxRows * boxCols !== size) return 0;
  const cells = [...input];
  const allowed = (index: number, value: number): boolean => {
    const row = Math.floor(index / size);
    const col = index % size;
    for (let offset = 0; offset < size; offset++) {
      if (row * size + offset !== index && cells[row * size + offset] === value) return false;
      if (offset * size + col !== index && cells[offset * size + col] === value) return false;
    }
    const top = Math.floor(row / boxRows) * boxRows;
    const left = Math.floor(col / boxCols) * boxCols;
    for (let r = top; r < top + boxRows; r++) for (let c = left; c < left + boxCols; c++) {
      if (r * size + c !== index && cells[r * size + c] === value) return false;
    }
    return true;
  };
  for (let index = 0; index < cells.length; index++) {
    if (!Number.isInteger(cells[index]) || cells[index] < 0 || cells[index] > size || (cells[index] !== 0 && !allowed(index, cells[index]))) return 0;
  }
  const search = (): number => {
    let nextIndex = -1;
    let options: number[] = [];
    for (let index = 0; index < cells.length; index++) {
      if (cells[index]) continue;
      const candidates = Array.from({ length: size }, (_, n) => n + 1).filter(value => allowed(index, value));
      if (!candidates.length) return 0;
      if (nextIndex === -1 || candidates.length < options.length) { nextIndex = index; options = candidates; }
      if (options.length === 1) break;
    }
    if (nextIndex === -1) return 1;
    let count = 0;
    for (const option of options) {
      cells[nextIndex] = option;
      count += search();
      if (count >= limit) break;
    }
    cells[nextIndex] = 0;
    return Math.min(count, limit);
  };
  return search();
}

export function generateSudoku(difficulty: number, random: () => number): SudokuPuzzle {
  const size = difficulty <= 2 ? 4 : difficulty <= 4 ? 6 : 9;
  const boxRows = size === 9 ? 3 : 2;
  const boxCols = size / boxRows;
  const range = (length: number) => Array.from({ length }, (_, index) => index);
  const rows = shuffle(range(size / boxRows), random).flatMap(group => shuffle(range(boxRows), random).map(row => group * boxRows + row));
  const cols = shuffle(range(size / boxCols), random).flatMap(group => shuffle(range(boxCols), random).map(col => group * boxCols + col));
  const digits = shuffle(range(size).map(value => value + 1), random);
  const solution = rows.flatMap(row => cols.map(col => digits[(boxCols * (row % boxRows) + Math.floor(row / boxRows) + col) % size]));
  const givens = [...solution];
  const target = Math.floor(size * size * (0.38 + difficulty * 0.035));
  let removed = 0;
  for (const index of shuffle(range(size * size), random)) {
    const value = givens[index];
    givens[index] = 0;
    if (countSudokuSolutions(givens, size, boxRows, boxCols) !== 1) givens[index] = value;
    else removed++;
    if (removed >= target) break;
  }
  return { size, boxRows, boxCols, givens, solution };
}
