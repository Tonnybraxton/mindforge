/** A fixed versioned rotation keeps a day's puzzle identical across clients and servers. */
export function dailyChallenge(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const rotation = ['memory-cards', 'mental-math', 'maze-runner', 'sequence-recall', 'stroop-challenge', 'pattern-matrix', 'sudoku', 'sokoban'];
  return { date, slug: rotation[((day % rotation.length) + rotation.length) % rotation.length], seed: `daily:v1:${date}`, difficulty: 3 + ((day % 4) + 4) % 4, generatorVersion: 1 };
}
