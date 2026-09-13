import type { GameAction, GameResult, PlayerSettings } from '../../shared/contracts';
export interface Account { id: string; email: string; username: string; createdAt: string; profile: { avatar: string; level: number; xp: number; coins: number; rank: string; brainScore: number; totalGames: number; totalPlayTime: number }; settings: PlayerSettings; }
let accessToken: string | null = null;
export const setToken = (token: string | null) => { accessToken = token; };
let refreshPromise: Promise<{ user: Account; accessToken: string }> | null = null;
// Share one rotation between startup effects and simultaneous expired requests.
export function restoreAccount() {
  refreshPromise ??= api<{ user: Account; accessToken: string }>('/auth/refresh', { method: 'POST' }, false)
    .then(data => { setToken(data.accessToken); return data; })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> { let response: Response; try { response = await fetch(`/api${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers } }); } catch { throw new Error('The account service is unavailable. Guest puzzles are still ready to play.'); } if (response.status === 401 && retry && !path.startsWith('/auth/')) { await restoreAccount(); return api<T>(path, options, false); } const body = await response.json().catch(() => null); if (!response.ok || !body?.success) throw new Error(body?.error?.message || 'The account service is not connected. You can continue playing as a guest.'); return body.data as T; }
export const submitSession = (slug: string, sessionId: string, actions: GameAction[]) => api<GameResult>(`/games/${slug}/complete`, { method: 'POST', body: JSON.stringify({ sessionId, actions }) });
