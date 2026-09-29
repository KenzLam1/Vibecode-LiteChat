# LiteChat MVP

Status: ready-for-agent

Decided in the grilling session of 2026-09-29. Vocabulary follows `CONTEXT.md`; architecture follows `docs/adr/0001`–`0003`. Evidence for LiteChat's behaviour and the proxy's limits is in `study/`.

## Problem Statement

We want our own working copy of litechat.ai's core chat experience, built in one hard 9-hour session. The people using it want to talk to several assistant models from one place, keep their conversations, pick them up later, and bring documents into a conversation.

The constraints make this harder than it sounds. The only models we can reach are three course keys on BUILD LLM Proxy, labelled ChatGPT, Claude and Gemini, all running DeepSeek Flash behind one of three provider API formats. The proxy is flaky (requests sometimes time out with no response), every reply reasons before answering (small output budgets produce empty answers), PDFs are rejected, images are read unreliably, built-in web search is rejected, and the context-window size is undocumented. A copy that looks like LiteChat but hangs, loses messages, or answers about an empty document is worse than one that looks a little different but never breaks.

## Solution

A local-only web app that runs on the developer's machine and puts reliability ahead of pixel-perfect fidelity, with LiteChat's look (primary blue `#0780b5`, Fredoka and Inter, pill row, model cards) applied cheaply.

A user signs up with a username and password, starts a conversation by picking one of three models, and gets streamed, safely rendered markdown replies with the model's reasoning shown in a collapsible block. Conversations live in a sidebar, get a sensible title automatically, and can be renamed and deleted. Users can attach documents, whose text is extracted on the server and sent to the model. A user-level system prompt applies to all their conversations. Every failure the proxy can produce ends in a clear state with a Try again action, never a hang and never a lost user message.

## User Stories

### Accounts

1. As a visitor, I want to sign up with a username and password, so that I can have my own private conversations.
2. As a visitor, I want sign-up to tell me when a username is already taken, so that I can pick another one.
3. As a visitor, I want usernames to be case-insensitive, so that "Kenzi" and "kenzi" can't be two different accounts.
4. As a visitor, I want sign-up to reject passwords shorter than 8 characters, so that my account isn't trivially guessable.
5. As a user, I want to log in with my username and password, so that I can get back to my conversations.
6. As a user, I want a wrong username or password to give one generic error, so that nobody can probe which usernames exist.
7. As a user, I want to stay logged in across page refreshes and browser restarts, so that I don't have to log in every time.
8. As a user, I want my login session to extend while I keep using the app, so that I'm not logged out mid-conversation.
9. As a user, I want to log out, so that someone else using the machine can't see my conversations.
10. As a logged-out visitor, I want every app page to send me to the login page, so that I never see a broken half-loaded app.
11. As a user, I want to see only my own conversations, so that my chats stay private.
12. As a user, I want opening another user's conversation URL to show "not found", so that nobody can read my conversations by guessing or sharing links.

### Starting a conversation

13. As a user, I want a ＋ button that opens a "Select a Model" dialog, so that I choose the model before the conversation starts.
14. As a user, I want the dialog to show ChatGPT, Claude and Gemini as cards with a short description, so that I can tell them apart.
15. As a user, I want the chosen model shown as a read-only pill in the conversation, so that I always know which model I'm talking to.
16. As a user, I want the model to stay fixed for the whole conversation, so that replies never break from mixing providers' history.
17. As a user with no conversations, I want a large "Start a new conversation" tile, so that I know where to begin.
18. As a user, I want each conversation to have its own URL, so that refreshing and back/forward take me to the same conversation.

### Chatting

