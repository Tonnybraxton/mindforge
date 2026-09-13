# Architecture

## Runtime boundaries

```text
Browser: React / React Router / Zustand / TanStack Query
    │ same-origin /api requests
    ▼
Vite proxy (development) or nginx (container build)
    │
    ▼
Express API: validation / authentication / replay / repositories
    │
    ▼
Prisma → PostgreSQL
```

`src/` owns rendering, routes, accessible controls, audio and browser persistence. `shared/` owns data contracts, the game registry, seeded state machines, daily challenge rotation and progression formulas. `server/src/` owns authentication, authorization, validation, authoritative session handling and storage. `prisma/` owns the database schema, migrations and catalogue seed.

React boards are views over game state. They dispatch serializable actions rather than invent separate scoring rules. Both the browser and API import the same deterministic engine. This makes seed reproduction and replay debugging possible without maintaining divergent gameplay implementations.

## Local and account progress

Guest identity and progress are stored in a versioned Zustand local-storage record. Saved runs include engine state, elapsed play time, context and the action log. Clearing browser storage deletes local progress. Storage failures are surfaced to the player.

Connected account mutations go through the API. Access tokens are held in JavaScript memory; refresh credentials are HTTP-only cookies. Users are partitioned by account identity in browser storage. A client-side game result does not become a verified competitive result merely because a user signs in.

The API uses a repository boundary with PostgreSQL and explicit nonproduction memory implementations. The memory implementation supports quick local work and API tests; it is disposable. Production requires PostgreSQL.

## Procedural content

Game generation derives from a seed, game slug, difficulty and generator version. The registry exposes only implemented games. Campaign definitions map each numbered level to a reproducible seed and a supported game. Daily challenges use UTC and a versioned fixed rotation, avoiding user-dependent random selection.

Achievement, XP, level, streak and adaptive-difficulty calculations live in shared code. Statistics are based on recorded gameplay. Catalogue definitions and reserved database models do not imply that future products such as real-time matchmaking are implemented.

## Assets and offline operation

Vite produces a static web build, split into application and library chunks. The PWA service worker precaches static assets and supports offline guest play after a successful online visit and service-worker activation. API responses are excluded from the navigation fallback. Authentication, account sync and leaderboards require connectivity.

The icon is an original SVG in `public/icon.svg`. The 192px and 512px PNG versions are rendered from it; the 512px maskable version keeps the mark inside a central safe region. Recreate them with `node docs/generate-icons.mjs` after installing Chromium for Playwright.

## Scaling boundary

This release is designed for one API instance. Database transactions protect account writes, but process-local rate limits are not a distributed quota. Redis is a reserved optional Compose service; no cache or distributed limiter is activated simply by starting it. Before running multiple API replicas, add and verify a shared rate-limit store, session concurrency handling and operational monitoring.
