import type { SavedRun } from '../stores/player';

export function savedRunUrl(run: SavedRun): string {
  const params = new URLSearchParams({ seed: run.state.seed, difficulty: String(run.state.difficulty), mode: run.context.mode });
  if (run.context.date) params.set('date', run.context.date);
  if (run.context.world) params.set('world', run.context.world);
  if (run.context.level) params.set('level', String(run.context.level));
  return `/games/${run.state.slug}?${params}`;
}