19. As a user, I want to type a message and send it with Enter (Shift+Enter for a new line), so that chatting feels normal.
20. As a user, I want the reply to stream in token by token, so that I can start reading before it finishes.
21. As a user, I want a "Thinking… (3.4s)" timer until the answer starts, so that I know the app isn't frozen while the model reasons.
22. As a user, I want the model's reasoning to stream into a collapsible "Thought for Xs" block, so that I can see what it's doing during a long think.
23. As a user, I want the reasoning block collapsed by default once the answer arrives, so that it doesn't bury the answer.
24. As a user, I want reasoning to still be there after a refresh, so that I can review how the model got to an answer.
25. As a user on a route whose reasoning isn't available, I want to still see the thinking timer, so that the experience degrades gracefully.
26. As a user, I want replies rendered as markdown (headings, lists, tables, links, code), so that answers are readable.
27. As a user, I want code blocks syntax-highlighted with a Copy button, so that I can reuse code quickly.
28. As a user, I want wide tables to scroll sideways inside the message, so that the page layout never breaks.
29. As a user, I want model output rendered safely with no raw HTML executed, so that a malicious reply can't run scripts in my browser.
30. As a user, I want multi-turn conversations where the model remembers earlier turns, so that I can ask follow-up questions.
31. As a user, I want my message saved the moment I send it, so that I never lose what I typed even if the reply fails.
32. As a user, I want a failed reply to show a clear error with a Try again button, so that one proxy timeout doesn't strand me.
33. As a user, I want Try again to regenerate from my saved message, so that I don't have to retype it.
34. As a user, I want a reply that failed halfway to be discarded rather than saved, so that a truncated answer never pollutes later replies.
35. As a user reopening a conversation whose last message never got an answer, I want to see a Try again action under it, so that I can finish what I started.
36. As a user, I want to stop a reply that's going on too long, so that I don't wait for text I don't need.
37. As a user who stopped a reply, I want the partial text kept, so that what I saw is what stays.
38. As a user, I want the send button disabled while a reply streams, so that I don't send overlapping messages.

### Attachments

39. As a user, I want to attach documents with a 📎 button, drag-and-drop, or paste, so that I can bring files into a conversation however is easiest.
40. As a user, I want attached files shown as removable pills before I send, so that I can check and correct what I'm attaching.
41. As a user, I want to attach .pdf, .txt, .md, .csv and .json files, so that I can ask about reports, notes and data.
42. As a user, I want files of any other type refused with a clear message, so that I know why a file didn't attach.
43. As a user, I want up to 5 attachments per message, so that I can compare several documents at once.
44. As a user, I want to be told when a document was truncated to its first 50,000 characters, so that I know the model didn't see all of it.
45. As a user, I want a scanned PDF with no text to be rejected before sending, so that the model never answers about an empty document.
46. As a user, I want attachments to appear as named pills on my sent message, so that I can see later which files a message included.
47. As a user, I want the model to keep seeing an attachment's text on later turns, so that I can ask follow-up questions about the document.
48. As a user, I want to be told when a message's attachments are too large to send together, so that I can send fewer files instead of getting a cryptic failure.

### Long conversations

49. As a user in a long conversation, I want the app to keep working once the conversation outgrows the model's context, so that the conversation never gets permanently stuck.
50. As a user, I want a note when older messages are no longer in the model's context, so that I understand why it has forgotten something early on.

### Managing conversations

51. As a user, I want my conversations listed in a sidebar with title and date, newest activity first, so that I can find recent ones quickly.
52. As a user, I want a new conversation's title to become the start of my first message immediately, so that the sidebar never fills with identical "New conversation" rows.
53. As a user, I want the title upgraded to a short AI-written title after the first reply, so that the sidebar reads well.
54. As a user, I want a failed AI title to fail silently and keep the fallback, so that a flaky title call never shows me an error.
55. As a user, I want to rename a conversation inline in the sidebar, so that I can organise my conversations.
56. As a user who renamed a conversation, I want my title never replaced automatically, so that my choice sticks even if the AI title arrives late.
57. As a user, I want to delete a conversation after confirming in the app, so that I don't delete one by accident.
58. As a user, I want a deleted conversation and all its messages and attachment text gone for good, so that private content really disappears.
59. As a user, I want opening a conversation to load its full history, so that I can pick up where I left off.

### Retired models

60. As a user whose conversation uses a model that's no longer offered, I want to still read it, so that my history isn't lost.
61. As a user in such a conversation, I want a banner explaining it can't be continued with a "Start a new conversation" button, so that I know what to do next.

### System prompt

