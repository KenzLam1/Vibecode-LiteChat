# 9-hour build plan: LiteChat copy

The goal is to copy LiteChat's **core chat experience** in one 9-hour working session. Every feature below is ranked, then placed into timed phases in the order to build them. Evidence for each feature is in [features.md](features.md) and [architecture.md](architecture.md). What our API keys can and can't do is in [api-keys.md](api-keys.md). Every capability claim in this plan was tested against the real proxy.

## Ground rules for hitting 9 hours

1. **Three provider routes, one backend, one interface.** We have three course keys for **BUILD LLM Proxy** (`proxy.litechat.ai`). Each key copies one provider's API: OpenAI, Anthropic or Google. All three run **DeepSeek Flash**. In the UI they are labelled **ChatGPT**, **Claude** and **Gemini**. We still use the **Vercel AI SDK**: `@ai-sdk/openai`, `@ai-sdk/anthropic` and `@ai-sdk/google`, each created with the proxy's `baseURL`, all feed the same `streamText` call and the same stream format. Only one small module (`providers.ts`) needs to know which route it's talking to.
   - **One model per key.** Each route serves exactly one model (`gpt-5.6-luna`, `claude-haiku-4-5-20251001`, `gemini-3.8-flash`). There is no Premium / Standard / Value choice to offer, so the catalog has **3 models**, and tier badges are dropped rather than invented.
   - **Scope change:** LiteChat's open-weight models (Kimi, GLM, DeepSeek, Qwen, MiniMax) are **out of scope**, and so is **built-in web search**: the proxy rejects both Anthropic's `web_search` tool and Gemini's `googleSearch`.
   - **Identity is handled by the proxy.** It adds its own persona prompt: the model introduces itself as GPT, Claude or Gemini, and says it's DeepSeek Flash when asked directly. Don't write system prompts about the model's identity, and never tell it to deny being DeepSeek.
   - **Keys stay on the server.** Put them only in `.env.local` and in the host's environment variables, and never send them to the browser. Ask the instructor whether they have spending or rate limits.
2. **Every reply thinks first, so budget for it.** The model reasons before answering. A small `maxOutputTokens` (60 in testing) produces an **empty answer**. Use at least 800 everywhere, including auto-titles.
3. **The proxy connection is flaky.** Some requests time out with no response. Leave the AI SDK's `maxRetries` on (default 2) and show a clear "Try again" state in the UI when a stream fails.
4. **Keep the model catalog in a config file, not a database.** A `models.ts` array with LiteChat's capability flags drives the whole UI.
5. **Add `user_id` to every table from the start, but hard-code one user until Phase 5.** You get auth later without having to change the schema.
6. **Deploy at the 7-hour mark at the latest.** Don't leave deployment for the last 10 minutes.
7. **Checkpoints are strict.** If you're behind at a checkpoint, cut the listed items. Don't move the deadline.

### Suggested stack

This stack was chosen for speed. Swap any piece you already know better.

| Concern | Pick | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | UI and API in one project, easy deploy |
| AI streaming | **Vercel AI SDK** (`streamText` + `useChat`) | Streaming, reasoning parts, retries and tool calls without hand-written SSE parsing |
| Models | `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, each with the proxy `baseURL` | One package per key; they all work the same way |
| PDF text | `unpdf` or `pdf-parse` on the server | The proxy rejects PDF files, so we send their text instead |
| Database | **SQLite** (`better-sqlite3` or Drizzle), or **Postgres** if deploying serverless | No server to set up |
| Markdown | `react-markdown` + `rehype-highlight` (or `marked` + `DOMPurify` + `highlight.js`, same as LiteChat) | Safe rendering |
| Styling | Tailwind, LiteChat colours (`#0780b5`, light blues, Fredoka + Inter) | Looks like the original quickly |
| Auth | Username + password with an HttpOnly cookie session | Fastest; add Google SSO only if time allows |
| Web search | **None in the core build.** Optional: your own search tool (N7) | The proxy rejects each provider's built-in search |

### What each route supports (tested 2026-09-29)

| | ChatGPT (OpenAI route) | Claude (Anthropic route) | Gemini (Google route) |
|---|---|---|---|
| **Base URL** | `https://proxy.litechat.ai/openai/v1` | `https://proxy.litechat.ai/anthropic/v1` | `https://proxy.litechat.ai/google/v1beta` |
| **Streaming** | ✓ (Chat Completions and Responses) | ✓ | ✓ |
| **Reasoning in the response** | `reasoning_content` field | `thinking` blocks | `thought: true` parts |
| **Thinking effort** | accepted, no measurable effect | not tested | accepted, not measured |
| **Images** | accepted, **unreliable** | accepted, **unreliable** | accepted, **unreliable** |
| **PDFs** | ✗ | ✗ | ✗ |
| **Built-in web search** | not tested | ✗ | ✗ |
| **Custom function tools** | ✓ | not tested | not tested |

