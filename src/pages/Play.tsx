import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3, Pause, Play as PlayIcon, RotateCcw, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { difficulties, type GameAction, type GameDefinition, type GameResult } from '../../shared/contracts';
import { applyAction, createGame, GENERATOR_VERSION } from '../../shared/games/engine';
import { getGame } from '../../shared/registry';
import { adaptiveDifficulty, calculateReward, campaignLevel, utcDate, worlds } from '../../shared/progression';
import { dailyChallenge } from '../../shared/daily';
import { api, submitSession } from '../lib/api';
import { playSound } from '../lib/audio';
import { formatTime } from '../lib/utils';
import { usePlayer, usePlayerStore, type SavedRun } from '../stores/player';
import GameBoard from '../components/GameBoard';
import { Button, EmptyState, Modal } from '../components/ui';

type Context = NonNullable<GameResult['context']>;
interface Config { seed?: string; difficulty: number; context: Context; error?: string; }
function readConfig(slug: string, search: string, results: GameResult[]): Config {
  const query = new URLSearchParams(search);
  const rawMode = query.get('mode');
  const mode: Context['mode'] = rawMode === 'daily' || rawMode === 'campaign' || rawMode === 'workout' ? rawMode : 'practice';
  const requested = Number(query.get('difficulty') || adaptiveDifficulty(results, slug));
  const difficulty = Number.isFinite(requested) ? Math.max(1, Math.min(8, Math.floor(requested))) : 1;
  if (mode === 'daily') {
    const date = query.get('date') || utcDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) return { difficulty, context: { mode }, error: 'This daily challenge date is invalid.' };
    const daily = dailyChallenge(new Date(`${date}T12:00:00Z`));
    return { seed: daily.seed, difficulty: daily.difficulty, context: { mode, date }, error: daily.slug !== slug ? 'This game does not match that daily challenge.' : undefined };
  }
  if (mode === 'campaign') {
    try {
      const level = campaignLevel(query.get('world') || '', Number(query.get('level')));
      const priorComplete = level.level === 1 || results.some(result => result.context?.mode === 'campaign' && result.context.world === level.world && result.context.level === level.level - 1);
      return { seed: level.seed, difficulty: level.difficulty, context: { mode, world: level.world, level: level.level }, error: level.slug !== slug ? 'This game does not match that campaign level.' : !priorComplete ? 'Complete the previous level to unlock this one.' : undefined };
    } catch { return { difficulty, context: { mode }, error: 'This campaign level could not be found.' }; }
  }
  return { difficulty, seed: query.get('seed')?.slice(0, 128) || undefined, context: { mode, ...(mode === 'workout' ? { date: query.get('date') || utcDate() } : {}) } };
}
function restoreRun(game: GameDefinition, config: Config, saved: SavedRun | undefined): SavedRun {
  if (saved && saved.state.slug === game.slug && (!config.seed || saved.state.seed === config.seed) && saved.context.mode === config.context.mode && saved.state.difficulty === config.difficulty && saved.context.date === config.context.date && saved.context.world === config.context.world && saved.context.level === config.context.level) {
    try {
      if (!Array.isArray(saved.actions) || saved.actions.length > 20_000) throw new Error('Invalid saved puzzle');
      const state = saved.actions.reduce(applyAction, createGame(game.slug, saved.state.seed, saved.state.difficulty));
      return { ...saved, state, elapsed: Number.isFinite(saved.elapsed) ? Math.max(0, saved.elapsed) : 0 };
    } catch { /* A stale or corrupt browser save starts a fresh puzzle. */ }
  }
  return { id: crypto.randomUUID(), state: createGame(game.slug, config.seed || crypto.randomUUID(), config.difficulty), actions: [], elapsed: 0, context: config.context };
}

