# 01 — Walking skeleton: stream one reply

**What to build:** The thinnest end-to-end path. The app is scaffolded (Next.js App Router, TypeScript, Tailwind, Vercel AI SDK, Drizzle + SQLite, Vitest, per ADRs 0001–0002). A single page lets the seeded user type a message and watch a reply from one model stream in. Behind it sit the pieces every later ticket builds on: the model catalog (ChatGPT, Claude, Gemini with their capability flags), the Providers module (three AI SDK clients with explicit proxy base URLs and keys from env vars), the schema and migrations for users, login sessions, conversations and messages, and a `requireUser()` helper that is the only way routes get the current user (it returns a seeded user for now). A proxy smoke script checks the three routes.

See spec: `plan/litechat-mvp/spec.md` (Modules: Model catalog, Providers, Current-user seam; Schema; Further Notes → Phase 0).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `npm run dev` serves a page where typing a message streams a reply from one model
- [ ] Model calls use `maxOutputTokens` ≥ 800 and the AI SDK's default retries
- [ ] API keys are read only on the server and never reach the browser
- [ ] The model catalog is the only list of models; the UI reads display names from it
- [ ] Migrations create `users`, `login_sessions`, `conversations`, `messages` as in the spec, with random text IDs and foreign keys enforced
- [ ] The database path comes from `DATABASE_PATH`
- [ ] `requireUser()` exists and returns a seeded user
- [ ] The smoke script streams "hi" from all three routes, reports which routes surface reasoning parts, and reports the largest prompt the proxy accepted
- [ ] `npm test` runs Vitest (even with no tests yet)