`providers.ts` builds the three clients and maps our settings onto them:

```ts
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const openai = createOpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ baseURL: process.env.ANTHROPIC_BASE_URL, apiKey: process.env.ANTHROPIC_API_KEY });
const google = createGoogleGenerativeAI({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL, apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
```

Pass `baseURL` explicitly as above rather than relying on each SDK reading its own env var.

---

## Feature ranking

### ✅ Required: the core of LiteChat (build all of these)

Numbered in build order.

| # | Feature | Why it's core | Est. |
|---|---|---|---|
| R1 | **Streaming chat with one model** (send → tokens appear live, "Thinking… (Xs)" timer, retry + error state for dropped connections) | This is the product | 1h |
| R2 | **Markdown rendering**: sanitized, code highlighting, copy button on code blocks, scrolling tables | Replies are unreadable without it | 30m |
| R3 | **Message persistence**: messages saved, history reloads on refresh | Required for sessions | 30m |
| R4 | **Session sidebar**: list, create, open, rename, delete, newest first, "Untitled session" default | Landing page feature #4, "Session Management" | 45m |
| R5 | **Auto-title** sessions after the first reply (short model call, `maxOutputTokens` ≥ 800) | Makes the sidebar usable | 15m |
| R6 | **Model catalog + capability flags** (`models.ts`: 3 entries, one per label) + **`providers.ts`** with the proxy base URLs | Everything else depends on it | 20m |
| R7 | **Model picker when creating a session** (Cards: ChatGPT / Claude / Gemini, model fixed per session, shown as a pill) | Landing page feature #1, "Multi-Model Support" | 30m |
| R8 | **Thinking display**: a collapsible "Thought for Xs" block that shows the reasoning text, where the route exposes it | Every reply reasons first; this replaces the effort selector, which has no effect here | 20m |
| R9 | **Attachments**: drag/drop, paste, picker; staged pills. **PDFs and text files → text extracted on the server.** Images sent as-is behind the `images` flag | Landing page feature #2, "True Multimodality" | 1h |
| R10 | **Login** (username/password, cookie session, each user sees only their own sessions) | LiteChat is account-based | 45m |

Total for Required: about **5h55m**. Dropping web search and the effort selector saves about 1h20m compared with a real three-provider build. That leaves about 3 hours for deploy, the top nice-to-haves and buffer.

### ⭐ Nice-to-have (in order: do the top ones if you're ahead)

| # | Feature | Est. | Note |
|---|---|---|---|
| N1 | **Global system prompt** (profile page, one textarea) | 20m | High value, very cheap. Tested: "Always answer in French" works. Scheduled in Phase 5 |
| N2 | **Manual memories** (type + text list on profile) + per-session **Include Memories** toggle, added to the system prompt | 45m | Distinctive LiteChat feature. Now fits in the schedule |
| N3 | **Stop generating** button | 15m | The AI SDK gives you `stop()` |
| N4 | **Mobile layout** (sidebar ↔ chat as two screens, bottom-sheet modal) | 30m | Tailwind makes this quick |
| N5 | **Scroll-to-bottom button** + auto-scroll that pauses when the user scrolls up | 15m | |
| N6 | **Office/text attachments** (docx, xlsx, pptx, csv, md, json) turned into text on the server | 45m | Reuses the R9 text-extraction path |
| N7 | **Web search as our own tool**: a `searchWeb` function tool backed by a search API (Tavily, Brave, …), with a Sources list | 1h | Custom function tools work on the proxy. **Needs a separate search API key.** Skip without one |
| N8 | **Allow multiple turns** (tool loop with a step limit) | 20m | Only useful after N7. AI SDK `stopWhen` |
| N9 | **Token display per message** (from usage data) | 30m | Remember the ~200-token hidden persona prompt is counted in input tokens |
| N10 | **Google SSO** | 45m+ | OAuth setup takes time |
| N11 | **Toasts**, empty-state "＋ Start a New Conversation" tile, landing page | 30m | Polish |

### ❌ Not feasible (leave these out on purpose)

