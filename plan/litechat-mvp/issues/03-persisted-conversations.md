# 03 — Persisted conversations

**What to build:** Conversations survive a refresh. The Conversation service (the spec's main test seam) handles start, open, send and regenerate, always scoped to the current user. Each conversation has its own URL (`/c/<id>`), and opening it loads the full history. The persistence rules from the spec apply: the user message is saved before the model is called; a finished reply is saved even if the browser disconnects mid-stream; a failed reply saves nothing; regenerate replays from the saved, unanswered user message. A conversation whose last user message has no answer shows Try again under it when reopened. Another user's conversation is simply not found.

See spec: User Stories 18, 30–35, 59; Implementation Decisions → Conversation service, Persistence rules; Testing Decisions → Seam 1.

**Blocked by:** 01 — Walking skeleton

**Status:** ready-for-agent

- [ ] Sending a message in `/c/<id>` and refreshing shows the full history
- [ ] Back and forward between two conversation URLs show the right conversations
- [ ] Seam-1 tests (in-memory SQLite + AI SDK mock model): user message saved when the reply fails; nothing saved for a failed reply (before or after the first token); finished reply saved; regenerate replays the unanswered message
- [ ] Seam-1 test: open and send on another user's conversation return not found
- [ ] Reopening a conversation that ends in an unanswered user message shows Try again
- [ ] Every saved message bumps the conversation's `updated_at`
