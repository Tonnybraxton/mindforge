import { defaultTypingConfig, typingModes, type KeyStat, type TypingConfig, type TypingEvent, type TypingMetrics, type TypingState, type TypingSummary } from './types';
import { arcadeModes, typingArcade } from './arcade';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const round = (n: number) => Math.round(n * 10) / 10;
export function normalizeTypingConfig(input: Partial<TypingConfig>): TypingConfig {
  const config = { ...defaultTypingConfig, ...input };
  config.mode = typingModes.includes(config.mode) ? config.mode : 'test';
  config.seed = String(config.seed || 'practice').slice(0, 128);
  config.difficulty = Math.round(clamp(config.difficulty, 1, 8));
  config.duration = config.duration === 0 ? 0 : Math.round(clamp(config.duration, 15, 1800));
  config.wordCount = Math.round(clamp(config.wordCount, 0, 1000));
  config.targetWpm = Math.round(clamp(config.targetWpm, 10, 250));
  if (!['strict', 'free', 'no-backspace', 'perfect'].includes(config.correction)) config.correction = 'free';
  if (arcadeModes.includes(config.mode)) { config.correction = 'strict'; config.ranked = false; config.duration ||= 60; }
  config.focusKeys = config.focusKeys?.slice(0, 20).map(k => k.slice(0, 1));
  config.focusPatterns = config.focusPatterns?.slice(0, 20).map(k => k.slice(0, 4));
  return config;
}
export function createTypingState(config: TypingConfig, text: string): TypingState {
  return { config: normalizeTypingConfig(config), text, typed: '', events: [], status: 'ready', elapsed: 0 };
}
export function applyTypingEvent(state: TypingState, event: TypingEvent): TypingState {
  if (state.status === 'complete' || !Number.isFinite(event.at) || event.at < 0 || event.at < (state.events.at(-1)?.at ?? 0)) return state;
  if (state.config.duration && event.at > state.config.duration * 1000) return state;
  let typed = state.typed;
  if (event.type === 'backspace') {
    if (!typed.length || state.config.correction === 'no-backspace') return state;
    typed = typed.slice(0, -1);
  } else if (event.type === 'input') {
    if (!event.value || event.value.length !== 1 || !/[\x20-\x7e\n\t]/.test(event.value)) return state;
    if (typed.length >= state.text.length || (state.config.correction === 'strict' && typed.length && typed.at(-1) !== state.text[typed.length - 1])) return state;
    typed += event.value;
  } else return state;
  const failedPerfect = state.config.correction === 'perfect' && event.type === 'input' && event.value !== state.text[state.typed.length];
  return { ...state, typed, events: [...state.events, event], elapsed: event.at / 1000, status: failedPerfect || (!state.config.duration && typed.length >= state.text.length && (state.config.correction !== 'strict' || typed === state.text)) ? 'complete' : 'playing' };
}
function analyze(state: TypingState, elapsed = state.elapsed) {
  const keyStats: Record<string, KeyStat> = {}, bigrams: Record<string, KeyStat> = {}, trigrams: Record<string, KeyStat> = {};
  let typed = '', correct = 0, incorrect = 0, corrected = 0, cleanStreak = 0, longest = 0, previousAt = 0;
  const intervals: number[] = [], correctTimes: number[] = [], timeline: { at: number; index: number }[] = [];
  const record = (stats: Record<string, KeyStat>, key: string, right: boolean, latency: number) => {
    const row = stats[key] ??= { key, attempts: 0, correct: 0, incorrect: 0, totalLatency: 0, samples: 0 };
    row.attempts++; row.correct += Number(right); row.incorrect += Number(!right);
    if (latency >= 0 && latency <= 10000) { row.totalLatency += latency; row.samples++; }
  };
  for (const event of state.events) {
    if (event.type === 'backspace') {
      if (typed.length && typed.at(-1) !== state.text[typed.length - 1]) corrected++;
      typed = typed.slice(0, -1); cleanStreak = 0;
    } else {
      const index = typed.length, expected = state.text[index] ?? '', right = event.value === expected;
      const latency = event.at - previousAt;
      record(keyStats, expected, right, latency);
      if (index > 0) record(bigrams, state.text.slice(index - 1, index + 1), right, latency);
      if (index > 1) record(trigrams, state.text.slice(index - 2, index + 1), right, latency);
      correct += Number(right); incorrect += Number(!right); cleanStreak = right ? cleanStreak + 1 : 0; longest = Math.max(longest, cleanStreak);
      if (right) correctTimes.push(event.at);
      if (previousAt && latency > 0) intervals.push(latency);
      typed += event.value; previousAt = event.at;
    }
    if (!timeline.length || event.at - timeline.at(-1)!.at >= 150 || typed.length === state.text.length) timeline.push({ at: event.at, index: typed.length });
  }
  const duration = Math.max(0, elapsed), minutes = duration / 60, total = correct + incorrect;
  const retainedCorrect = Array.from(typed).filter((c, i) => c === state.text[i]).length;
  let cleanCharacters = 0;
  for (const match of typed.matchAll(/\S+(?:\s|$)/g)) { const part = match[0]; if (state.text.slice(match.index, match.index + part.length) === part && (/\s$/.test(part) || typed.length === state.text.length)) cleanCharacters += part.length; }
  const mean = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
  const deviation = mean ? Math.sqrt(intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length) : 0;
  const burst = (seconds: number) => { if (duration < seconds) return 0; let best = 0, left = 0; for (let right = 0; right < correctTimes.length; right++) { while (correctTimes[right] - correctTimes[left] >= seconds * 1000) left++; best = Math.max(best, right - left + 1); } return round(best / 5 / (seconds / 60)); };
  const metrics: TypingMetrics = {
    rawWpm: minutes ? round(total / 5 / minutes) : 0, adjustedWpm: minutes ? round(retainedCorrect / 5 / minutes) : 0,
    cleanWpm: minutes ? round(cleanCharacters / 5 / minutes) : 0, cpm: minutes ? round(total / minutes) : 0,
    accuracy: total ? round(correct / total * 100) : 0, errorRate: total ? round(incorrect / total * 100) : 0,
    correctCharacters: correct, incorrectCharacters: incorrect, correctedErrors: corrected, uncorrectedErrors: typed.length - retainedCorrect,
    charactersTyped: total, consistency: intervals.length > 1 ? round(100 / (1 + deviation / mean)) : 0,
    rhythm: round(mean), reactionTime: state.events.find(e => e.type === 'input')?.at ?? 0, duration: round(duration),
    longestCleanStreak: longest, burst5: burst(5), burst10: burst(10), progress: Math.min(100, round(typed.length / Math.max(1, state.text.length) * 100)),
  };
  return { metrics, keyStats, bigrams, trigrams, timeline };
}
export function typingMetrics(state: TypingState, elapsedSeconds?: number): TypingMetrics { return analyze(state, elapsedSeconds).metrics; }
export function finishTyping(state: TypingState, elapsedSeconds = state.elapsed): TypingSummary {
  const { metrics, ...stats } = analyze(state, elapsedSeconds);
  const complete = state.config.duration ? elapsedSeconds >= state.config.duration : state.typed.length === state.text.length;
  const arcade = arcadeModes.includes(state.config.mode) ? typingArcade(state, elapsedSeconds) : null;
  const speedPassed = state.config.region !== 'typing-speed-circuit' || metrics.adjustedWpm >= state.config.targetWpm;
  const passed = complete && speedPassed && (!arcade || arcade.lives > 0 && arcade.defeated >= 5) && metrics.accuracy >= (state.config.correction === 'perfect' ? 100 : state.config.lessonId || state.config.region ? 90 : 80) && metrics.charactersTyped >= 2;
  const eligible = passed && elapsedSeconds >= 5 && metrics.charactersTyped >= 10;
  return { ...metrics, ...stats, config: state.config, passed,
    score: passed ? Math.round(metrics.adjustedWpm * (metrics.accuracy / 100) ** 2 * (8 + state.config.difficulty) * (.75 + metrics.consistency / 400) + (arcade?.bonus ?? 0)) : 0,
    xp: eligible ? Math.min(600, Math.round((15 + state.config.difficulty * 5 + Math.min(600, elapsedSeconds) / 6) * metrics.accuracy / 100)) : 0,
  };
}
export function replayTyping(config: TypingConfig, text: string, events: TypingEvent[], duration: number): TypingSummary {
  let state = createTypingState(config, text);
  for (const event of events) { const next = applyTypingEvent(state, event); if (next === state) throw new Error('Invalid typing event or correction.'); state = next; }
  return finishTyping(state, duration);
}
export function validateTypingReplay(config: TypingConfig, text: string, events: TypingEvent[], duration: number, wallSeconds = duration): TypingSummary {
  if (!Array.isArray(events) || events.length < 1 || events.length > 50000 || !Number.isFinite(duration) || duration < 1 || duration > 1900) throw new Error('Invalid typing session length.');
  if (!Number.isFinite(wallSeconds) || wallSeconds + 2 < duration || wallSeconds > 86400) throw new Error('Session timing does not match the server.');
  if (events.some(e => !Number.isFinite(e.at) || e.at > duration * 1000 + 100 || (e.type === 'input' && e.value?.length !== 1))) throw new Error('Invalid keystroke timing.');
  const summary = replayTyping(config, text, events, duration);
  if (arcadeModes.includes(config.mode)) { const status = typingArcade({ config, text, typed: '', events, elapsed: duration, status: 'complete' }, duration); if (status.diedAt !== null && (events.at(-1)!.at > status.diedAt * 1000 || duration > status.diedAt + 1)) throw new Error('Arcade input continues after the base was lost.'); }
  if (config.ranked) {
    const keys = events.filter(e => e.type === 'input');
    const zeroIntervals = keys.slice(1).filter((e, i) => e.at - keys[i].at < 8).length;
    if (duration < 15 || keys.length < 20 || summary.accuracy < 95 || !summary.passed || summary.rawWpm > 250 || zeroIntervals > Math.max(1, keys.length * .03)) throw new Error('Ranked runs require individual keystrokes, plausible timing, completion, and at least 95% accuracy.');
    if (wallSeconds - duration > 8 || (config.duration > 0 && Math.abs(duration - config.duration) > 1)) throw new Error('Ranked timers cannot be paused or ended early.');
  }
  return summary;
}