| Feature | Why not |
|---|---|
| **Built-in web search** (provider search tools) | The proxy rejects both Anthropic `web_search` (`schema must be an object`) and Gemini `googleSearch` (`functionDeclarations required`). See N7 for the workaround |
| **Thinking effort selector** | The OpenAI route accepts `reasoning_effort`, but low and high produced the same amount of reasoning. A control that does nothing would mislead users |
| **Several models / tiers per provider** | Each key serves one model. LiteChat's Premium / Standard / Value grouping has nothing real to group |
| **Native PDF input** | All three routes reject PDF files. Send extracted text instead (R9) |
| **Prepaid credit + billing accounts** (top-ups, per-session billing account, metered tools) | Needs Stripe, a ledger, per-model pricing and tool metering. That's a day on its own and risky to get wrong. At most, stub a "Credits" label. |
| **Org accounts / IAM console** | Needs multiple tenants and admin roles |
| **Agent mode** (multi-step runs, per-model limits, resumable SSE, cancel) | Needs a background job system and event log |
| **AI memory crawler** (automatic memories from past chats) | Needs a background job, extraction prompts and deduplication |
| **Office document output** (docx/xlsx/pptx) + **slide generation** | Needs file generation and download handling. LiteChat itself hasn't switched these on. |
| **Projects** | No reference UI to copy; LiteChat hasn't built it either |
| **SimGen / Ask apps** | Separate products |
| **Open-weight models** (Kimi, GLM, DeepSeek, Qwen, MiniMax) as separate choices | No key for them |
| **Streams that resume after a disconnect** | Only worth it after agent mode exists |

---

## Implementation phases

Times are clock time from when you start (0:00). Each phase ends with a **Done when** check. Don't move on until it passes.

### Phase 0 · Setup · 0:00 – 0:30

