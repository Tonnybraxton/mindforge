import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Copy, Flag, Users } from 'lucide-react';
import type { TypingRaceRecord } from '../../../server/src/typing-records';
import type { TypingState } from '../../../shared/typing/types';
import { Button, PageHeading } from '../../components/ui';
import { api } from '../../lib/api';
import { usePlayerStore } from '../../stores/player';
import { TypingExercise } from './TypingExercise';
import { typingUrl } from './model';

type Race = Omit<TypingRaceRecord, 'participants'> & { sessionId: string; participants: (Omit<TypingRaceRecord['participants'][number], 'sessionId'> & { sessionId?: string })[] };
export function TypingRaces() {
  const account = usePlayerStore(s => s.account), [params, setParams] = useSearchParams();
  const room = params.get('room');
  const [race, setRace] = useState<Race | null>(null), [roomInput, setRoomInput] = useState(room || ''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const progressBusy = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!account || !room) { setRace(null); return; }
    let active = true;
    const refresh = async () => { try { const data = await api<Race>(`/typing/races/${encodeURIComponent(room)}`); if (active) { setRace(data); setNotice(''); } } catch (error) { if (active) setNotice(error instanceof Error ? error.message : 'Could not refresh race.'); } };
    void refresh(); const timer = setInterval(() => void refresh(), 2500);
    return () => { active = false; clearInterval(timer); };
  }, [room, account?.id]);
  async function action(path: string) { setBusy(true); setNotice(''); try { const data = await api<Race>(path, { method: 'POST', body: '{}' }); setRace(data); setParams({ room: data.id }); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update race.'); } finally { setBusy(false); } }
  async function progress(state: TypingState, elapsed: number) { if (progressBusy.current || !race) return; progressBusy.current = true; try { const data = await api<Race>(`/typing/races/${race.id}/progress`, { method: 'POST', body: JSON.stringify({ events: state.events, duration: elapsed }) }); setRace(data); } catch (error) { setNotice(error instanceof Error ? error.message : 'Race progress could not sync.'); } finally { progressBusy.current = false; } }
  const countdown = race?.startedAt ? Math.max(0, Math.ceil((Date.parse(race.startedAt) - now) / 1000)) : 0;
  const own = race?.participants.find(p => p.userId === account?.id);
  const live = race && race.status !== 'waiting' && !countdown;
  return <><PageHeading eyebrow="A SHARED PASSAGE / A LITTLE FRIENDLY COMPETITION" title="Good company. Great practice." description="Invite 2–8 players to a live race. Everyone receives the same text and start time. Complete it with at least 95% accuracy; final placement uses validated speed and accuracy."/>
    {!account ? <section className="panel typing-section typing-empty"><Users size={34}/><h2>Bring your MindForge account.</h2><p>Sign in to create or join a race, keep your verified result, and challenge friends.</p><Link className="button button-primary" to="/profile">Sign in or create an account<ArrowRight size={16}/></Link></section> : <>
      {!race && <section className="panel typing-section"><div className="button-row"><Button disabled={busy} onClick={() => void action('/typing/races')}><Flag size={17}/>Create a race room</Button><Link className="button button-secondary" to={typingUrl({ duration: 60 })}>60-second warm-up</Link></div><form className="typing-room-form" onSubmit={e => { e.preventDefault(); let id = roomInput.trim(); try { id = new URL(id).searchParams.get('room') || id; } catch { /* A room ID is also accepted. */ } if (!/^[\da-f-]{36}$/i.test(id)) { setNotice('Paste a valid room link or room ID.'); return; } void action(`/typing/races/${id}/join`); }}><label>Join a friend’s room<input value={roomInput} onChange={e => setRoomInput(e.target.value)} placeholder="Paste a room link or ID" required/></label><Button variant="secondary" disabled={busy}>Join room</Button></form>{room && <Button variant="secondary" onClick={() => void action(`/typing/races/${encodeURIComponent(room)}/join`)}>Join this invitation</Button>}</section>}
      {race && <section className="panel typing-section"><div className="section-heading"><div><h2>{race.status === 'waiting' ? 'Your starting line' : race.status === 'finished' ? 'The results are in.' : countdown ? `Starting in ${countdown}…` : 'The race is on.'}</h2><p>{race.participants.length} / 8 players · 50 words · 95% minimum accuracy</p></div>{race.status === 'waiting' && <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/typing/races?room=${race.id}`); setNotice('Invitation copied. Share it with your friends.'); } catch { setNotice(`Share this room ID: ${race.id}`); } }}><Copy size={16}/>Copy invitation</Button>}</div><p className="typing-room-id">Room: {race.id}</p><div className="typing-race-tracks">{race.participants.map(p => <div className="typing-race-track" key={p.userId}><div><strong>{p.username}{p.userId === account.id ? ' (you)' : ''}</strong><span>{p.rank ? `#${p.rank} · ${p.adjustedWpm} WPM · ${p.accuracy}%` : p.progress ? `${Math.round(p.progress)}% · provisional` : 'Ready'}</span></div><div className="typing-race-lane"><span style={{ width: `${p.progress}%` }}/><i style={{ left: `${Math.min(96, p.progress)}%` }}>➜</i></div></div>)}</div>{race.status === 'waiting' && (race.hostId === account.id ? <Button disabled={busy || race.participants.length < 2} onClick={() => void action(`/typing/races/${race.id}/start`)}>Start together<ArrowRight size={16}/></Button> : <p role="status">Waiting for the host to start…</p>)}{race.status === 'finished' && <Button variant="secondary" onClick={() => { setRace(null); setParams({}); }}>Back to race lobby</Button>}</section>}
      {live && !own?.completedAt && <TypingExercise key={race.id} config={race.config} raceSession={{ sessionId: race.sessionId, config: race.config, text: race.text, startedAt: race.startedAt! }} onProgress={(s, t) => void progress(s, t)}/>}
    </>}{notice && <p className="play-notice" role="status">{notice}</p>}<section className="panel typing-section"><h2>Compete on your own schedule.</h2><p>Share today’s challenge with a friend. Complete the same seeded passage whenever you are ready, then compare results on the friends leaderboard.</p><div className="button-row"><Link className="button button-secondary" to="/typing/train?daily=true">Asynchronous daily race<ArrowRight size={16}/></Link><Link className="text-link" to="/typing/leaderboards">See typing rankings<ArrowRight size={16}/></Link><Link className="text-link" to="/multiplayer">Manage friends<ArrowRight size={16}/></Link></div></section></>;
}