62. As a user, I want a profile page with one system prompt field, so that I can give standing instructions to every conversation.
63. As a user, I want a system prompt edit to apply to all my conversations from their next turn, so that changing a setting works everywhere.
64. As a user, I want the system prompt capped at 4,000 characters with a visible counter, so that I know the limit before hitting it.

### Look and feel

65. As a user, I want LiteChat's colours, fonts, bubbles and pill row, so that the app feels like LiteChat.
66. As a user, I want auto-scroll to follow a streaming reply, so that I don't have to scroll manually.

### Developer

67. As the developer, I want a smoke script that streams a reply from all three routes, so that I can check the proxy is healthy before a demo.
68. As the developer, I want the smoke script to probe the context-size limit, so that the context budget is set from evidence.
69. As the developer, I want the model list in one config file that drives the UI, so that removing or adding a model is a one-line change.
70. As the developer, I want API keys to live only on the server, so that they can never leak to a browser.

## Implementation Decisions

### Architecture (see ADRs)

- One Next.js App Router + TypeScript + Tailwind app using the Vercel AI SDK (`streamText` on the server, `useChat` in the browser), run as a single Node process on the developer's machine. There is no deployment. (ADR 0001)
- One SQLite file through Drizzle ORM, with its path read from `DATABASE_PATH`. (ADR 0002)
- Hand-rolled username + password auth with database-backed login sessions, following the Lucia guide. Sign-up is open. (ADR 0003)
- Markdown is rendered with `react-markdown`, `remark-gfm` and `rehype-highlight`, with raw HTML disabled.

### Modules

