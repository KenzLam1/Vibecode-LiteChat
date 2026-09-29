# 10 — System prompt

**What to build:** Users can give standing instructions. A profile page has one system prompt field with a character counter, capped at 4,000 characters. The current system prompt is applied to every one of the user's conversations from their next turn onward, including existing conversations. It is added on top of the proxy's own persona prompt. The app never adds identity or persona instructions of its own.

See spec: User Stories 62–64; `CONTEXT.md` → System prompt.

**Blocked by:** 03 — Persisted conversations

**Status:** implemented

- [x] The profile page saves the system prompt, and it survives a refresh
- [x] More than 4,000 characters can't be saved; the counter shows the limit
- [x] "Always answer in French" takes effect on the next turn of an existing conversation
- [x] Seam-1 test: after changing the system prompt, the next context passed to the mock model uses the new prompt

## Comments

**2026-09-29 — implemented.** Findings:

- The profile route reads at request time, so the saved value survived a real
  page refresh. The client field uses `maxLength`, shows a live `0 / 4,000`
  style counter and the server independently rejects longer input.
- The Conversation service reads `users.system_prompt` immediately before each
  context build. In a live existing Claude conversation, saving `Always answer
  in French` made the next answer `Bleu`.
- The system prompt is the first model message. LiteChat adds no identity or
  persona prompt of its own, and the current value applies to regenerate calls
  as well as new sends.
- The existing column and length check were sufficient; no migration was
  needed.
