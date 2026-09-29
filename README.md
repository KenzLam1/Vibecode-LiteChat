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
- npm
- OpenAI-, Anthropic-, and Google-compatible keys for the BUILD LLM Proxy

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add the three proxy API keys to `.env.local`. The proxy base URLs and the
   default database path are already provided by `.env.example`.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000), create an account, and
   start a conversation.

The SQLite database is created at `data/litechat.db` on first use, and pending
Drizzle migrations are applied automatically. Both `.env.local` and `data/`
are ignored by Git.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_BASE_URL` | OpenAI-compatible proxy endpoint |
| `OPENAI_API_KEY` | Key for the OpenAI-compatible route |
| `ANTHROPIC_BASE_URL` | Anthropic-compatible proxy endpoint |
| `ANTHROPIC_API_KEY` | Key for the Anthropic-compatible route |
| `GOOGLE_GENERATIVE_AI_BASE_URL` | Google-compatible proxy endpoint |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Key for the Google-compatible route |
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

The model catalog lives in [`src/lib/models.ts`](src/lib/models.ts). Add,
remove, or retire models there rather than hard-coding model choices in the UI.

## Scope and limitations

This project is designed for local use. It uses open sign-up and has no login
rate limiting, email verification, or password reset. Before deploying it,
restrict registration and review the authentication and persistent-storage
design.

Image attachments, web search, tool use, model switching within a conversation,
and resumable streams after a server restart are not implemented. A retired
model's existing conversations remain readable but cannot receive new replies.

## Project documentation

- [`CONTEXT.md`](CONTEXT.md) defines the project's domain language.
- [`docs/adr/`](docs/adr/) records the architecture decisions.
- [`plan/litechat-mvp/spec.md`](plan/litechat-mvp/spec.md) contains the MVP
  requirements and implementation decisions.
- [`study/`](study/) contains the historical product research that informed the
  build; it describes the reference service, not the current app.
