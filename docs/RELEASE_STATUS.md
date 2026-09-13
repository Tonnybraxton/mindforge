# Release status

This repository is an implementation of the first playable MindForge release, with extension points for the larger master brief. It is not a claim that the complete 50-game commercial service has launched.

## Current delivery

The application includes eight playable games: Memory Cards, Sequence Recall, Sudoku, Mental Math Rush, Maze Runner, Sokoban, Stroop Challenge and Pattern Matrix. They share seeded generation, replay validation, scoring, XP, achievements and browser persistence. The registry is the source of truth for the playable catalogue. Campaign definitions provide ten worlds and 1,120 deterministic level specifications; 920 levels currently use implemented games. Language Kingdom and Speed Circuit remain unavailable.

The responsive dashboard, game library, workouts, daily challenge, campaign, statistics, profiles and settings are integrated. Seven themes, reduced motion, larger text, high contrast, keyboard controls, sound settings, accessible mobile navigation and confirmed data deletion are available. Account registration, sign-in, rotating sessions, verified results, opt-in public rankings and friend requests use the API. Shared puzzle links support asynchronous play.

The seed/schema and initial SQL migration include catalogue and progression definitions without invented players or competitive results. PWA icons, offline guest caching, API/web container targets, PostgreSQL startup sequencing and CI checks are provided. Desktop and mobile screenshots are saved in `docs/mindforge-desktop.png` and `docs/mindforge-mobile.png`.

## Service limitations

- A public hosting deployment, DNS and TLS certificate have not been provisioned by this code change.
- Docker is unavailable on the authoring host, so container execution and PostgreSQL startup must be confirmed on a Docker-capable host or in CI.
- The explicit memory account mode is disposable and is not equivalent to PostgreSQL persistence.
- Redis is a reserved optional container. Shared cache, distributed rate limits and multi-instance operations are not implemented merely by declaring it.
- The schema reserves social, match and inventory records. Real-time matchmaking, WebSocket competition and live opponents require a separate complete implementation and verification.
- Google OAuth, email delivery and password recovery need configured providers and a completed flow before they are offered as working services.
- Procedural client games expose solvable state. Server replay validates legal wins and calculated rewards; it cannot establish that a human played without automation.
- Offline support covers cached guest play. Account authentication, authoritative scores and social data still require connectivity.

The ultimate brief also calls for the rest of the 50-game catalogue, richer social systems, admin operations and advanced live-service features. These should be tracked as future scope unless their implementation and verification are explicitly recorded here.

## Verification record

Verified locally on 12 September 2026:

- Strict TypeScript check and ESLint passed. Generated Playwright reports are excluded from linting.
- 137 Vitest tests passed: 94 engine tests, 17 progression tests and 26 API tests. Coverage includes all eight difficulties, deterministic generation, Sudoku uniqueness, maze and Sokoban solvability, invalid actions, rewards, daily/workout/campaign boundaries, credential isolation, token rotation/reuse, access control, replay validation and duplicate completion.
- The production Vite build and service-worker precache generation passed.
- 18 Chromium end-to-end cases passed across desktop and Pixel 7 emulation: onboarding, deliberate deletion, gameplay through XP/history/achievements, saved-run resume, settings/favorites/export, registration and verified account results, refresh/logout/login, campaign gates, navigation/search, maximum-difficulty board layouts and offline reload/play.
- The initial SQL migration was generated from the Prisma schema without connecting to a database. Actual PostgreSQL migration, transaction and seed execution remain unverified locally.

Subprocess tools required execution outside the default sandbox (`spawn EPERM` inside it). The GitHub Actions jobs are configured but have not been run remotely as part of this delivery. No public deployment is claimed.