function GameSession({ game, config }: { game: GameDefinition; config: Config }) {
  const player = usePlayer();
  const { account, saveRun, removeRun, addResult, mergeResults, setSettings } = usePlayerStore();
  const navigate = useNavigate();
  const [run, setRun] = useState(() => restoreRun(game, config, player.savedRuns[game.slug]));
  const runRef = useRef(run);
  const [started, setStarted] = useState(run.state.status !== 'playing');
  const [paused, setPaused] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [restart, setRestart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<GameResult | null>(null);
  const finished = run.state.status !== 'playing';
  const active = started && !paused && !tutorial && !restart && !finished && !starting;
  const activeRef = useRef(active); activeRef.current = active;
  const settingsRef = useRef(player.settings); settingsRef.current = player.settings;
  const completed = useRef(false);
  const commit = useCallback((next: SavedRun) => { runRef.current = next; setRun(next); saveRun(next); }, [saveRun]);
  const dispatch = useCallback((action: GameAction) => {
    if (!activeRef.current) return;
    const current = runRef.current;
    const state = applyAction(current.state, action);
    if (state === current.state) return;
    commit({ ...current, state, actions: [...current.actions, action] });
    const settings = settingsRef.current;
    if (settings.sound && action.type !== 'hide' && action.type !== 'preview-end') playSound(state.status === 'won' ? 'win' : state.metrics.mistakes > current.state.metrics.mistakes ? 'wrong' : state.metrics.correct > current.state.metrics.correct ? 'correct' : 'tap', settings.volume);
  }, [commit]);
  useEffect(() => {
    if (!active) return;
    let previous = performance.now();
    const tick = () => { const now = performance.now(); const next = { ...runRef.current, elapsed: runRef.current.elapsed + (now - previous) / 1000 }; previous = now; commit(next); };
    const interval = setInterval(tick, 1000);
    return () => { clearInterval(interval); tick(); };
  }, [active, commit]);
  useEffect(() => {
    const hide = () => { if (document.hidden && activeRef.current) setPaused(true); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const syncResult = useCallback(async (current: SavedRun) => {
    if (!current.sessionId) return;
    setSyncing(true);
    try { const verified = await submitSession(game.slug, current.sessionId, current.actions); mergeResults([verified]); setResult(verified); removeRun(game.slug); setNotice('Your result is verified and saved to your account.'); }
    catch (error) { setNotice(`${error instanceof Error ? error.message : 'Account sync is unavailable.'} Your result is saved on this device; you can retry syncing.`); }
    finally { setSyncing(false); }
  }, [game.slug, mergeResults, removeRun]);
  useEffect(() => {
    if (!finished || completed.current) return;
    completed.current = true;
    const current = runRef.current;
    if (current.state.status === 'lost') { removeRun(game.slug); return; }
    const duration = Math.max(1, Math.round(current.elapsed));
    const reward = calculateReward(current.state.metrics, current.state.difficulty, duration);
    const localResult: GameResult = { id: current.id, slug: game.slug, seed: current.state.seed, generatorVersion: GENERATOR_VERSION, difficulty: current.state.difficulty, ...reward, mistakes: current.state.metrics.mistakes, moves: current.state.metrics.moves, duration, completedAt: new Date().toISOString(), verified: false, context: current.context };
    const existing = usePlayerStore.getState().players[usePlayerStore.getState().activeId].results.find(item => item.id === current.id);
    setResult(existing || localResult);
    addResult(localResult);
    if (current.sessionId && !existing?.verified) void syncResult(current);
    else removeRun(game.slug);
  }, [finished, addResult, removeRun, game.slug, syncResult]);

  async function begin() {
    if (starting) return;
    setStarting(true); setNotice('');
    let next = runRef.current;
    if (account && !next.sessionId && next.actions.length === 0) {
      try {
        const session = await api<{ sessionId: string; seed: string; difficulty: number; context: Context }>(`/games/${game.slug}/start`, { method: 'POST', body: JSON.stringify({ seed: next.state.seed, difficulty: next.state.difficulty, context: next.context }) });
        next = { ...next, id: session.sessionId, sessionId: session.sessionId, state: createGame(game.slug, session.seed, session.difficulty), context: session.context || next.context };
      } catch (error) { setNotice(`${error instanceof Error ? error.message : 'Account service unavailable.'} This puzzle will count as local practice.`); }
    }
    commit(next); setStarted(true); setPaused(false); setStarting(false);
  }
  function newRun(sameSeed: boolean, difficulty = run.state.difficulty) {
    const seed = config.context.mode !== 'practice' || sameSeed ? run.state.seed : crypto.randomUUID();
    const next: SavedRun = { id: crypto.randomUUID(), state: createGame(game.slug, seed, difficulty), actions: [], elapsed: 0, context: config.context };
    completed.current = false; setResult(null); setNotice(''); setRestart(false); setStarted(false); setPaused(false); commit(next);
  }
  const accuracy = run.state.metrics.total ? Math.round(run.state.metrics.correct / run.state.metrics.total * 100) : null;
  const returnTo = config.context.mode === 'daily' ? '/daily' : config.context.mode === 'workout' ? '/workout' : config.context.mode === 'campaign' ? '/campaign' : '/games';
  const contextLabel = config.context.mode === 'campaign' ? `${worlds.find(world => world.id === config.context.world)?.name} · Level ${config.context.level}` : config.context.mode === 'daily' ? `Daily challenge · ${config.context.date}` : config.context.mode === 'workout' ? 'Your daily workout' : 'A little time for your mind';
  if (config.error) return <EmptyState icon={<CircleHelp/>} title="Let’s find the right puzzle" description={config.error} to={returnTo} label="Go back"/>;
  return <div className="play-page"><Link className="back-link" to={returnTo}><ArrowLeft size={16}/> Back to {config.context.mode === 'practice' ? 'games' : config.context.mode}</Link><div className="play-header"><div><p className="eyebrow">{contextLabel}</p><h1>{game.name}</h1><p>{game.description}</p></div><span className="category-badge" style={{ color: game.accent }}>{game.category}</span></div><div className="play-toolbar"><label>Difficulty <select aria-label="Difficulty" value={run.state.difficulty} disabled={config.context.mode !== 'practice' || started} onChange={event => newRun(false, Number(event.target.value))}>{difficulties.map((name, index) => <option key={name} value={index + 1}>{index + 1} · {name}</option>)}</select></label><div className="button-row"><Button variant="ghost" onClick={() => setTutorial(true)}><CircleHelp size={17}/> How to play</Button><Button variant="ghost" aria-label={player.settings.sound ? 'Mute sound' : 'Enable sound'} onClick={() => setSettings({ sound: !player.settings.sound })}>{player.settings.sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</Button>{started && !finished && <Button variant="secondary" onClick={() => setPaused(value => !value)}>{paused ? <PlayIcon size={16}/> : <Pause size={16}/>} {paused ? 'Resume' : 'Pause'}</Button>}<Button variant="ghost" disabled={starting || syncing} onClick={() => setRestart(true)}><RotateCcw size={16}/> Restart</Button></div></div><div className="play-layout"><section className="play-stage panel" aria-label="Puzzle"><div className="play-stats"><div className="play-stat"><Clock3 size={16}/><span>Time</span><strong>{formatTime(run.elapsed)}</strong></div><div className="play-stat"><span>Moves</span><strong>{run.state.metrics.moves}</strong></div><div className="play-stat"><span>Accuracy</span><strong>{accuracy === null ? '—' : `${accuracy}%`}</strong></div></div>{!started && <div className="play-start"><Sparkles size={26}/><h2>{run.actions.length ? 'Pick up where you left off.' : 'Find your focus.'}</h2><p>{run.actions.length ? 'Your puzzle and elapsed time were saved on this device.' : game.tutorial[0]}</p><Button onClick={() => void begin()} disabled={starting}><PlayIcon size={17}/>{starting ? 'Preparing puzzle…' : run.actions.length ? 'Resume puzzle' : 'Start puzzle'}</Button></div>}{paused && !finished && <div className="play-start"><Pause size={26}/><h2>A moment to breathe.</h2><p>Your timer is paused and progress is saved.</p><Button onClick={() => setPaused(false)}><PlayIcon size={16}/> Continue puzzle</Button></div>}{finished ? <div className="result-panel" aria-live="polite"><div className="result-icon">{run.state.status === 'won' ? <Trophy size={40}/> : <Sparkles size={40}/>}</div><p className="eyebrow">{run.state.status === 'won' ? 'A little sharper than before' : 'Every attempt is practice'}</p><h2>{run.state.status === 'won' ? 'Nicely done.' : 'Give your mind another go.'}</h2><p>{run.state.status === 'won' ? 'You showed up, focused, and made it happen.' : `${run.state.metrics.correct} correct, ${run.state.metrics.mistakes} mistakes. Take a breath and try a fresh round.`}</p>{result && <><div className="result-stats"><div><strong>{result.score}</strong><span>Score</span></div><div><strong>{result.accuracy}%</strong><span>Accuracy</span></div><div><strong>+{result.xp}</strong><span>XP earned</span></div><div><strong>{formatTime(result.duration)}</strong><span>Time</span></div></div><p className="verification-label">{result.verified ? <><Check size={15}/> Account verified · server elapsed time includes pauses</> : 'Saved on this device · local result'}</p></>}<div className="button-row"><Button onClick={() => navigate(returnTo)}>{config.context.mode === 'workout' ? 'Continue workout' : config.context.mode === 'campaign' ? 'Continue journey' : 'Keep exploring'}<ArrowRight size={16}/></Button><Button variant="secondary" disabled={syncing} onClick={() => newRun(false)}>Play again</Button>{run.sessionId && result && !result.verified && <Button variant="ghost" disabled={syncing} onClick={() => void syncResult(runRef.current)}>{syncing ? 'Syncing…' : 'Retry account sync'}</Button>}</div></div> : <div hidden={!started || paused}><GameBoard key={run.id} state={run.state} dispatch={dispatch} active={active}/></div>}{notice && <p className="play-notice" role="status">{notice}</p>}<p className="seed-label">Puzzle {run.state.seed} · v{GENERATOR_VERSION}</p></section><aside className="game-sidebar"><section className="panel"><p className="eyebrow">A clear mind starts here</p><h3>How to play</h3><ol className="game-instructions">{game.tutorial.map(step => <li key={step}>{step}</li>)}</ol></section><section className="panel game-tip"><Sparkles size={22}/><h3>Make room for a little progress.</h3><p>Take your time. Pause when you need to. Your unfinished puzzle saves automatically.</p><p>Scores reflect accuracy, difficulty, and elapsed time. XP is awarded when you complete a puzzle.</p></section></aside></div><Modal open={tutorial} onOpenChange={setTutorial} title={`How to play ${game.name}`} description="The timer pauses while you read."><ol className="game-instructions">{game.tutorial.map(step => <li key={step}>{step}</li>)}</ol><Button onClick={() => setTutorial(false)}>Got it <Check size={16}/></Button></Modal><Modal open={restart} onOpenChange={setRestart} title="Start this puzzle again?" description="Your current attempt will be replaced. Completed results stay in your history."><div className="button-row"><Button onClick={() => newRun(true)}>Restart this puzzle</Button><Button variant="secondary" onClick={() => setRestart(false)}>Keep playing</Button></div></Modal></div>;
}

export default function Play() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const player = usePlayer();
  const activeId = usePlayerStore(state => state.activeId);
  const game = getGame(slug);
  if (!game) return <EmptyState icon={<CircleHelp/>} title="This puzzle is still a mystery" description="Choose a game from the library to get started." to="/games" label="Explore games"/>;
  if (slug === 'typing-academy') return <Navigate replace to={`/typing/train${location.search}`}/>;
  const config = readConfig(slug, location.search, player.results);
  return <GameSession key={`${activeId}:${slug}:${location.search}`} game={game} config={config}/>;
}
