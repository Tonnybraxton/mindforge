# Deployment and operations

The repository provides a deployable layout and checks; it has not been published to a hosting provider. Docker is not installed on the authoring machine, so no local container launch has been claimed.

## Same-origin container deployment

The `Dockerfile` has separate `api` and `web` targets. The API image runs the TypeScript service with Node 24 and `tsx`, including the Prisma CLI for the one-shot migration service. The web image serves the Vite build with nginx. Compose waits for healthy PostgreSQL, successful migrations/seed, and a healthy API before starting web.

All browser calls use relative `/api` URLs. nginx forwards that path to the API container without rewriting it; other application paths use SPA fallback. API data is never cached by nginx. Fingerprinted static assets receive long-lived cache headers; the service worker, manifest and navigation do not.

Copy `.env.example` to `.env` and run:

```sh
docker compose up --build --wait
```

Visit <http://localhost:8080>. Only the web port is published, bound to host loopback. PostgreSQL, Redis and API are internal services. Compose overrides the direct-Node `DATABASE_URL` with the internal PostgreSQL hostname.

The default uses `APP_ENV=development` because it is local HTTP. Use a randomly generated `ACCESS_TOKEN_SECRET` and `POSTGRES_PASSWORD` even for shared development. If the database password contains URL-reserved characters, percent-encode it in the connection string or supply a separately managed URL; the sample interpolation is easiest with long URL-safe generated values.

## Production configuration

Before exposing the stack:

1. Set `APP_ENV=production`, `PUBLIC_ORIGIN=https://your-domain.example`, a unique high-entropy `ACCESS_TOKEN_SECRET` of at least 32 characters, and a unique database password.
2. Terminate HTTPS at a trusted host reverse proxy in front of loopback port 8080. Forward the original Host header and route the entire public origin, including `/api`, through this stack.
3. Keep the API/database ports private and configure the exact public origin. Production refresh cookies are Secure and require HTTPS; the API rejects a production HTTP origin.
4. Apply migrations to a backup-tested persistent database before shifting traffic. Keep an operational rollback build and do not assume schema downgrades are automatic.
5. Verify registration, refresh, logout, a server-verified puzzle result, account deletion, static route reloads and PWA updates through the actual HTTPS origin.

Generate suitable URL-safe secrets with a trusted password manager or `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Never commit real secrets or inject access-token secrets into Vite client variables.

The default container tags pin supported major/minor lines rather than immutable digests. A release process should pin reviewed image digests and record a tested dependency lockfile before promotion.

## Other hosting providers

The frontend is static output in `dist/` and can be hosted by Vercel, Netlify or Cloudflare with an SPA rewrite. The Node API can run on a compatible container or Node service such as Railway, Render, Fly.io or AWS. Use managed PostgreSQL with backups.

Preserve the same-origin `/api` contract through the frontend provider's reverse proxy or your own gateway. Merely setting a different backend URL in `.env` does not change the frontend's relative fetch paths. Cross-site cookies and a cross-origin frontend/API split require deliberate code/configuration changes and fresh browser verification.

## Health and maintenance

`GET /api/health` checks repository availability. Container health checks use it; an API process existing is not enough. Inspect `docker compose logs api migrate postgres web` after startup failures. Keep HTTP error rates, latency, database capacity and authentication failures observable without logging passwords or tokens.

```sh
docker compose ps
docker compose logs --tail 100 api
docker compose down
```

The final command preserves named database volumes. Provision and verify backup restoration separately. Rebuild and rerun migrations after code/schema upgrades. npm production and build dependencies are retained in the API image because `tsx`, Prisma migration and seed execution currently depend on them; a compiled/minimal runtime image is a future optimization.

Redis is optional under the `cache` profile and currently unused by application logic. The rate limiter is process-local; do not horizontally scale the API before implementing distributed protection and testing simultaneous session completion.

## CI boundary

`.github/workflows/ci.yml` defines dependency installation, Prisma generation, lint, type-check, tests, build and desktop/mobile Playwright checks. A separate container job builds this Compose stack and checks static files, SPA routing and PostgreSQL-backed API readiness. A configured job is not a recorded successful run; inspect the actual CI result before deploying.