- Scaffold the Next.js + TS + Tailwind project in this repo. Add `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, a PDF text library, and the SQLite library.
- `.env.local` already holds the three `*_BASE_URL` / `*_API_KEY` pairs, and `.gitignore` already excludes `.env*`. Keep it that way.
- The keys were tested with raw HTTP ([api-keys.md](api-keys.md)). Now **test them through the AI SDK**: a small script that streams "hi" from each route via `providers.ts`, with `maxOutputTokens: 800`. Also note which routes produce **reasoning parts** in the AI SDK output. Anthropic and Google return reasoning in their native formats. The OpenAI route puts it in a DeepSeek-style `reasoning_content` field that `@ai-sdk/openai` may not surface. R8 relies on this.
- Write `models.ts` with the **3 models**:

  ```ts
  { id: "gpt-5.6-luna",              name: "ChatGPT", provider: "openai",    description, images: true, documents: true, webSearch: false, multiTurn: false }
  { id: "claude-haiku-4-5-20251001", name: "Claude",  provider: "anthropic", description, images: true, documents: true, webSearch: false, multiTurn: false }
  { id: "gemini-3.8-flash",          name: "Gemini",  provider: "google",    description, images: true, documents: true, webSearch: false, multiTurn: false }
  ```

  `documents: true` means "we extract the text on the server", not that the model reads files. Keep the `webSearch` and `multiTurn` flags so N7 and N8 can switch them on later. Use any of the three for auto-titles (R5).

- Create the database tables:

  ```sql
  users(id, username, password_hash, system_prompt, created_at)
  sessions(id, user_id, name, model_id, include_memories, created_at, updated_at, deleted_at)
  messages(id, session_id, role, content_json, created_at)   -- parts: text/reasoning/file
  memories(id, user_id, type, content, created_at)            -- N2
  ```

**Done when:** `npm run dev` serves a page and the test script gets a streamed reply from **all three** routes through the AI SDK.

### Phase 1 · Streaming chat · 0:30 – 2:00 (R1, R2)

- Build the `/api/chat` route with `streamText` and a hard-coded model. Build the chat page with `useChat`.
- Add the layout: sidebar on the left (empty for now), messages, and the composer at the bottom. Make it look like LiteChat: blue user bubbles, light assistant bubbles, pill row above the input.
- Show the "Thinking… 🤔 (Xs)" timer until the first **answer** token arrives. Reasoning tokens come first and can take several seconds.
- Handle dropped connections: keep `maxRetries`, and if the stream still fails, show an error in the bubble with a **Try again** button (`useChat`'s `regenerate`).
- Render markdown safely, with code highlighting, a copy button on code blocks, and tables that scroll horizontally.

**Done when:** you can hold a multi-turn conversation, code blocks copy correctly, the page doesn't break on long tables, and a failed request shows a retry button instead of hanging.

### Phase 2 · Sessions and persistence · 2:00 – 3:30 (R3, R4, R5)

- Save user and assistant messages (in the `onFinish` callback). Load history when a session opens.
- Sidebar: session list with name and date, **＋** to create, click to open, ✏️ to rename inline, 🗑 to delete (soft delete with `deleted_at`).
- Auto-title: after the first reply, ask for a 3–6 word title with `maxOutputTokens` ≥ 800 and update the sidebar. An empty title means the thinking used up the budget: keep "Untitled session".
- Route `/chat/[sessionId]` so refresh and back/forward work.

**Checkpoint 3:30.** If you're more than 30 minutes behind, drop auto-title and keep "Untitled session".

**Done when:** you can create 3 sessions, refresh the page, and every session reopens with its history. Rename and delete persist.

### Phase 3 · Models and thinking · 3:30 – 4:40 (R6, R7, R8)

- **Select a Model** modal opens when you press ＋. It shows three cards: **ChatGPT**, **Claude**, **Gemini**, each with a short description. Choosing one creates the session with that `model_id`.
- The chat shows a read-only `Model  CLAUDE` pill. The API route reads the model from the session, not from the client.
- **Thinking display:** render reasoning parts in a collapsed "Thought for Xs" block above the answer, and save them with the message. For a route that doesn't surface reasoning parts (see Phase 0), show only the timer.
- Build the pill row so each control is shown or hidden from the model's flags. Phase 4 adds more controls to it.

**Done when:** one session per label (ChatGPT, Claude, Gemini) streams correctly, the reasoning block appears where the route provides it, and asking "Who are you?" in each gives that label's persona name.

### Phase 4 · Attachments · 4:40 – 5:40 (R9)

- 📎 button, drag-and-drop onto the composer, and paste. Show staged pills (48px image thumbnail, file icon for documents, ✕ to remove).
- **PDFs and text files:** extract the text on the server and send it as a text part (`[Attached file: name.pdf]\n…text…`). Never send the PDF file itself, because all three routes reject it. Cap the length and tell the user if you cut it off.
- **Images:** send as AI SDK file parts behind the `images` flag. Testing gave wrong answers on simple colour images (green → "White"), so **test with a real screenshot**. If answers are still unreliable, set `images: false` in `models.ts`. The UI then hides image upload, and nothing looks broken.
- Save a reference to each attachment in `content_json`.

**Checkpoint 5:40.** If you're behind, ship PDFs only and set `images: false`.

**Done when:** you can attach a PDF and get a correct summary on each of the three labels, and image upload is either working on a real screenshot or switched off.

### Phase 5 · Accounts · 5:40 – 6:40 (R10 + N1)

- `/login` page (LiteChat style: centred card, username, password, LOG-IN). Sign-up can be a simple second form or a seed script. Store an HttpOnly cookie session. Protect every API route and filter every query by `user_id`.
- **N1 Global system prompt** on a `/profile` page, added before every conversation's messages.

**Done when:** two different users can't see each other's sessions, and a system prompt like "Always answer in French" takes effect.

### Phase 6 · Deploy · 6:40 – 7:10

- Deploy (Vercel + a hosted database such as Turso or Neon, or a small VPS if you keep SQLite). Set **all six env vars** (three `*_BASE_URL`, three `*_API_KEY`) on the host and test the full flow on the live URL.

**Done when:** the live URL passes the checks from Phases 1–5.

### Phase 7 · Nice-to-haves and buffer · 7:10 – 9:00

Take nice-to-haves in ranked order: **N3 stop button → N2 memories → N5 scroll button → N4 mobile layout**. Try N7 web search only if you have a search API key and at least an hour left. Stop at 8:50, redeploy, and write a short README.

---

## Timeline at a glance

```text
0:00 ─ 0:30  Phase 0  Setup, AI SDK smoke test, models.ts, schema
0:30 ─ 2:00  Phase 1  Streaming chat, retries, markdown     R1 R2
2:00 ─ 3:30  Phase 2  Persistence, sidebar, auto-title      R3 R4 R5   ◆ checkpoint
3:30 ─ 4:40  Phase 3  Model picker, providers.ts, thinking  R6 R7 R8
4:40 ─ 5:40  Phase 4  Attachments (PDF text, images)        R9         ◆ checkpoint
5:40 ─ 6:40  Phase 5  Login, per-user data, system prompt   R10 N1
6:40 ─ 7:10  Phase 6  Deploy
7:10 ─ 9:00  Phase 7  Nice-to-haves (N3 → N2 → N5 → N4), buffer
```

## If you fall badly behind

Keep this order and cut from the bottom up:

1. Streaming chat + markdown (R1, R2): **never cut**
2. Sessions + persistence (R3, R4)
3. Model picker + per-session model (R6, R7)
4. Attachments (R9): PDFs first, images last
5. Login (R10): fall back to a single-user app behind one shared password
6. Thinking display (R8), auto-title (R5)

**Route-specific fallback:** if one route's reasoning or attachment handling fights you for more than 20 minutes, turn that feature off for that model in `models.ts` and move on. The UI already hides controls a model doesn't support, so nothing looks broken. This is exactly how LiteChat handles MiniMax M3, which has no web search.

A working copy with items 1–4 still demonstrates LiteChat's main pitch: several chat assistants in one clean interface.
