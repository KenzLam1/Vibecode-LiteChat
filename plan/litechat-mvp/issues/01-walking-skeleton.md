# 01 — Walking skeleton: stream one reply

**What to build:** The thinnest end-to-end path. The app is scaffolded (Next.js App Router, TypeScript, Tailwind, Vercel AI SDK, Drizzle + SQLite, Vitest, per ADRs 0001–0002). A single page lets the seeded user type a message and watch a reply from one model stream in. Behind it sit the pieces every later ticket builds on: the model catalog (ChatGPT, Claude, Gemini with their capability flags), the Providers module (three AI SDK clients with explicit proxy base URLs and keys from env vars), the schema and migrations for users, login sessions, conversations and messages, and a `requireUser()` helper that is the only way routes get the current user (it returns a seeded user for now). A proxy smoke script checks the three routes.

See spec: `plan/litechat-mvp/spec.md` (Modules: Model catalog, Providers, Current-user seam; Schema; Further Notes → Phase 0).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] `npm run dev` serves a page where typing a message streams a reply from one model
- [x] Model calls use `maxOutputTokens` ≥ 800 and the AI SDK's default retries
- [x] API keys are read only on the server and never reach the browser
- [x] The model catalog is the only list of models; the UI reads display names from it
- [x] Migrations create `users`, `login_sessions`, `conversations`, `messages` as in the spec, with random text IDs and foreign keys enforced
- [x] The database path comes from `DATABASE_PATH`
- [x] `requireUser()` exists and returns a seeded user
- [x] The smoke script streams "hi" from all three routes, reports which routes surface reasoning parts, and reports the largest prompt the proxy accepted
- [x] `npm test` runs Vitest (even with no tests yet)

## Comments

**2026-09-29 — implemented.** Findings from the smoke script and manual checks:

- **Reasoning:** Claude and Gemini surface reasoning parts once asked. Claude needs `thinking: { type: "adaptive" }` (the proxy rejects `budget_tokens`); Gemini needs `thinkingConfig: { includeThoughts: true }`. Both live in the Providers module. ChatGPT does **not** surface reasoning: the proxy streams it as Responses `reasoning_text` events that `@ai-sdk/openai` ignores, so ChatGPT gets the timer-only fallback (ticket 07).
- **OpenAI route must use the Responses API.** Chat Completions rejects `max_completion_tokens` ("unsupported at this implementation milestone").
- **Earlier turns must go back as plain text.** If assistant parts keep their provider metadata, the Responses client sends them as `item_reference`s and the stateless proxy answers "unsupported message role". `store: false` doesn't help: it adds `include`, which the proxy also rejects. The context builder must send text only (it already drops reasoning).
- **Context probe:** the proxy accepted ~256k estimated tokens (1000 KiB prompt; 227,770 input tokens counted by the provider), the probe's default ceiling. One earlier run failed at ~128k with "invalid or oversized JSON body" after 82s, then the same size passed on the next run, so it was a flaky failure, not the limit. The 100k-token starting budget is comfortably inside what the proxy accepts.
- Characters ÷ 4 overestimates tokens by about 12% on English filler text.
