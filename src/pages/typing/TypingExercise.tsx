import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, Keyboard as KeyboardIcon, Pause, Play, RotateCcw, Settings2, Sparkles, Trophy, Volume2 } from 'lucide-react';
import type { GameResult } from '../../../shared/contracts';
import type { TypingConfig, TypingState, TypingSummary } from '../../../shared/typing/types';
import { applyTypingEvent, createTypingState, finishTyping, typingMetrics } from '../../../shared/typing/engine';
import { generateTypingText, typingLessons } from '../../../shared/typing/content';
import { summarizeTyping } from '../../../shared/typing/analytics';
import { storyChapters, typingQuestion } from '../../../shared/typing/challenges';
import { typingArcade } from '../../../shared/typing/arcade';
import { api } from '../../lib/api';
import { playSound } from '../../lib/audio';
import { formatTime } from '../../lib/utils';
import { usePlayer, usePlayerStore } from '../../stores/player';
import { Button, Modal } from '../../components/ui';
import { Keyboard } from './Keyboard';
import { defaultTypingProfile, typingUrl, type TypingPreferences } from './model';

export interface RaceSession { sessionId: string; config: TypingConfig; text: string; startedAt: string; }
export function TypingExercise({ config, raceSession, onProgress, onComplete }: { config: TypingConfig; raceSession?: RaceSession; onProgress?: (state: TypingState, elapsed: number) => void; onComplete?: () => void }) {
  const player = usePlayer(), store = usePlayerStore(), navigate = useNavigate();
  const ownerId = store.activeId;
  const profile = player.typing ?? defaultTypingProfile, preferences = profile.preferences;
  const saved = profile.draft?.state.config.seed === config.seed && !config.ranked ? profile.draft : undefined;
  const [state, setState] = useState<TypingState>(() => saved?.state || createTypingState(config, raceSession?.text || generateTypingText(config)));
  const stateRef = useRef(state), inputRef = useRef<HTMLTextAreaElement>(null), clockRef = useRef({ start: 0, base: saved?.state.elapsed ?? 0 });
  const [id, setId] = useState(saved?.id || raceSession?.sessionId || crypto.randomUUID());
  const sessionRef = useRef(saved?.sessionId || raceSession?.sessionId);
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false), [busy, setBusy] = useState(false), [elapsed, setElapsed] = useState(saved?.state.elapsed ?? 0);
  const [notice, setNotice] = useState(''), [settings, setSettings] = useState(false), [result, setResult] = useState<GameResult | null>(null);
  const [pressed, setPressed] = useState(''), [wrong, setWrong] = useState(false), [preview, setPreview] = useState(false), [assisted, setAssisted] = useState(false);
  const completed = useRef(false), assistRef = useRef(false), onFinish = useRef<(value: TypingState, time: number) => void>(() => {});
  const readyToType = started && !paused && !preview && !result && !busy;
  const currentConfig = state.config;
  const metrics = useMemo(() => typingMetrics(state, elapsed), [state, elapsed]);
  const analytics = useMemo(() => summarizeTyping(player.results), [player.results]);
  const lesson = typingLessons.find(l => l.id === currentConfig.lessonId);
  const priorLesson = !currentConfig.region && lesson && lesson.order > 1 && !player.results.some(r => r.typing?.passed && r.accuracy >= 90 && r.typing.config.lessonId === `lesson-${lesson.order - 1}`);
  const campaignLocked = currentConfig.region && currentConfig.level! > 1 && !player.results.some(r => r.typing?.passed && r.typing.config.region === currentConfig.region && r.typing.config.level === currentConfig.level! - 1);
  const arcade = ['falling', 'defense', 'space'].includes(currentConfig.mode);
  const memory = ['memory', 'flash'].includes(currentConfig.mode);
  const question = ['completion', 'puzzle'].includes(currentConfig.mode);
  const story = storyChapters[(currentConfig.difficulty - 1) % storyChapters.length];
  const ghost = player.results.filter(r => r.seed === state.config.seed && r.typing?.passed).sort((a, b) => b.typing!.adjustedWpm - a.typing!.adjustedWpm)[0]?.typing;
  const ghostIndex = preferences.ghost ? ghost?.timeline.filter(t => t.at <= elapsed * 1000).at(-1)?.index ?? 0 : 0;
  const cursor = state.typed.length, windowStart = Math.max(0, Math.floor(Math.max(0, cursor - 70) / 250) * 250), visibleText = state.text.slice(windowStart, windowStart + 600);
  const timeNow = () => clockRef.current.base + (performance.now() - clockRef.current.start) / 1000;
  function updatePreferences(patch: Partial<TypingPreferences>) { store.update({ typing: { ...profile, preferences: { ...preferences, ...patch } } }); }
  function persistDraft(value = stateRef.current, time = elapsed) {
    const current = usePlayerStore.getState(); if (current.activeId !== ownerId || completed.current || currentConfig.ranked) return;
    current.update({ typing: { ...(current.players[ownerId].typing ?? defaultTypingProfile), draft: { id, sessionId: sessionRef.current, state: { ...value, elapsed: time } } } });
  }
  async function finish(value: TypingState, time: number) {
    if (completed.current) return; completed.current = true;
    setStarted(false); setPaused(false); setElapsed(time);
    let summary: TypingSummary = finishTyping(value, time);
    if (assistRef.current || player.results.some(r => r.seed === value.config.seed && r.completedAt.slice(0, 10) === new Date().toISOString().slice(0, 10))) summary = { ...summary, xp: 0 };
    const context: GameResult['context'] = value.config.region ? { mode: 'campaign', world: `typing:${value.config.region}`, level: value.config.level } : value.config.workoutIndex !== undefined ? { mode: 'workout', date: value.config.date } : { mode: 'practice', date: value.config.date };
    const local: GameResult = { id, slug: 'typing-academy', seed: value.config.seed, generatorVersion: 1, difficulty: value.config.difficulty, score: summary.score, xp: summary.xp, accuracy: summary.accuracy, mistakes: summary.incorrectCharacters, moves: summary.charactersTyped, duration: summary.duration, completedAt: new Date().toISOString(), verified: false, typing: summary, context };
    setResult(local);
    const current = usePlayerStore.getState(); if (current.activeId !== ownerId) return;
    current.addResult(local); current.update({ typing: { ...(current.players[ownerId].typing ?? defaultTypingProfile), draft: undefined } });
    if (preferences.sound && summary.passed) playSound('win', preferences.volume);
    if (sessionRef.current && !assistRef.current) {
      setBusy(true);
      try { const verified = await api<GameResult>('/typing/session/complete', { method: 'POST', body: JSON.stringify({ sessionId: sessionRef.current, events: value.events, duration: time }) }); if (usePlayerStore.getState().activeId === ownerId) { store.mergeResults([verified]); setResult(verified); } }
      catch (error) { setNotice(`${error instanceof Error ? error.message : 'Account sync failed.'} Your result is saved locally.`); }
      finally { setBusy(false); onComplete?.(); }
    } else onComplete?.();
  }
  onFinish.current = (value, time) => { void finish(value, time); };
  useEffect(() => {
    if (!readyToType) return;
    let ticks = 0;
    const interval = setInterval(() => {
      const value = stateRef.current, time = timeNow(), limited = value.config.duration ? Math.min(time, value.config.duration) : time;
      setElapsed(limited); ticks++;
      const encounter = arcade ? typingArcade(value, limited) : null;
      if (encounter?.diedAt !== null && encounter?.diedAt !== undefined) onFinish.current(value, encounter.diedAt);
      else if (value.config.duration && time >= value.config.duration) onFinish.current(value, value.config.duration);
      else { if (ticks % 20 === 0) persistDraft(value, limited); if (ticks % 12 === 0 && value.events.length) onProgress?.(value, limited); }
    }, 250);
    return () => clearInterval(interval);
    // The interval reads the latest engine state through refs, without subscribing the app shell to keystrokes.
  }, [readyToType]);
  useEffect(() => { if (!preview) return; const timer = setTimeout(() => { setPreview(false); clockRef.current.start = performance.now(); inputRef.current?.focus(); }, currentConfig.mode === 'flash' ? 1600 : currentConfig.mode === 'reaction' ? 1200 + currentConfig.difficulty * 130 : 5000); return () => clearTimeout(timer); }, [preview, currentConfig.mode, currentConfig.difficulty]);
  useEffect(() => { const visibility = () => { if (document.hidden && readyToType && !currentConfig.ranked) { const time = timeNow(); clockRef.current.base = time; setElapsed(time); setPaused(true); persistDraft(stateRef.current, time); } }; document.addEventListener('visibilitychange', visibility); return () => document.removeEventListener('visibilitychange', visibility); });
  useEffect(() => { if (readyToType) inputRef.current?.focus(); }, [readyToType]);
  const autoStarted = useRef(false);
  useEffect(() => { if (raceSession && !autoStarted.current) { autoStarted.current = true; void begin(); } }, [raceSession]);
  useEffect(() => { document.querySelector<HTMLElement>('.current-character')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);
  async function begin() {
    setBusy(true); setNotice('');
    let next = stateRef.current;
    if (store.account && !sessionRef.current && !next.events.length) {
      try { const session = await api<RaceSession>('/typing/session/start', { method: 'POST', body: JSON.stringify({ config: next.config }) }); next = createTypingState(session.config, session.text); sessionRef.current = session.sessionId; setId(session.sessionId); }
      catch (error) { setNotice(error instanceof Error ? error.message : 'Could not start account session.'); setBusy(false); return; }
    }
    stateRef.current = next; setState(next); clockRef.current = { start: performance.now(), base: next.elapsed };
    if (raceSession) clockRef.current.base = Math.max(0, (Date.now() - Date.parse(raceSession.startedAt)) / 1000);
    const showPreview = memory || currentConfig.mode === 'reaction'; setPreview(showPreview);
    setStarted(true); setPaused(false); setBusy(false);
  }
  function pause() { if (currentConfig.ranked) return; if (!paused) { const time = timeNow(); clockRef.current.base = time; setElapsed(time); persistDraft(stateRef.current, time); } else clockRef.current.start = performance.now(); setPaused(!paused); }
  function enter(value: string) {
    if (!readyToType || document.activeElement !== inputRef.current) return;
    const time = timeNow(); if (currentConfig.duration && time >= currentConfig.duration) { onFinish.current(stateRef.current, currentConfig.duration); return; }
    if (arcade) { const encounter = typingArcade(stateRef.current, time); if (encounter.diedAt !== null) { onFinish.current(stateRef.current, encounter.diedAt); return; } }
    let next = stateRef.current;
    if (value.length < next.typed.length && next.typed.startsWith(value)) {
      while (next.typed.length > value.length) { const changed = applyTypingEvent(next, { type: 'backspace', at: Math.round(time * 1000) }); if (next === changed) break; next = changed; }
    } else if (value.startsWith(next.typed)) {
      const added = value.slice(next.typed.length);
      if (added.length > 1) { setAssisted(true); assistRef.current = true; setNotice('Bulk input is practice only and earns no XP or ranked score.'); }
      for (const character of added) {
        const expected = next.text[next.typed.length];
        const changed = applyTypingEvent(next, { type: 'input', value: character, at: Math.round(time * 1000) });
        if (changed !== next) { setPressed(character); setWrong(character !== expected); if (preferences.sound) playSound(character === expected ? 'tap' : 'wrong', preferences.volume); next = changed; }
      }
    } else { setNotice('Continue at the current character. Use Backspace to correct earlier input.'); }
    stateRef.current = next; setState(next); setElapsed(time);
    if (next.status === 'complete') onFinish.current(next, time);
  }
  function restart(same = true) { navigate(typingUrl({ ...config, seed: same ? config.seed : crypto.randomUUID(), ...(config.ranked && !store.account ? { ranked: false } : {}) }), { replace: true, state: { restart: crypto.randomUUID() } }); }
  const passedLesson = lesson && result?.typing?.passed;
  return <div className={`typing-exercise ${preferences.zen && !result ? 'typing-zen' : ''}`}>
    <div className="typing-exercise-heading"><Link className="back-link" to="/typing"><ArrowLeft size={15}/>Academy</Link><span className="typing-session-label">{currentConfig.ranked && store.account ? 'Ranked · timer cannot pause' : 'Practice · saved on this device'}{assisted ? ' · bulk input' : ''}</span><Button variant="ghost" aria-label="Exercise settings" onPointerDown={e => e.preventDefault()} onClick={() => { if (readyToType && !currentConfig.ranked) pause(); setSettings(true); }}><Settings2 size={18}/></Button></div>
    {!preferences.zen && <div className="typing-session-title"><p className="eyebrow">{currentConfig.region ? `${currentConfig.region.replaceAll('-', ' ')} · LEVEL ${currentConfig.level}` : currentConfig.mode === 'code' ? `CODETYPE / ${currentConfig.language}` : 'ACCURACY FIRST. RHYTHM FOLLOWS.'}</p><h1>{lesson?.name ?? (currentConfig.mode === 'code' ? 'Make syntax second nature.' : currentConfig.mode === 'falling' ? 'Catch the falling words.' : currentConfig.mode === 'defense' ? 'Defend the word garden.' : currentConfig.mode === 'space' ? 'Clear the asteroid field.' : currentConfig.mode === 'adventure' ? 'The quiet beacon.' : `${currentConfig.duration ? `${currentConfig.duration}-second` : 'Focused'} ${currentConfig.mode.replace('-', ' ')} practice`)}</h1></div>}
    {result ? <section className="typing-result panel"><div className="result-icon"><Trophy size={37}/></div><p className="eyebrow">{result.typing!.passed ? 'YOUR PRACTICE IS ADDING UP' : 'A USEFUL STEP. KEEP PRACTICING.'}</p><h2>{result.typing!.passed ? 'A little more fluent.' : 'Accuracy comes with practice.'}</h2><div className="typing-result-main"><strong>{result.typing!.adjustedWpm}<small>adjusted WPM</small></strong><strong>{result.accuracy}%<small>accuracy</small></strong><strong>+{result.xp}<small>MindForge XP</small></strong></div><div className="typing-result-details">{[['Raw WPM', result.typing!.rawWpm], ['Clean WPM', result.typing!.cleanWpm], ['CPM', result.typing!.cpm], ['Consistency', `${result.typing!.consistency}%`], ['Correct / incorrect', `${result.typing!.correctCharacters} / ${result.typing!.incorrectCharacters}`], ['Corrected / remaining errors', `${result.typing!.correctedErrors} / ${result.typing!.uncorrectedErrors}`], ['Best clean streak', result.typing!.longestCleanStreak], ['Average rhythm', `${result.typing!.rhythm} ms`], ['First-key reaction', `${result.typing!.reactionTime} ms`], ['5s / 10s burst WPM', `${result.typing!.burst5} / ${result.typing!.burst10}`], ['Duration', formatTime(result.duration)], ['Combined score', result.score]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="verification-label">{busy ? 'Validating account replay…' : result.verified ? 'Account replay verified' : 'Local practice result'} · {result.typing!.passed ? 'Completed' : 'Target not met'}</p><div className="button-row"><Button onClick={() => restart(true)} disabled={busy || !!raceSession}><RotateCcw size={16}/>Practice again</Button>{passedLesson && lesson.order < typingLessons.length && <Link className="button button-primary" to={typingUrl({ lessonId: `lesson-${lesson.order + 1}`, mode: 'lesson', duration: 0, seed: `lesson:${lesson.order + 1}` })}>Next lesson<ArrowRight size={16}/></Link>}{currentConfig.mode === 'adventure' && result.typing!.passed && currentConfig.difficulty < storyChapters.length && <Link className="button button-primary" to={typingUrl({ mode: 'adventure', duration: 0, correction: 'strict', difficulty: currentConfig.difficulty + 1 })}>Next story chapter<ArrowRight size={16}/></Link>}<Link className="button button-secondary" to={currentConfig.workoutIndex !== undefined ? '/typing/workout' : currentConfig.region ? `/typing/campaign?region=${currentConfig.region}` : '/typing/statistics'}>View progress<ArrowRight size={16}/></Link></div><div className="typing-coach-inline"><Sparkles size={20}/><p>{analytics.coaching[0]}</p><Link to={typingUrl({ mode: 'adaptive', duration: 120, focusKeys: analytics.weakKeys.slice(0, 3).map(k => k.key), seed: crypto.randomUUID() })}>Practice weak keys →</Link></div></section> : <section className="typing-workspace panel">
      {!preferences.zen && <div className="typing-live-stats" aria-label="Live typing statistics"><div><strong>{metrics.adjustedWpm}</strong><span>WPM</span></div><div><strong>{metrics.accuracy || '—'}{metrics.charactersTyped ? '%' : ''}</strong><span>accuracy</span></div><div><strong>{formatTime(currentConfig.duration ? Math.max(0, currentConfig.duration - elapsed) : elapsed)}</strong><span>{currentConfig.duration ? 'remaining' : 'elapsed'}</span></div><div><strong>{metrics.incorrectCharacters}</strong><span>errors</span></div><div><strong>{currentConfig.targetWpm}</strong><span>{metrics.adjustedWpm >= currentConfig.targetWpm ? 'on target' : 'target WPM'}</span></div></div>}
      {!started ? <div className="typing-start"><div className="typing-start-icon"><KeyboardIcon size={35}/></div><h2>{saved?.state.events.length ? 'Your practice is waiting.' : 'Settle in. Find your rhythm.'}</h2><p>{priorLesson || campaignLocked ? 'Complete the previous lesson or campaign level first to unlock this exercise.' : lesson?.description || 'Keep your shoulders relaxed and focus on one character at a time. Your timer starts when you begin.'}</p><Button disabled={busy || !!priorLesson || !!campaignLocked} onClick={() => void begin()}><Play size={17}/>{busy ? 'Preparing…' : saved?.state.events.length ? 'Resume typing' : store.account && currentConfig.ranked ? 'Start ranked test' : 'Begin typing'}</Button><p className="small-note">{currentConfig.mode === 'code' || currentConfig.mode === 'terminal' ? 'Practice text only. Your code and commands are never executed.' : 'Only input in the focused exercise is recorded.'}</p></div> : <>
        {arcade && <ArcadeScene mode={currentConfig.mode} state={state} elapsed={elapsed} metrics={metrics}/>}
        {currentConfig.mode === 'adventure' && <p className="typing-story"><strong>Chapter {currentConfig.difficulty} · {story.title}</strong><br/>{story.story}</p>}
        {currentConfig.mode === 'spelling' && <p className="typing-story">Clue: {({ keyboard: 'A set of keys used to enter text into a computer.', planet: 'A large world that orbits a star.', garden: 'A place where plants are carefully grown.', river: 'A natural stream of flowing water.', memory: 'The ability to retain and recall information.', science: 'The systematic study of the natural world.' } as Record<string, string>)[state.text]}</p>}
        {question && <p className="typing-story">{typingQuestion(currentConfig).prompt}</p>}
        <div className={`typing-passage caret-${preferences.caret} errors-${preferences.errorStyle} ${memory && !preview ? 'memory-hidden' : ''}`} onClick={() => { if (readyToType) inputRef.current?.focus(); }} aria-label={memory && !preview ? 'Passage hidden for recall' : 'Text to type'} style={{ fontFamily: `${preferences.font}, monospace`, fontSize: preferences.fontSize, lineHeight: preferences.lineHeight, letterSpacing: `${preferences.spacing}px` } as CSSProperties}>
          {currentConfig.mode === 'reaction' && preview ? 'Wait for the word…' : currentConfig.mode === 'spelling' || question ? Array.from(state.text).map((_, i) => <span key={i} className={i === cursor ? 'current-character' : ''}>{state.typed[i] || '_'}</span>) : memory && !preview ? 'Recall the text in the exercise field below.' : Array.from(visibleText).map((character, i) => { const index = windowStart + i, actual = state.typed[index]; return <span key={index} className={`${index === cursor ? 'current-character' : actual === undefined ? 'future-character' : actual === character ? 'correct-character' : 'incorrect-character'} ${preferences.pacer && Math.floor(elapsed * currentConfig.targetWpm * 5 / 60) === index ? 'pacer-character' : ''}`} aria-hidden="true">{character === '\n' ? <>↵<br/></> : character === '\t' ? '⇥   ' : character}</span>; })}
          {!(memory && !preview) && !question && currentConfig.mode !== 'spelling' && <span className="sr-only">{visibleText}</span>}
        </div>
        {preview && <p className="typing-focus-message"><Eye size={16}/>{currentConfig.mode === 'reaction' ? 'Wait, then react when the word appears.' : 'Remember this text. The timer begins after it disappears.'}</p>}
        <label className="sr-only" htmlFor="typing-exercise-input">Typing exercise input</label><textarea ref={inputRef} id="typing-exercise-input" className={`typing-input ${memory || currentConfig.mode === 'spelling' ? 'typing-input-visible' : ''}`} value={state.typed} onChange={e => enter(e.target.value)} disabled={paused || preview || busy} autoCorrect="off" autoCapitalize="off" spellCheck={false} autoComplete="off" rows={memory ? 3 : 2} aria-describedby="typing-input-help" onSelect={e => { const field = e.currentTarget; if (field.selectionStart !== field.value.length) field.setSelectionRange(field.value.length, field.value.length); }} onKeyDown={e => { if (e.key === 'Escape') { e.currentTarget.blur(); } if (e.key === 'Tab' && !e.shiftKey && (currentConfig.indentation === 'tab' && currentConfig.mode === 'code' || currentConfig.mode === 'data-entry' || question && state.text.includes('\t'))) { e.preventDefault(); enter(stateRef.current.typed + '\t'); } }} onBlur={() => { if (readyToType && !currentConfig.ranked && !completed.current) { const time = timeNow(); clockRef.current.base = time; setElapsed(time); setPaused(true); persistDraft(stateRef.current, time); } }}/>
        <div className="typing-input-caption" id="typing-input-help"><span>{paused ? 'Paused. Continue when you are ready.' : currentConfig.correction === 'strict' ? 'Correct mistakes with Backspace before continuing.' : currentConfig.correction === 'no-backspace' ? 'No-backspace challenge. Keep moving forward.' : currentConfig.correction === 'perfect' ? 'Perfect accuracy: the first mistake ends this attempt.' : 'Type in the field above. Corrections remain part of your accuracy history.'}</span><span>{cursor} / {state.text.length} characters</span></div>
        <div className="typing-track"><span style={{ width: `${metrics.progress}%` }}/>{preferences.ghost && ghost && <i style={{ left: `${Math.min(100, ghostIndex / state.text.length * 100)}%` }} title="Personal best ghost"/>}</div>
        <div className="typing-controls">{!currentConfig.ranked && <Button variant="secondary" onPointerDown={e => e.preventDefault()} onClick={pause}>{paused ? <Play size={16}/> : <Pause size={16}/>} {paused ? 'Continue typing' : 'Pause'}</Button>}<Button variant="ghost" disabled={busy || !!raceSession} onClick={() => restart(true)}><RotateCcw size={16}/>Restart</Button>{!currentConfig.ranked && <Button variant="ghost" onClick={() => onFinish.current(stateRef.current, paused ? elapsed : timeNow())}>Finish practice</Button>}<Button variant="ghost" onPointerDown={e => e.preventDefault()} onClick={() => updatePreferences({ zen: !preferences.zen })}><Eye size={16}/>{preferences.zen ? 'Show controls' : 'Zen mode'}</Button></div>
      </>}
    </section>}
    {notice && <p className="play-notice" role="status">{notice}</p>}
    {preferences.keyboard && !preferences.zen && !result && !memory && !question && currentConfig.mode !== 'spelling' && <Keyboard expected={started && !paused && !preview ? state.text[cursor] ?? '' : ''} pressed={pressed} incorrect={wrong}/>}
    <p className="typing-privacy-note">Exercise-only input · No background keylogging · No code execution · <Link to="/typing/statistics#formulas">How scores are calculated</Link></p>
    <Modal open={settings} onOpenChange={setSettings} title="Your typing space" description="These preferences are saved with your browser profile."><div className="typing-settings-form"><label>Font<select value={preferences.font} onChange={e => updatePreferences({ font: e.target.value })}>{['Consolas', 'Cascadia Code', 'Courier New', 'monospace'].map(font => <option key={font}>{font}</option>)}</select></label><label>Font size<input type="range" min="18" max="38" value={preferences.fontSize} onChange={e => updatePreferences({ fontSize: +e.target.value })}/>{preferences.fontSize}px</label><label>Line height<input type="range" min="1.4" max="2.5" step="0.1" value={preferences.lineHeight} onChange={e => updatePreferences({ lineHeight: +e.target.value })}/></label><label>Character spacing<input type="range" min="0" max="4" step="0.5" value={preferences.spacing} onChange={e => updatePreferences({ spacing: +e.target.value })}/></label><label>Caret<select value={preferences.caret} onChange={e => updatePreferences({ caret: e.target.value as TypingPreferences['caret'] })}><option value="line">Line</option><option value="block">Block</option><option value="underline">Underline</option></select></label><label>Error feedback<select value={preferences.errorStyle} onChange={e => updatePreferences({ errorStyle: e.target.value as TypingPreferences['errorStyle'] })}><option value="underline">Underline + color</option><option value="highlight">Highlight + color</option><option value="minimal">Minimal</option></select></label>{(['keyboard', 'pacer', 'ghost', 'sound'] as const).map(key => <label className="checkbox-label" key={key}><input type="checkbox" checked={preferences[key]} onChange={e => updatePreferences({ [key]: e.target.checked })}/>{({ keyboard: 'Show finger guidance', pacer: 'Show target-speed pacer', ghost: 'Race my best timing for this exact passage', sound: 'Typing sounds' })[key]}</label>)}<label><Volume2 size={16}/>Typing volume<input type="range" min="0" max="1" step=".05" value={preferences.volume} onChange={e => updatePreferences({ volume: +e.target.value })}/></label></div></Modal>
  </div>;
}
function ArcadeScene({ mode, state, elapsed }: { mode: string; state: TypingState; elapsed: number; metrics: ReturnType<typeof typingMetrics> }) {
  const encounter = typingArcade(state, elapsed), all = state.text.split(' '), words = all.slice(encounter.defeated, encounter.defeated + Math.min(4, 2 + Math.floor(encounter.wave / 2)));
  return <div className={`typing-arcade arcade-${mode}`} aria-label={`${mode} typing game`}><div className="arcade-hud"><span>{mode === 'space' ? 'SECTOR' : 'WAVE'} {encounter.wave} · {encounter.lives} LIVES</span><span>COMBO {encounter.combo} · {encounter.defeated} CLEARED</span><span>{encounter.shields} SHIELDS · {encounter.impacts} IMPACTS</span></div>{words.map((word, index) => <div className={`arcade-word ${index === 0 ? 'arcade-target' : ''} ${encounter.boss && index === 0 ? 'arcade-boss' : ''}`} key={`${encounter.defeated}:${index}`} style={{ left: `${5 + index * 24}%`, transform: `translateY(${Math.max(0, encounter.progress * 130 - index * 30)}px)` }}>{index === 0 && <span>⌖ </span>}{word}{encounter.boss && index === 0 && <small>BOSS</small>}</div>)}<div className="arcade-base">{mode === 'space' ? '△ STATION' : mode === 'defense' ? '♜ WORD GARDEN' : 'CATCH THE TARGET'} · {Math.max(0, encounter.deadline - elapsed).toFixed(1)}s TO IMPACT · 5 CLEAN WORDS = SHIELD</div></div>;
}
