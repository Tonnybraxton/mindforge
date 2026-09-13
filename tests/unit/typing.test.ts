import { describe, expect, it } from 'vitest';
import { applyTypingEvent, createTypingState, finishTyping, normalizeTypingConfig, replayTyping, typingMetrics, validateTypingReplay } from '../../shared/typing/engine';
import { baseKeyFor, campaignTypingConfig, codeLanguages, dailyTypingConfig, fingerForKey, generateTypingText, shiftForKey, typingLessons, typingRegions, typingWorkout } from '../../shared/typing/content';
import { summarizeTyping, typingAchievementProgress, typingAchievements, typingRank } from '../../shared/typing/analytics';
import { typingArcade } from '../../shared/typing/arcade';
import { defaultTypingConfig, type TypingConfig, type TypingEvent, type TypingSummary } from '../../shared/typing/types';
import type { GameResult } from '../../shared/contracts';
import { generateWorkout } from '../../shared/workout';

const config = (patch: Partial<TypingConfig> = {}): TypingConfig => ({ ...defaultTypingConfig, duration: 0, ...patch });
const events = (text: string, interval = 250): TypingEvent[] => Array.from(text, (value, i) => ({ type: 'input', value, at: (i + 1) * interval }));
const result = (summary: TypingSummary, date = '2026-09-12T12:00:00Z'): GameResult => ({ id: crypto.randomUUID(), slug: 'typing-academy', seed: summary.config.seed, generatorVersion: 1, difficulty: summary.config.difficulty, score: summary.score, xp: summary.xp, accuracy: summary.accuracy, mistakes: summary.incorrectCharacters, moves: summary.charactersTyped, duration: summary.duration, completedAt: date, verified: false, typing: summary });

describe('typing metrics and correction policies', () => {
  it('uses five-character words, accurate retained text, and input-only accuracy', () => {
    const summary = replayTyping(config(), 'hello world', events('hello world', 1000), 60);
    expect(summary).toMatchObject({ rawWpm: 2.2, adjustedWpm: 2.2, cleanWpm: 2.2, cpm: 11, accuracy: 100, incorrectCharacters: 0, longestCleanStreak: 11, consistency: 100, rhythm: 1000, reactionTime: 1000, passed: true });
  });
  it('keeps corrected errors in accuracy history without penalizing retained WPM', () => {
    const input: TypingEvent[] = [{ type: 'input', value: 'x', at: 500 }, { type: 'backspace', at: 1000 }, ...events('abc', 1000).map(e => ({ ...e, at: e.at + 1000 }))];
    expect(replayTyping(config(), 'abc', input, 60)).toMatchObject({ charactersTyped: 4, correctCharacters: 3, incorrectCharacters: 1, correctedErrors: 1, uncorrectedErrors: 0, accuracy: 75, adjustedWpm: .6, rawWpm: .8 });
  });
  it('free flow retains mistakes and excludes incorrect words from clean WPM', () => {
    expect(replayTyping(config(), 'cat dog', events('car dog'), 60)).toMatchObject({ incorrectCharacters: 1, uncorrectedErrors: 1, cleanWpm: .6, adjustedWpm: 1.2 });
  });
  it('strict mode requires backspace before continuing after a mistake', () => {
    let state = createTypingState(config({ correction: 'strict' }), 'fj');
    state = applyTypingEvent(state, { type: 'input', value: 'x', at: 100 });
    expect(applyTypingEvent(state, { type: 'input', value: 'j', at: 200 })).toBe(state);
    state = applyTypingEvent(state, { type: 'backspace', at: 300 });
    state = applyTypingEvent(state, { type: 'input', value: 'f', at: 400 });
    expect(state.typed).toBe('f');
  });
  it('no-backspace rejects deletion, while perfect mode ends on the first mistake', () => {
    let state = createTypingState(config({ correction: 'no-backspace' }), 'abc');
    state = applyTypingEvent(state, { type: 'input', value: 'a', at: 100 });
    expect(applyTypingEvent(state, { type: 'backspace', at: 200 })).toBe(state);
    const perfect = applyTypingEvent(createTypingState(config({ correction: 'perfect' }), 'abc'), { type: 'input', value: 'x', at: 100 });
    expect(perfect.status).toBe('complete'); expect(finishTyping(perfect, 10).passed).toBe(false);
  });
  it('supports newline and tabs but rejects multi-character input and nonmonotonic timestamps', () => {
    const state = createTypingState(config(), 'a\n\tb');
    expect(replayTyping(state.config, state.text, events(state.text), 10).accuracy).toBe(100);
    expect(applyTypingEvent(state, { type: 'input', value: 'ab', at: 20 })).toBe(state);
    const changed = applyTypingEvent(state, { type: 'input', value: 'a', at: 100 });
    expect(applyTypingEvent(changed, { type: 'input', value: '\n', at: 99 })).toBe(changed);
  });
  it('finishes timed practice only at its full duration and grants no XP for trivial input', () => {
    const cfg = config({ duration: 60 });
    const state = events('hello world').reduce(applyTypingEvent, createTypingState(cfg, 'hello world and more'));
    expect(finishTyping(state, 59).passed).toBe(false); expect(finishTyping(state, 60).passed).toBe(true);
    expect(replayTyping(config(), 'hi', events('hi'), 10).xp).toBe(0);
    expect(typingMetrics(createTypingState(config(), 'abc')).rawWpm).toBe(0);
  });
  it('computes clean bursts and character transition aggregates', () => {
    const text = 'the the the the the the the the';
    const summary = replayTyping(config(), text, events(text, 200), 10);
    expect(summary.burst5).toBe(60); expect(summary.bigrams.th.attempts).toBe(8); expect(summary.trigrams.the.attempts).toBe(8);
  });
  it('requires speed-circuit targets as well as accuracy', () => {
    const cfg = campaignTypingConfig('typing-speed-circuit', 1), text = generateTypingText(cfg);
    expect(replayTyping(cfg, text, events(text.slice(0, 20), 500), 60).passed).toBe(false);
  });
});

