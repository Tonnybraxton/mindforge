import type { TypingProfile } from '../pages/typing/model';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameAction, GameResult, PlayerSettings } from '../../shared/contracts';
import type { GameState } from '../../shared/games/engine';
import { getGame } from '../../shared/registry';
import { achievementProgress, achievements } from '../../shared/progression';
import type { Account } from '../lib/api';

export interface SavedRun { id: string; state: GameState; actions: GameAction[]; elapsed: number; context: NonNullable<GameResult['context']>; sessionId?: string; }
export interface Player { typing?: TypingProfile; name: string; joinedAt: string; results: GameResult[]; favorites: string[]; savedRuns: Record<string, SavedRun>; workoutMinutes: number; onboarded: boolean; settings: PlayerSettings; }
const defaultSettings: PlayerSettings = { theme: 'dark', sound: true, volume: 0.35, reducedMotion: false, highContrast: false, largeText: false, colorBlind: false, privacy: 'private' };
const newPlayer = (): Player => ({ name: 'Explorer', joinedAt: new Date().toISOString(), results: [], favorites: [], savedRuns: {}, workoutMinutes: 10, onboarded: false, settings: { ...defaultSettings } });
interface PlayerStore { activeId: string; players: Record<string, Player>; account: Account | null; toast: string | null; setToast: (message: string | null) => void; update: (patch: Partial<Player>) => void; setSettings: (patch: Partial<PlayerSettings>) => void; favorite: (slug: string) => void; saveRun: (run: SavedRun) => void; removeRun: (slug: string) => void; addResult: (result: GameResult) => void; login: (account: Account, migrate?: boolean) => void; logout: () => void; reset: () => void; mergeResults: (results: GameResult[]) => void; }
export const usePlayerStore = create<PlayerStore>()(persist((set, get) => ({
  activeId: 'guest', players: { guest: newPlayer() }, account: null, toast: null,
  setToast: toast => set({ toast }),
  update: patch => set(s => ({ players: { ...s.players, [s.activeId]: { ...s.players[s.activeId], ...patch } } })),
  setSettings: patch => { const s = get(); s.update({ settings: { ...s.players[s.activeId].settings, ...patch } }); },
  favorite: slug => { const p = get().players[get().activeId]; get().update({ favorites: p.favorites.includes(slug) ? p.favorites.filter(f => f !== slug) : [...p.favorites, slug] }); },
  saveRun: run => { const p = get().players[get().activeId]; get().update({ savedRuns: { ...p.savedRuns, [run.state.slug]: run } }); },
  removeRun: slug => { const p = get().players[get().activeId]; const savedRuns = { ...p.savedRuns }; delete savedRuns[slug]; get().update({ savedRuns }); },
  addResult: result => { const s = get(); const p = s.players[s.activeId]; if (p.results.some(r => r.id === result.id)) return; const results = [...p.results, result]; const unlocked = achievements.filter(a => achievementProgress(a, p.results, slug => getGame(slug)?.category) < a.threshold && achievementProgress(a, results, slug => getGame(slug)?.category) >= a.threshold); s.update({ results }); if (unlocked.length) s.setToast(`Achievement unlocked · ${unlocked[0].name}${unlocked.length > 1 ? ` + ${unlocked.length - 1} more` : ''}`); },
  login: (account, migrate = false) => set(s => { const existing = s.players[account.id]; const guest = s.players.guest; return { account, activeId: account.id, players: { ...s.players, [account.id]: existing ?? { ...(migrate ? guest : newPlayer()), name: account.username, settings: account.settings, results: migrate ? guest.results.map(r => ({ ...r, verified: false })) : [], savedRuns: {} } } }; }),
  logout: () => set({ account: null, activeId: 'guest' }),
  reset: () => set(s => ({ players: { ...s.players, [s.activeId]: newPlayer() } })),
  mergeResults: results => { const s = get(); const p = s.players[s.activeId]; const merged = new Map(p.results.map(r => [r.id, r])); for (const r of results) merged.set(r.id, r); s.update({ results: [...merged.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt)) }); },
}), { name: 'mindforge-player-v1', storage: createJSONStorage(() => ({ getItem: name => localStorage.getItem(name), removeItem: name => localStorage.removeItem(name), setItem: (name, value) => { try { localStorage.setItem(name, value); } catch (error) { console.error('MindForge could not save browser progress.', error); window.dispatchEvent(new Event('mindforge-storage-error')); } } })), partialize: state => ({ players: state.players }), version: 1 }));
export const usePlayer = () => usePlayerStore(s => s.players[s.activeId]);
