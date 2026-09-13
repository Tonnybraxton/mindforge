import type { TypingState } from './types';

export const arcadeModes = ['falling', 'defense', 'space'];
export interface ArcadeStatus { lives: number; shields: number; defeated: number; combo: number; bestCombo: number; wave: number; boss: boolean; impacts: number; progress: number; deadline: number; diedAt: number | null; bonus: number; }
/** Deterministic encounter replay. Missed targets strike the base and return for another attempt. */
export function typingArcade(state: TypingState, elapsed: number): ArcadeStatus {
  let typed = '', lives = 3, shields = 0, defeated = 0, combo = 0, bestCombo = 0, impacts = 0, cleanWord = true, bonus = 0, diedAt: number | null = null;
  const words = state.text.split(' ');
  const budget = () => Math.max(2, (words[defeated]?.length ?? 5) * 60 / (5 * (18 + state.config.difficulty * 5 + Math.floor(defeated / 8) * 4)) + 2) * ((defeated + 1) % 8 === 0 ? 1.6 : 1);
  let started = 0, deadline = budget();
  const advance = (time: number) => {
    while (time >= deadline && lives > 0) {
      impacts++; combo = 0; cleanWord = false;
      if (shields) shields--; else lives--;
      if (!lives) { diedAt = deadline; return; }
      started = deadline; deadline += budget();
    }
  };
  for (const event of state.events) {
    advance(event.at / 1000); if (!lives) break;
    if (event.type === 'backspace') { typed = typed.slice(0, -1); cleanWord = false; continue; }
    if (event.value !== state.text[typed.length]) { cleanWord = false; combo = 0; }
    typed += event.value;
    if (event.value === ' ' && typed === state.text.slice(0, typed.length)) {
      defeated++; combo = cleanWord ? combo + 1 : 0; bestCombo = Math.max(bestCombo, combo);
      bonus += (defeated % 8 === 0 ? 100 : 20) * (1 + Math.min(5, combo) / 5);
      if (combo && combo % 5 === 0) shields = Math.min(2, shields + 1);
      cleanWord = true; started = event.at / 1000; deadline = started + budget();
    }
  }
  advance(elapsed);
  return { lives, shields, defeated, combo, bestCombo, wave: 1 + Math.floor(defeated / 8), boss: (defeated + 1) % 8 === 0, impacts, progress: Math.min(1, Math.max(0, (elapsed - started) / (deadline - started))), deadline, diedAt, bonus: Math.round(bonus) };
}
