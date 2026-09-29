# 02 — Safe markdown, thinking timer, Try again

**What to build:** Replies become readable and failures become recoverable. Assistant messages render as markdown, with raw HTML disabled, highlighted code blocks with a Copy button, and wide tables that scroll sideways inside the bubble. Until the first answer token arrives, the bubble shows a live "Thinking… (3.4s)" timer. If the stream fails (proxy timeout, upstream error), the bubble shows a clear error with a Try again button that regenerates the reply. LiteChat's look (primary `#0780b5`, Fredoka + Inter, user and assistant bubbles, pill row above the composer) is applied here.

See spec: User Stories 19–21, 26–29, 32, 38, 65.

**Blocked by:** 01 — Walking skeleton

**Status:** ready-for-agent

- [x] Markdown renders headings, lists, links, tables and code; raw HTML in model output is shown as text, not executed
- [x] Code blocks are syntax-highlighted and Copy puts the exact code on the clipboard
- [x] A very wide table scrolls inside the message without breaking the page layout
- [x] The timer counts up until the first answer token and then disappears
- [ ] A failed request shows an error and Try again instead of hanging; Try again produces a new reply
- [x] Enter sends, Shift+Enter adds a new line, and send is disabled while a reply streams
- [x] LiteChat colours and fonts are applied

## Comments

**2026-09-29 — implemented.** Findings from the tests and a manual run on `localhost:3102` (ChatGPT route):

- **Raw HTML is safe by default.** Without `rehype-raw`, react-markdown turns HTML in the text into plain text nodes, so `<b>`, `<img onerror>` and `<script>` show as literal text. Its default URL transform drops `javascript:` links. Covered by `src/app/components/markdown.test.tsx`.
- **Copy uses the markdown tree, not the DOM.** The code comes from the `pre` node's text with the one trailing newline markdown adds removed, so it matches what the model wrote. Checked in the browser too: the table scrolled inside a 702px bubble (2821px wide) with no page-level horizontal scroll.
- **The timer ignores reasoning.** It runs until the reply has non-blank answer text, not until the stream status becomes `streaming`. Claude and Gemini stream reasoning first, and the status flips on the stream's first chunk, before any answer text. An assistant message with no answer text yet renders nothing, so the reasoning block (ticket 07) needs a place to go.
- **A hung proxy still hangs for about 5 minutes (box left unticked).** During the run the proxy was unreachable. Connect timeouts failed fast: 3 attempts in about 37s, then the route's error text and Try again. But one request connected and then got no response. The timer ran for about 300s until Node dropped the connection. The browser then showed the error, and Try again produced a normal reply. The route needs a timeout, for example `streamText({ timeout: { chunkMs } })` or an `abortSignal`, so a silent proxy becomes an error quickly. That belongs to the route and conversation service (ticket 03), not this UI ticket.
- **Tests:** Vitest stays in the `node` environment. The two component test files opt into `happy-dom` with a `// @vitest-environment happy-dom` comment and use `@testing-library/react`.

