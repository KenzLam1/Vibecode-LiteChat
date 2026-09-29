# Next.js + Vercel AI SDK on one long-lived Node server

We build LiteChat as a single Next.js (App Router, TypeScript, Tailwind) app using the Vercel AI SDK (`streamText` on the server, `useChat` in the browser), run as one persistent Node process (`next start`) rather than serverless functions. The course proxy is flaky and every reply reasons first, so reliability beats fidelity: the AI SDK gives us retries, reasoning parts, stop and regenerate across the three provider formats without hand-written stream parsers, and a long-lived process avoids function timeouts on slow replies and keeps SQLite-on-disk possible.

## Consequences

- Stored messages use the AI SDK's `UIMessage` parts shape. Leaving the SDK later means migrating stored data.
- The app runs locally only (`next start` on the developer's machine); there is no deployed URL. If it is ever deployed, the host must run a persistent Node process, not Vercel serverless.

## Considered Options

- **Vite React + Express + AI SDK**: two processes, CORS and cross-origin cookies for no reliability gain.
- **Vanilla JS + hand-written SSE** (what LiteChat itself does): we would write three stream parsers and our own retry logic inside a 9-hour limit.
