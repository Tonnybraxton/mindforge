# MindForge implementation plan

## Repository inspection
The workspace initially contained only the MindForge master product brief. There was no application, package manifest, database, Git repository, or existing code to preserve. Node 24 and npm 11 are installed. Docker is not installed on this machine.

## Architecture and delivery
Build the brief in its requested sequence: foundation, design system, authentication, dashboard, shared engines, Memory Cards, then Sequence Recall, Sudoku, Mental Math, Maze, Sokoban, Stroop, and Pattern Matrix. Complete the core player loop before expanding the catalogue. Never present roadmap content as playable.

- React + strict TypeScript + Vite, React Router, Zustand persistence, TanStack Query, Tailwind, Radix primitives, Motion, Lucide, Recharts, React Hook Form and Zod.
- Shared deterministic game state machines and seed generators, replayable actions, common score and progression rules. Games render through reusable board components.
- Express API, Prisma/PostgreSQL schema, secure rotating refresh cookies, JWT access tokens, validated replay submissions. Guest play is local; local results do not become competitive verified scores.
- Persist player settings, favourites, unfinished puzzles, game history, workout completion, campaign and achievements. No invented user statistics or opponents.
- Responsive dark game dashboard with mint accents, original CSS/SVG puzzle artwork, light and accessible themes, mobile navigation, keyboard play, controllable synthesized audio.
- Daily seeded challenges, adaptive workouts, ten campaign worlds with 1,120 reproducible levels, achievements, statistics, profiles and privacy controls.
- PWA cache, offline guest play, explicit account sync, Docker configuration, CI and operational documentation.

## Work allocation
The app-builder skill specifies specialist coordination. Game systems and backend/database work may proceed alongside the application shell against shared contracts. Parent agent owns integration, player state, design, pages, end-to-end verification, and truthful release notes.

## Verification
Install dependencies, type-check, lint, test deterministic generation/solvability/scoring and API security, build, and exercise real browser flows including Memory Cards through XP, persistence and replay. Inspect desktop and mobile. Record unavailable infrastructure rather than claim deployment or database verification.

## Scope checkpoints
1. Foundation and documented interfaces.
2. First eight playable games, integrated and tested.
3. Progression, daily systems and campaign.
4. Expand to twenty complete games using the same engines if the core loop is verified.
5. Social/competitive surfaces use real service data or clearly explained account requirements. Never fabricate matches or leaderboards.
6. Verify deployment configuration and document remaining live-service or later-phase work.

## Resumed delivery — 12 September 2026

Completed the interrupted first-eight-game release: added the missing responsive stylesheet, repaired saved-run links and account form identity changes, shared refresh-token rotation across concurrent requests, corrected the friend-request endpoint, and added accessible mobile navigation and deletion confirmation. Backend work removed plaintext credential propagation, serialized token-family changes in PostgreSQL, preserved campaign best results, and supplied the missing seed and initial migration.

Local checks passed: strict typecheck, ESLint, 137 unit/API tests, production build and 18 desktop/mobile browser cases. Offline guest play was exercised against the generated service worker. The catalogue expansion, remaining two campaign worlds, live multiplayer, provider integrations and public deployment remain later work. PostgreSQL/container execution requires an available database or Docker-capable environment; neither is claimed tested here.