- **Model catalog.** A config array with one entry per model: id, display name (ChatGPT / Claude / Gemini), provider route, description, and capability flags (`documents: true`, `images: false`, `webSearch: false`, `multiTurn: false`). It is the only source of which models exist. A conversation whose model id isn't in the catalog belongs to a retired model. Capability flags drive which composer controls are shown; the UI never hard-codes model names.
- **Providers.** Builds the three AI SDK clients (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`), each with its proxy `baseURL` and key passed explicitly from env vars, and resolves a catalog entry to a language model. This is the only module that knows about the three routes.
- **Conversation service** (the main test seam). Every operation takes the current user and is scoped to them. Interface, roughly:
  - list conversations (newest activity first)
  - start a conversation (model id) → conversation
  - open a conversation (id) → conversation + messages, or not found
  - send a message (conversation id, text, attachments) → a reply stream
  - regenerate (conversation id) → a reply stream from the last unanswered user message
  - rename (conversation id, title)
  - delete (conversation id)

  It rejects sends to retired-model conversations. Internally it builds the context, calls the model, applies the persistence rules and runs the title rules. The language model is injected so tests can substitute the AI SDK mock.
- **Context builder** (inside the conversation service). Builds what the model sees on a turn: the user's current system prompt, then earlier turns from newest to oldest until the budget is reached, then the newest message. Reasoning parts are removed. Attachment parts are turned into `[Attached file: <name>]` followed by the extracted text. Tokens are estimated as characters ÷ 4. The budget is a named constant (starting at 100k tokens, adjusted from the Phase 0 probe). It reports whether older turns were dropped so the UI can show the note. If the newest message alone exceeds the budget, the send is rejected with a user-facing error before any model call.
- **Attachment extractor.** Takes an uploaded file and returns `{filename, size, text, truncated}` or a user-facing rejection. It allows `.pdf .txt .md .csv .json` only and at most 5 files per message. PDFs go through `unpdf` (or `pdf-parse`). Text is cut to 50,000 characters with `truncated` set. A file whose extracted text is empty after trimming is rejected ("No text found in X. Scanned PDFs aren't supported."). Original files are never stored.
- **Title rules** (inside the conversation service). On the first user message, if the title source is `default`, set the title to the first ~40 characters of the message and the source to `fallback`. After the first successful reply, ask the conversation's own model for a 3–6 word title with `maxOutputTokens` ≥ 800. Apply it only if the source is still `default` or `fallback`, then set the source to `auto`. An empty or failed title call is ignored silently. A rename sets the source to `user`, which nothing automatic ever overwrites.
- **Account service** (the second test seam). Sign up (username, password), log in (username, password) → login session token, resolve a login session (token) → user or none (extending expiry when near its end), log out (token). Usernames are normalised to lowercase and unique. Passwords are at least 8 characters and hashed with argon2 (`@node-rs/argon2`). Tokens are random, and only their SHA-256 hash is stored.
- **Current-user seam.** One `requireUser()` helper is the only way routes get the current user. From Phase 0 to Phase 5 it returns a seeded user. In Phase 5 it switches to resolving the login session cookie (HttpOnly, `SameSite=Lax`, `Secure` outside localhost). Unauthenticated page requests redirect to login; unauthenticated API requests return 401. Writes check the request origin against the host.
- **UI.** A chat page (message list, reasoning block, markdown, composer with the pill row and attachment staging, stop and Try again), a conversation sidebar (list, ＋, inline rename, delete confirmation dialog), the Select a Model dialog (cards), a retired-model banner, a profile page (system prompt with counter), and login and sign-up pages. Refresh-safe conversation URLs look like `/c/<id>`.

### Persistence rules

- The user message is saved before the model is called.
- An assistant message is saved only when the stream finishes or the user stops it. The server consumes the stream to the end even if the browser disconnects, so a finished reply is saved even after the tab closes.
- A failed stream (before or after the first token) saves nothing. The UI shows the error with Try again, and regenerate replays from the saved user message.
- A stopped stream saves the partial text and reasoning shown so far.
- Every saved message bumps the conversation's `updated_at`.

### Schema

| Table | Columns | Notes |
|---|---|---|
| `users` | id, username (unique, lowercased), password_hash, system_prompt (nullable, ≤ 4,000 chars), created_at | |
| `login_sessions` | id (SHA-256 of the token), user_id → users (cascade), expires_at | Sliding expiry |
| `conversations` | id, user_id → users (cascade), title, title_source (`default` / `fallback` / `auto` / `user`), model_id, created_at, updated_at | No `deleted_at` (hard delete), no memories flag. Index on (user_id, updated_at) |
| `messages` | id, conversation_id → conversations (cascade), role (`user` / `assistant`), parts (JSON), created_at | Parts use the AI SDK UIMessage shape: text, reasoning, and an attachment data part `{filename, size, text, truncated}` |

- All IDs are random text IDs, never sequential integers.
- "Retired" is never stored. It is derived from the catalog.
- Foreign keys are enforced (`PRAGMA foreign_keys = ON`) so that cascades work.

### Model calls

- Every call uses `maxOutputTokens` ≥ 800 (the reasoning budget), including title calls.
- `maxRetries` stays at the AI SDK default (2) for connection failures.
- We send no identity or persona instructions. The proxy adds its own persona prompt, and the user's system prompt is added on top of it.
- No thinking-effort parameter is sent (testing showed it has no effect).

## Testing Decisions

- **What makes a good test here:** it exercises external behaviour through a module's public interface (what the user or the model would observe), never internal helpers or table layouts. A test says "a stopped reply keeps its partial text", not "function X writes row Y". Tests should survive a refactor of the internals.
- **Seam 1: Conversation service.** Tested against a real in-memory SQLite database (migrations applied) and the AI SDK's mock language model from `ai/test`, scripted to stream text and reasoning, fail before the first token, fail mid-stream, or be stopped. It covers:
  - the context the mock model receives: no reasoning parts, attachments as labelled text, the current system prompt, oldest turns dropped past the budget with the dropped flag set, oversized newest message rejected
  - persistence: the user message is saved on failure, nothing is saved for a failed reply, a stopped partial is saved, regenerate replays the unanswered message
  - titles: the fallback is set on the first message, the auto title replaces the fallback, a user rename is never replaced (including when the auto title arrives after the rename), a failed or empty title call leaves the fallback
  - ownership: another user's conversation is not found for open, send, rename and delete
  - retired models: open works, send is rejected
  - hard delete cascades to messages
  - attachments through send: truncation flag at 50k, empty-text PDF rejected, disallowed type rejected, more than 5 files rejected
- **Seam 2: Account service.** Tested against in-memory SQLite. Covers: case-insensitive duplicate usernames rejected, short passwords rejected, wrong password and unknown username return the same error, a valid token resolves to its user, expired and unknown tokens resolve to none, logout invalidates the token, and expiry is extended when near its end.
- **Not automated:** HTTP routes, React components and styling. Each build phase ends with a manual "Done when" check (see Further Notes). No browser or end-to-end tests.
- **Proxy smoke script:** not a test suite, but a health check run in Phase 0 and before any demo. It streams "hi" from all three routes through the Providers module, reports which routes surface reasoning parts, and probes the largest prompt the proxy accepts.
- **Prior art:** none. The repo has no code yet. These tests set the pattern: Vitest, one test file per seam, and a fresh in-memory database per test.

## Out of Scope

- Deployment of any kind. The app runs only on the developer's machine. (Before any future deploy, gate sign-up behind an invite code; see ADR 0003.)
- Image attachments (the `images` flag stays `false` unless a real screenshot is read correctly during Phase 4), Office attachments (.docx .xlsx .pptx), and storing or downloading original files.
- Memories and the per-conversation Include Memories toggle, including their schema.
- Web search (built-in or as a custom tool), multi-turn tool use, and the thinking-effort selector.
- Switching models inside a conversation, and several models or tiers per provider.
- Email, password reset, Google SSO and account deletion.
- Soft delete, restore, and trash.
- Mobile layout, dark mode, and the Compact model-picker view with favourites and sorting.
- Billing, credits, org accounts, agent mode, Office document output, Projects, the SimGen and Ask apps, and streams that resume after a disconnect.
- Summarising old turns when the context budget is exceeded.

## Further Notes

### Build order (clock time, hard 9-hour limit)

| Time | Phase | Done when |
|---|---|---|
| 0:00–0:30 | **0 Setup.** Scaffold, dependencies, Providers module, model catalog, schema and migrations, `requireUser()` returning a seeded user, smoke script | `npm run dev` serves a page; the smoke script streams from all three routes and reports reasoning availability and the context probe |
| 0:30–2:00 | **1 Streaming chat.** Chat route, `useChat`, markdown, thinking timer, Try again | Multi-turn chat works, code copies, long tables don't break the page, a failed request shows Try again |
| 2:00–3:30 | **2 Persistence + sidebar + titles** | Three conversations survive a refresh with history; rename, delete and titles persist ◆ checkpoint: if 30+ min behind, drop the AI title upgrade and keep the fallback |
| 3:30–4:40 | **3 Model picker + reasoning** | One conversation per model streams; the reasoning block shows where available; "Who are you?" gives each model's persona name |
| 4:40–5:40 | **4 Attachments + context budget** | A PDF is summarised correctly on all three models; the scanned PDF, truncation and oversize errors show ◆ checkpoint: if behind, ship PDF + .txt only |
| 5:40–6:40 | **5 Login + system prompt.** `requireUser()` switches to the cookie | Two users in two browsers can't see each other's conversations; a pasted foreign URL gives not found; "Always answer in French" takes effect |
| 6:40–9:00 | **Nice-to-haves, in order:** Stop button → scroll-to-bottom with paused auto-scroll → empty state + toasts → memories → Office attachments → token count per message | Stop at 8:50, run the smoke script, write a short README |

Tests for each seam are written alongside the phase that builds that behaviour, not in a separate phase.

### If badly behind, cut from the bottom

1. Streaming chat + markdown (never cut)
2. Conversations + persistence
3. Model picker with the model fixed per conversation
4. Attachments (PDF first)
5. Login (fall back to the seeded single user)
6. Reasoning block, AI title upgrade

If one route's reasoning or attachment handling takes more than 20 minutes, turn that capability off for that model in the catalog and move on.

### Proxy facts that shape the code (from `study/api-keys.md`)

- Output budgets under ~800 tokens can come back empty because reasoning uses them up.
- Connections time out at random; retries and Try again cover this.
- Invalid requests return `upstream request failed` with an `x-request-id` header. Log the request id.
- The OpenAI route returns reasoning as a DeepSeek-style `reasoning_content` field that `@ai-sdk/openai` may not surface. The smoke script settles this, and the timer-only fallback covers it.
- Rate limits and spend caps are unknown.
