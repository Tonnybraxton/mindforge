# Database

The persistent repository uses PostgreSQL through Prisma 6. The schema is `prisma/schema.prisma`; checked-in migrations are under `prisma/migrations/`. Compose uses PostgreSQL 17 with a named data volume.

## Create or upgrade a database

Set `DATABASE_URL` in `.env`, then run:

```sh
npm run db:generate
npx prisma migrate deploy
npm run db:seed
```

`db:generate` creates the platform-specific client. `migrate deploy` applies existing migrations. The seed inserts or updates definitions needed by the game catalogue and progression system. Repeated seeds should not duplicate definitions or create players.

`npm run db:push` is provided for disposable schema experiments; use migrations for persistent environments. For a schema change, create and review a new migration with `npx prisma migrate dev --name descriptive_name`, test it against an existing database copy, and commit the schema plus SQL. Do not rewrite an applied migration.

## Main records

| Area | Records |
| --- | --- |
| Identity | User, Profile, UserSettings, RefreshToken |
| Play | GameDefinition, DifficultyDefinition, GameSession, GameScore |
| Progress | CognitiveScore, Achievement, UserAchievement, Badge, UserBadge, Streak, Reward |
| Challenges | DailyChallenge, ChallengeAttempt, CampaignWorld, CampaignLevel, CampaignProgress |
| Social | Friendship, FriendChallenge, LeaderboardEntry, Notification |
| Reserved expansion | MultiplayerMatch, InventoryItem, UserInventory |

Foreign keys connect sessions and rewards to their owner. Unique constraints prevent duplicate session rewards, duplicate daily attempts, repeated achievement assignments and repeated campaign records for one player/level. Refresh records store hashes, token families, expiration and revocation state; raw refresh credentials are not stored.

Some models reserve future functionality. A table's existence alone does not mean its complete API, UI or background job is delivered. See `RELEASE_STATUS.md` for the service boundary.

## Development modes

`MEMORY_DATABASE=true` explicitly selects a disposable repository in nonproduction mode. It makes local account flows and isolated tests possible without PostgreSQL; it provides no persistence across process restarts and is not a database integration test.

Without that setting, the API requires `DATABASE_URL`. A production startup must not silently fall back to memory. `/api/health` checks the repository and reports its kind.

## Data operations

Use provider-managed backups or regular encrypted PostgreSQL backups, store them away from the application host and perform restore drills before relying on them. Stop account writes or use a transactionally consistent backup mechanism. Account deletion is authenticated and cascades through owned records; retain no unnecessary copied credentials in logs.

`docker compose down` stops the stack while preserving the database volume. Removing the volume destroys all local account data; it is intentionally not part of the normal start/stop instructions.
