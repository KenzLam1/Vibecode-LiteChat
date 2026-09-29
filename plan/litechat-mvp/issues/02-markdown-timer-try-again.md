# 02 — Safe markdown, thinking timer, Try again

**What to build:** Replies become readable and failures become recoverable. Assistant messages render as markdown, with raw HTML disabled, highlighted code blocks with a Copy button, and wide tables that scroll sideways inside the bubble. Until the first answer token arrives, the bubble shows a live "Thinking… (3.4s)" timer. If the stream fails (proxy timeout, upstream error), the bubble shows a clear error with a Try again button that regenerates the reply. LiteChat's look (primary `#0780b5`, Fredoka + Inter, user and assistant bubbles, pill row above the composer) is applied here.

See spec: User Stories 19–21, 26–29, 32, 38, 65.

**Blocked by:** 01 — Walking skeleton

**Status:** ready-for-agent

- [ ] Markdown renders headings, lists, links, tables and code; raw HTML in model output is shown as text, not executed
- [ ] Code blocks are syntax-highlighted and Copy puts the exact code on the clipboard
- [ ] A very wide table scrolls inside the message without breaking the page layout
- [ ] The timer counts up until the first answer token and then disappears
- [ ] A failed request shows an error and Try again instead of hanging; Try again produces a new reply
- [ ] Enter sends, Shift+Enter adds a new line, and send is disabled while a reply streams
- [ ] LiteChat colours and fonts are applied
