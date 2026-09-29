# SQLite (via Drizzle) as the only database

We store everything in a single SQLite file using `better-sqlite3` through Drizzle ORM, not a hosted Postgres. The app already depends on one flaky network service (the LLM proxy); a local file adds no second network dependency, needs no setup, and is identical in dev and prod. Drizzle keeps the schema typed and leaves a mostly mechanical path to Postgres if we ever need many concurrent writers.

## Consequences

- The database path comes from `DATABASE_PATH`. The app is local-only today; any future host must provide a persistent disk.
