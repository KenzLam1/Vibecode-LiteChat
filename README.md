# LiteChat

LiteChat is a local, multi-model AI chat app inspired by
[litechat.ai](https://litechat.ai/). It provides one place to chat with
ChatGPT, Claude, and Gemini through the BUILD LLM Proxy while keeping accounts,
conversation history, and settings in a local SQLite database.

## Features

- Streamed replies with a thinking timer and collapsible reasoning for models
  that expose it
- Markdown, GitHub-flavored tables, syntax-highlighted code, and copyable code
  blocks
- Persistent conversations with automatic titles, rename, delete, and
  newest-first navigation
- A model picker that fixes the selected model for the life of a conversation
- PDF, TXT, Markdown, CSV, and JSON attachments by picker, drag-and-drop, or
  paste
- Per-user system prompts and isolated conversation history
- Username/password accounts with Argon2 password hashing and sliding login
  sessions
- Stop, retry, idle-timeout, and interrupted-reply handling for unreliable
  model streams
- A 100,000-token estimated context budget with an on-screen notice when older
  turns fall out of context

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer
- Credentials for at least one OpenAI-, Anthropic-, or Google-compatible route

The checked-in defaults target the course-issued BUILD LLM Proxy. Those keys
are not included in this repository. You can instead use your own provider or
compatible gateway by changing that route's base URL, API key, and model ID in
`.env.local`. Configure all three routes to use every model shown in the picker.

## Getting started

1. Clone the repository and select its Node version (if you use `nvm`):

   ```bash
   git clone https://github.com/KenzLam1/Vibecode-LiteChat.git
   cd Vibecode-LiteChat
   nvm install
   ```

2. Install the exact locked dependencies:

   ```bash
   npm ci
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Add credentials to `.env.local`. The proxy base URLs and the default
   database path are already provided. If you use your own provider accounts,
   replace the corresponding base URL and set its `*_MODEL_ID` override to a
   model available to that account.

5. Verify the checkout without making any paid model calls:

   ```bash
   npm run check
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000), create an account, and
   start a conversation.

The SQLite database is created at `data/litechat.db` on first use, and pending
Drizzle migrations are applied automatically. Both `.env.local` and `data/`
are ignored by Git.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_BASE_URL` | OpenAI-compatible proxy endpoint |
| `OPENAI_API_KEY` | Key for the OpenAI-compatible route |
| `OPENAI_MODEL_ID` | Optional model override for the OpenAI route |
| `ANTHROPIC_BASE_URL` | Anthropic-compatible proxy endpoint |
| `ANTHROPIC_API_KEY` | Key for the Anthropic-compatible route |
| `ANTHROPIC_MODEL_ID` | Optional model override for the Anthropic route |
| `GOOGLE_GENERATIVE_AI_BASE_URL` | Google-compatible proxy endpoint |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Key for the Google-compatible route |
| `GOOGLE_GENERATIVE_AI_MODEL_ID` | Optional model override for the Google route |
| `DATABASE_PATH` | SQLite file path; defaults to `./data/litechat.db` |

API keys are read only by server-side code. Do not prefix them with
`NEXT_PUBLIC_` or commit `.env.local`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next.js route types and run TypeScript checks |
| `npm test` | Run the Vitest suite once |
| `npm run check` | Run lint, type checking, and all tests |
| `npm run db:generate` | Generate a migration after a Drizzle schema change |
| `npm run smoke` | Call all three model routes and probe the proxy context limit |

`npm run smoke` makes real model requests, including increasingly large context
probes. Use `PROBE_MODEL` to choose a catalog model and `PROBE_MAX_TOKENS` to
cap the probe (the default is `256000`).

## Architecture

LiteChat is a Next.js 16 App Router application running as one long-lived Node
process. The browser sends only the new message; the server loads authoritative
history from SQLite, builds the bounded model context, and streams the response
through the Vercel AI SDK. Drizzle manages the local schema and migrations.

Uploaded documents are converted to text on the server. Only the filename,
size, extracted text, and truncation flag are saved; the original file bytes
are discarded. Each message accepts up to five documents, and extracted text
is capped at 50,000 characters per document. Scanned PDFs without extractable
text are not supported.

The model catalog and default upstream model IDs live in
[`src/lib/models.ts`](src/lib/models.ts). Add, remove, or retire models there
rather than hard-coding model choices in the UI. Environment overrides change
the upstream ID without changing the catalog entry shown to users.

## Scope and limitations

This project is designed for local use. It uses open sign-up and has no login
rate limiting, email verification, or password reset. Before deploying it,
restrict registration and review the authentication and persistent-storage
design.

Image attachments, web search, tool use, model switching within a conversation,
and resumable streams after a server restart are not implemented. A retired
model's existing conversations remain readable but cannot receive new replies.

## Project documentation

- [`CONTRIBUTING.md`](CONTRIBUTING.md) is the handoff guide for people and
  coding agents making changes.
- [`CONTEXT.md`](CONTEXT.md) defines the project's domain language.
- [`docs/adr/`](docs/adr/) records the architecture decisions.
- [`plan/litechat-mvp/spec.md`](plan/litechat-mvp/spec.md) contains the MVP
  requirements and implementation decisions.
- [`study/`](study/) contains the historical product research that informed the
  build; it describes the reference service, not the current app.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests are expected to
pass the same `npm run check` and `npm run build` commands enforced by CI and
to use the Conventional Commit format documented in [`AGENTS.md`](AGENTS.md).
