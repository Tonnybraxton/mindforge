# Development

## Toolchain

Use Node 24 with the checked-in npm lockfile. `npm ci` installs exact resolved dependency versions. Run `npm run db:generate` before type-checking the Prisma repository.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite frontend on port 5173 |
| `npm run dev:server` | API with TypeScript watch mode on port 3001 |
| `npm run dev:all` | Both processes |
| `npm run lint` | ESLint |
| `npm run typecheck` | Strict TypeScript check |
| `npm test` | Engine, progression and API tests |
| `npm run build` | Type check, static build and PWA generation |
| `npm run preview` | Serve the built frontend |
| `npm run test:e2e` | Desktop and mobile Chromium end-to-end tests |

Frontend changes normally hot reload. Engine changes affect both frontend and API; check both entry points after editing shared contracts.

## Browser verification

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright owns ports 4173 and 3001 for the test run and refuses to reuse an unknown existing service. It sets `NODE_ENV=test`, `MEMORY_DATABASE=true` and an origin matching the preview server. This isolates account tests from the developer database. Tests should create their own users and browser contexts.

The config runs desktop Chromium and Pixel 7 mobile emulation. It records failure screenshots, traces and video. Open the last report with `npx playwright show-report`. Linux CI installs browser system dependencies through `npx playwright install --with-deps chromium`.

On the Windows authoring environment, installed Chromium revision 1243 was available, and a direct headless launch succeeded outside the process sandbox. A sandboxed launch failed with `spawn EPERM`; that is an environment execution restriction, not a missing browser. In a normal local terminal, run the commands above. Agent environments may require permission to launch subprocesses.

## Manual checks

Verify the complete player loop: guest onboarding, puzzle instructions, a successful Memory Cards run, earned XP, persisted results after reload, a resumed unfinished puzzle, favorites and settings. Check keyboard-only play, narrow mobile layout, visible focus, high contrast and reduced motion. For account changes, verify registration, logout, refresh rotation, account separation and deletion against the intended repository.

For offline behavior, use a built preview rather than Vite development mode, load the app online until the service worker activates, reload once, and then disconnect. Guest puzzle routes should remain usable; online-only actions should show an honest unavailable state.

## Tests and trust

Use deterministic seeds to test generator invariants across all difficulty levels. Test reducer transitions with valid and invalid actions. Check API rejection paths as well as successful flows: missing auth, unexpected origin, unauthorized sessions, invalid replay, repeat completion and refresh-token reuse.

Memory-repository tests do not establish PostgreSQL transaction behavior. The CI container job is intended to run migrations, seed data and health checks against real PostgreSQL. Add database integration tests as the persistent feature surface grows.
