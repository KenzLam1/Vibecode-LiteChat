# Architecture (as seen from the outside)

Everything here comes from public HTML/CSS, response headers, and the logged-in client's JavaScript and API responses. Items marked *inferred* are educated guesses.

## Stack

| Layer | Finding |
|---|---|
| Edge | **Caddy** reverse proxy (`via: 1.1 Caddy`), Let's Encrypt cert, HTTP/2 and HTTP/3. The IP `145.239.x.x` belongs to OVH, a European VPS host. |
| Backend | *Inferred:* **Clojure**. All JSON keys are namespaced (`model/id`, `conversation/created_at`), there is a `anti-forgery-token` meta tag (ring-anti-forgery), and the Clojure highlight.js grammar is loaded. |
| Frontend | **No framework.** `/chat` is one HTML page with a ~120 KB inline `<script>`. It uses `fetch` plus `EventSource`, stores preferences in `localStorage`, and uses the DOM directly. |
| Frontend libraries (CDN) | `marked` (markdown), `DOMPurify 3.0.8` (sanitising), `highlight.js 11.9.0` (code, GitHub theme), `office_documents.js` (their own). |
| Styles | `styles.css` (~63 KB; comments mention a "2026 Redesign (Figma-aligned)") and `chat.css`. Fonts: Fredoka, Inter, Helvetica Neue. |
| Model hosting | OpenAI and Anthropic through their own APIs. Open-weight models through **Fireworks** (`adapter-key: fireworks`). |

## Routes

| Path | What it is |
|---|---|
| `/` | Static marketing page. On load it calls `GET /api/my-profile/v1/read-profile` and redirects to `/app` if you're logged in. |
| `/login` | Username + password form (`POST /api/login` with JSON) **or** *Login with Google* (`/api/sso/google-redirect`). |
| `/app` | Sends you to your default app (302 to `/login` if not logged in). |
| `/chat` | The chat app. |
| `/profile` | Profile, system prompt, memories, default app, billing. |
| `/ask` | Hidden "Ask" app (error page today). |
| `/iam` | Hidden "Manage" link, *inferred* to be an org/admin console. |
| `sim.litechat.ai` | SimGen, a separate app. |
| `proxy.litechat.ai` | **BUILD LLM Proxy**, same IP as the main site. Key-based API (`lp_…` keys) with `/openai/v1`, `/anthropic/v1` and `/google/v1beta` routes that all run DeepSeek Flash behind persona names. This is what our course keys use. See [api-keys.md](api-keys.md). |
| `/signup`, `/register`, `/pricing` | 404. There is no public self-signup page, so new users probably come in through Google SSO or an invite. |

## Auth and security

- Sessions use a server-set cookie. The login page comments say the token is no longer kept in `localStorage`, which suggests an HttpOnly cookie.
- Every request that isn't GET or HEAD sends an `X-CSRF-Token` header, read from the page's `<meta name="anti-forgery-token">`.
- Response headers include `x-frame-options: SAMEORIGIN`, `nosniff`, and `referrer-policy: strict-origin-when-cross-origin`.
- All model output goes through DOMPurify before it is added to the page.

## API surface (seen in the client)

### Chat: `/api/chat-api/v2/…`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `get-self` | Current user plus billing accounts (fills the billing dropdown) |
| GET | `models` | Model catalog with capability flags (see [models.md](models.md)) |
| GET | `sessions` | List of sessions (loaded more as you scroll) |
| POST | `sessions` | Create a session with the chosen model and billing account (*inferred* from the create flow) |
| GET + write* | `session/{id}` | Read, rename, or delete a session (*the write methods are inferred*) |
| POST | `session/{id}/set-include-memories` | Turn memories on or off for this session |
| POST | `session/{id}/post-message` | Send a user turn as **multipart/form-data** (text, files, tool choices, effort) |
| GET (SSE) | `session/{id}/listen` | Stream the assistant's reply |
| GET/POST* | `session/{id}/agent-runs` | List or start agent runs (*methods inferred*) |
| GET | `agent-run/{id}` | Agent run status |
| GET (SSE) | `agent-run/{id}/follow?after={cursor}` | Stream agent events (`agent_event`), resuming from a cursor |
| POST | `agent-run/{id}/cancel` | Cancel a run |

### Profile: `/api/my-profile/v1/…`

`read-profile`, `set-system-prompt`, `memory-items` (list/create), `memory-item/{id}` (delete), `set-generate-memories`, `set-default-frontend`.

## How a message is sent and streamed

```text
client                                   server
  │ POST /session/{id}/post-message        │  (multipart: text + files + options)
  │ ─────────────────────────────────────► │
  │ GET  /session/{id}/listen  (SSE)       │
  │ ◄───── data: {choices:[{delta:{…}}]} ──│  OpenAI chat.completion.chunk shape
  │ ◄───── data: {…function_call…}         │  tool calls, built up by call_id
  │ ◄───── data: {type:"tool.started"}     │
  │ ◄───── data: {type:"tool.sources"}     │  → citations / footnotes
  │ ◄───── data: {…refusal…}               │  → throw away partial output
  │ ◄───── data: {…image_url…}             │  → inline images
```

- The request and the stream are **separate calls**. The POST starts generation and a separate SSE GET reads it. A code comment says this replaced an earlier WebSocket version: *"D1: EventSource replaces the reference's WebSocket; the server streams `data:` chunks of the same shape"*.
- Because the chunks follow the **OpenAI streaming format**, the server can turn every provider's output (Anthropic, Fireworks, and so on) into one shape. The client only needs one parser.
- Agent runs use a **cursor you can resume** (`follow?after=`). If the connection drops, the client reconnects without losing events. Plain chat streams don't have this.

## Data model (from `GET /sessions`)

```text
conversation/id
conversation/name
conversation/created_at, updated_at
conversation/deleted_at        ← soft delete
conversation/metadata
conversation/crawled_at        ← memory-generation crawler marker
conversation/project_id        ← Projects (no UI yet)
conversation/model_profile_id  ← model is fixed per session
model/name
```

Other entities the client uses: **user profile** (display name, username, id, member since, system prompt, default frontend, generate-memories flag), **memory item** (type ∈ preference/fact/reminder/other, content), **billing account** (type, name, status, available credit), **agent run** (id, status, events).
