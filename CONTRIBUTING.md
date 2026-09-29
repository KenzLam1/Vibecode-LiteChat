# Contributing to LiteChat

This guide is the handoff point for both people and coding agents arriving from
a fresh clone.

## First checkout

```bash
git clone https://github.com/KenzLam1/Vibecode-LiteChat.git
cd Vibecode-LiteChat
nvm install              # optional; installs and selects the .nvmrc version
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Open <http://localhost:3000>. The account, database, and automated tests work
without provider credentials. Sending a model message requires the credentials
described in the README; the smoke test also makes real, potentially billable
requests and is never part of the normal validation command.

The app creates `data/litechat.db` and applies committed migrations on first
use. Delete only your own ignored database if you deliberately want a clean
local state.

## Where to start

Read these files before changing code:

1. [`AGENTS.md`](AGENTS.md) — repository rules and commit format.
2. [`CONTEXT.md`](CONTEXT.md) — the domain language used in code and docs.
3. [`docs/adr/`](docs/adr/) — decisions that constrain the architecture.
4. [`plan/`](plan/) — specs and issue records. Only an issue marked
   `ready-for-agent` with unchecked acceptance criteria is open implementation
   work; `implemented` files are historical records.
5. The relevant Next.js guide under `node_modules/next/dist/docs/`. This repo
   uses Next.js 16, whose APIs may differ from older examples.

The main code paths are:

- `src/app/` — pages, route handlers, actions, and UI components.
- `src/server/conversations/` — the main conversation service and model-call
  lifecycle.
- `src/server/accounts/` — account and login-session behavior.
- `src/server/db/` and `drizzle/` — schema and committed migrations.
- `src/lib/models.ts` — the browser-safe model catalog.
- `src/server/providers.ts` — server-only provider clients and credentials.

## Development workflow

1. Confirm the behavior or acceptance criterion before editing.
2. Keep credentials in `.env.local`; never add secrets, local databases, or
   exported transcripts to Git.
3. Add or update tests for behavior changes.
4. When changing `src/server/db/schema.ts`, run `npm run db:generate` and
   commit the generated migration.
5. Run the required checks:

   ```bash
   npm run check
   npm run build
   ```

6. Use one Conventional Commit per logical change. The full rules and allowed
   commit types are in `AGENTS.md`.

`npm run smoke` is an optional integration check for configured provider
routes. It sends real requests and probes large prompts, so read its README
description and set `PROBE_MAX_TOKENS` before using it with paid accounts.

## Pull requests

Keep pull requests focused. Explain the user-visible outcome, identify the
spec or issue record when one exists, and include the commands or manual flows
used to verify the change. CI installs from `package-lock.json`, runs lint,
type checking, tests, and a production build.
