# API

The API is mounted at `/api`. Requests with bodies use `Content-Type: application/json`. The response envelope is:

```json
{ "success": true, "data": {} }
```

Errors use the HTTP status plus `{ "success": false, "error": { "code": "INVALID_INPUT", "message": "..." } }`. Common statuses are 400 for validation, 401 for authentication, 403 for access/origin rules, 404 for unavailable resources, 409 for conflicts, 422 for invalid game replay and 429 for rate limits. Error messages avoid exposing private server details.

## Authentication

Registration and login return `{ user, accessToken }` and set `mindforge_refresh`, an HTTP-only cookie restricted to `/api/auth`. It uses `SameSite=Strict`, a 30-day lifetime, and `Secure` in production. Access JWTs expire after 15 minutes; send them as `Authorization: Bearer <token>`.

The refresh endpoint rotates its cookie. Refresh records store hashes, not raw credentials, and belong to a revocable family. Reuse of a revoked refresh credential revokes the family. Logout revokes the current family and clears the cookie. Access validation also checks the related refresh record, allowing account-session revocation to take effect before JWT expiration.

Mutation requests reject an unexpected `Origin` or a cross-site Fetch Metadata header. Serve the browser and API under the same public origin. Requests are bounded to 256 KB, and input objects reject unexpected fields. Passwords need at least 10 characters and may occupy at most 72 UTF-8 bytes. Usernames accept 3–24 letters, numbers or underscores.

## Routes

All paths below are relative to `/api`. “Account” means a valid access token is required.

| Method and path | Auth | Input and result |
| --- | --- | --- |
| `GET /health` | Public | Checks storage; returns status, database kind and generator version |
| `POST /auth/register` | Public | `{ email, username, password }` → user and access token |
| `POST /auth/login` | Public | `{ email, password }` → user and access token |
| `POST /auth/refresh` | Cookie | Rotates refresh credential; returns user and access token |
| `POST /auth/logout` | Cookie | Revokes the current refresh family |
| `GET /auth/me` | Account | Current public account record |
| `GET /users/me` | Account | Alias for the current account record |
| `PATCH /users/me` | Account | Optional username, avatar or settings patch |
| `PATCH /users/me/settings` | Account | Partial validated settings |
| `DELETE /users/me` | Account | `{ password }`; deletes the account and owned data |
| `GET /users/me/history` | Account | Persisted completed game results |
| `GET /users/me/stats` | Account | Profile, streak, unlocked achievement IDs and campaign progress |
| `GET /users/me/export` | Account | Account, history, friendships and derived progression in a JSON envelope |
| `GET /games` | Public | Implemented game registry |
| `GET /daily` | Public | Current UTC daily slug, seed, difficulty and version |
| `GET /campaign` | Public | World definitions and whether their referenced games are available |
| `POST /games/:slug/start` | Account | Validated session configuration → server session ID, seed, difficulty, version and context |
| `POST /games/:slug/complete` | Account | Session ID and replay actions → one authoritative result |
| `GET /leaderboards` | Public/account | Optional period, scope and slug; friends scope requires an account |
| `GET /friends` | Account | Current friendships and requests with player display details |
| `POST /friends` | Account | `{ username }`; sends a friend request |
| `POST /friends/:id/accept` | Account | Accepts a request addressed to the current user |

Settings accept theme, sound, volume (0–1), reducedMotion, highContrast, largeText, colorBlind and privacy (`private`, `friends`, `public`). Avatars are `spark`, `leaf`, `moon`, `sun`, `wave` or `star`. Public account responses omit password hashes and internal role data.

Leaderboard periods are `daily`, `weekly`, `monthly` or `all`; the default is weekly. Scope is `global` or `friends`, defaulting to global. Calendar boundaries are UTC and a week begins Monday. Results come from persisted verified games and respect profile visibility; an empty result is a valid response.

## Session flow

Start an ordinary puzzle:

```json
{
  "difficulty": 1,
  "context": { "mode": "practice" }
}
```

The server returns a UUID `sessionId`, seed, difficulty, generator version, start time and context. Create the same game client-side, record every accepted action, and submit:

```json
{
  "sessionId": "server-issued-uuid",
  "actions": [
    { "type": "flip", "index": 0 },
    { "type": "flip", "index": 1 }
  ]
}
```

This action array illustrates the wire shape; it is not a guaranteed winning replay for an arbitrary seed. Completion requires the full legal action log and a terminal won state. The service accepts at most 2,000 actions and derives elapsed time from the session start; sessions must last at least one second and expire after 24 hours. There can be no more than 20 active sessions in that interval. Unsupported generator versions, foreign sessions, repeated completions and illegal/no-op actions are rejected.

For daily play, send context `{ "mode": "daily", "date": "YYYY-MM-DD" }` to the current daily game's start endpoint. The API enforces the current UTC challenge's seed/difficulty and one ranked completion per day. For campaign play, context is `{ "mode": "campaign", "world": "memory-valley", "level": 1 }`; the API enforces the configured game and previous-level completion. Workout context is `{ "mode": "workout" }`, with the date set by the server.

## Operational scope

The API currently applies process-local request and authentication limits. A reverse proxy must be configured to supply client addresses safely before relying on per-client limits behind it. Multi-instance shared rate limiting, WebSocket matchmaking, OAuth, mail delivery and password reset are not implemented by these routes. Reserved schema models are not additional public API endpoints.