describe('typing content, adaptation, and progress', () => {
  it('has progressive home-row lessons and deterministic restricted-key content', () => {
    expect(typingLessons.slice(0, 5).map(l => l.keys)).toEqual(['fj', 'dk', 'sl', 'a;', 'gh']);
    for (const lesson of typingLessons) {
      const cfg = config({ mode: 'lesson', lessonId: lesson.id, seed: 'fixed' }); const text = generateTypingText(cfg);
      expect(text).toBe(generateTypingText(cfg)); expect([...text].every(c => lesson.keys.includes(c) || c === ' ')).toBe(true);
    }
  });
  it('maps shifted keys to the right key and opposite hand', () => {
    expect(baseKeyFor('')).toBe(''); expect(baseKeyFor(':')).toBe(';'); expect(baseKeyFor('|')).toBe('\\'); expect(baseKeyFor('"')).toBe("'");
    expect(fingerForKey('P')).toBe('Right pinky'); expect(shiftForKey('P')).toBe('Left Shift'); expect(shiftForKey('F')).toBe('Right Shift'); expect(fingerForKey(' ')).toBe('Thumbs');
  });
  it('produces 16 code languages with exact indentation and no evaluated code', () => {
    expect(codeLanguages).toHaveLength(16);
    for (const language of codeLanguages) expect(generateTypingText(config({ mode: 'code', language }))).toBeTruthy();
    expect(generateTypingText(config({ mode: 'code', language: 'Python', indentation: 'tab' }))).toContain('\t');
    expect(generateTypingText(config({ mode: 'code', language: 'Python', indentation: '2' }))).not.toContain('\t');
  });
  it('offers 735 valid seeded campaign levels across ten regions', () => {
    expect(typingRegions).toHaveLength(10); expect(typingRegions.reduce((n, r) => n + r.levels, 0)).toBe(735);
    for (const region of typingRegions) for (let level = 1; level <= region.levels; level++) { const cfg = campaignTypingConfig(region.id, level); expect(cfg.difficulty).toBeLessThanOrEqual(8); expect(generateTypingText(cfg).length).toBeGreaterThan(10); }
    expect(() => campaignTypingConfig('missing', 1)).toThrow(); expect(() => campaignTypingConfig('word-city', 76)).toThrow();
  });
  it('uses a common daily seed and honors exact word counts', () => {
    expect(dailyTypingConfig('2026-09-12').seed).toBe('typing-daily:v1:2026-09-12');
    expect(generateTypingText(config({ mode: 'words', wordCount: 1000 })).split(' ')).toHaveLength(1000);
    expect(normalizeTypingConfig({ duration: 9000, difficulty: -1, wordCount: 9999 })).toMatchObject({ duration: 1800, difficulty: 1, wordCount: 1000 });
  });
  it('detects weak keys and emphasizes their contextual words', () => {
    const summary = replayTyping(config(), 'bbb aaa', events('xxx aaa'), 10), stats = summarizeTyping([result(summary)]);
    expect(stats.weakKeys[0].key).toBe('b'); expect(stats.weakKeys[0].accuracy).toBe(0);
    const text = generateTypingText(config({ mode: 'adaptive', focusKeys: ['b'], wordCount: 1000 }));
    expect(text.split(' ').filter(w => w.includes('b')).length).toBeGreaterThan(650);
  });
  it('keeps daily workouts stable after a same-day session and includes typing in the shared workout', () => {
    const before = typingWorkout([], 10, '2026-09-12'); const summary = replayTyping(config(), 'hello world', events('hello world'), 15);
    expect(typingWorkout([result(summary)], 10, '2026-09-12')).toEqual(before); expect(before.map(c => c.duration)).toEqual([120, 120, 120, 120, 120]);
    expect(generateWorkout([], 10, '2026-09-12').some(c => c.slug === 'typing-academy')).toBe(true);
  });
  it('has at least 50 typing achievements, ranks, and real performance records', () => {
    expect(typingAchievements.length).toBeGreaterThanOrEqual(50); expect(new Set(typingAchievements.map(a => a.id)).size).toBe(typingAchievements.length);
    expect(typingRank(79)).toBe('Advanced Typist'); expect(typingRank(120)).toBe('Typing Grandmaster');
    const summary = replayTyping(config(), 'hello world', events('hello world', 500), 15), rows = [result(summary)];
    expect(summarizeTyping(rows).bests).toHaveLength(1); expect(typingAchievementProgress(typingAchievements[0], rows)).toBe(1);
  });
});

describe('ranked replay validation and arcade rules', () => {
  it('accepts plausible individual ranked inputs', () => {
    const cfg = config({ duration: 15, ranked: true }), text = 'the and that have with this from they';
    expect(validateTypingReplay(cfg, text, events(text, 350), 15, 15.5).passed).toBe(true);
  });
  it('rejects bulk input, impossible duration, low accuracy, pauses, and future events', () => {
    const cfg = config({ duration: 15, ranked: true }), text = 'the and that have with this from they';
    expect(() => validateTypingReplay(cfg, text, events(text, 1), 15)).toThrow();
    expect(() => validateTypingReplay(cfg, text, events(text, 350), 15, 1)).toThrow();
    expect(() => validateTypingReplay(cfg, text, events(text.replaceAll('t', 'x'), 350), 15)).toThrow();
    expect(() => validateTypingReplay(cfg, text, events(text, 350), 15, 30)).toThrow();
    expect(() => validateTypingReplay(cfg, text, events(text, 1000), 15)).toThrow();
  });
  it('ends an abandoned arcade run after three real impacts', () => {
    const state = createTypingState(config({ mode: 'falling', duration: 60 }), 'cat dog sun book home the and');
    expect(typingArcade(state, 0).lives).toBe(3); const lost = typingArcade(state, 60);
    expect(lost.lives).toBe(0); expect(lost.impacts).toBe(3); expect(lost.diedAt).toBeGreaterThan(0); expect(finishTyping(state, 60).passed).toBe(false);
  });
  it('awards a precision shield, spends it on impact, and identifies bosses', () => {
    const text = 'cat dog sun book home the and room next';
    const state = events('cat dog sun book home ', 180).reduce(applyTypingEvent, createTypingState(config({ mode: 'defense', duration: 60 }), text));
    const status = typingArcade(state, state.elapsed); expect(status).toMatchObject({ defeated: 5, shields: 1, lives: 3, combo: 5 });
    expect(typingArcade(state, status.deadline + .1)).toMatchObject({ shields: 0, lives: 3, impacts: 1 });
    const boss = events('cat dog sun book home the and ', 180).reduce(applyTypingEvent, createTypingState(config({ mode: 'space', duration: 60 }), text));
    expect(typingArcade(boss, boss.elapsed).boss).toBe(true);
  });
});
