# 03 — Persisted conversations

**What to build:** Conversations survive a refresh. The Conversation service (the spec's main test seam) handles start, open, send and regenerate, always scoped to the current user. Each conversation has its own URL (`/c/<id>`), and opening it loads the full history. The persistence rules from the spec apply: the user message is saved before the model is called; a finished reply is saved even if the browser disconnects mid-stream; a failed reply saves nothing; regenerate replays from the saved, unanswered user message. A conversation whose last user message has no answer shows Try again under it when reopened. Another user's conversation is simply not found.

See spec: User Stories 18, 30–35, 59; Implementation Decisions → Conversation service, Persistence rules; Testing Decisions → Seam 1.

**Blocked by:** 01 — Walking skeleton

**Status:** implemented

- [x] Sending a message in `/c/<id>` and refreshing shows the full history
- [x] Back and forward between two conversation URLs show the right conversations
- [x] Seam-1 tests (in-memory SQLite + AI SDK mock model): user message saved when the reply fails; nothing saved for a failed reply (before or after the first token); finished reply saved; regenerate replays the unanswered message
- [x] Seam-1 test: open and send on another user's conversation return not found
- [x] Reopening a conversation that ends in an unanswered user message shows Try again
- [x] Every saved message bumps the conversation's `updated_at`

## Comments

**2026-09-29 — implemented.** Findings:

- **Service shape.** `createConversationService({ db, modelFor, now?, onReplyError? })` in `src/server/conversations/service.ts` returns `start`, `open`, `send` and `regenerate`. `send` and `regenerate` return `{ stream, done }`: `stream` is the UI message stream for the browser, and `done` settles once the reply has been saved or discarded. For a missing conversation, `open` returns `null`, and `send`/`regenerate` throw `ConversationError` with `reason: "not-found"` (the route answers 404) or `"rejected"` (400, with a message that is safe to show). `src/server/conversations/index.ts` connects the service to the real database and Providers. Tests import `service.ts` directly because `server-only` can't load under Vitest.
- **Saving after a disconnect.** The UI message stream is split with `tee()`. The browser gets one branch, and the service reads the other to the end with `readUIMessageStream({ terminateOnError: true })`. A tee cancels its source only when both branches cancel, so closing the tab doesn't stop the save. Seen in the real app: refreshing mid-reply showed the user message with Try again, and the next refresh showed the finished reply. The SDK's own `toUIMessageStream({ onFinish })` wasn't used. In v6 it fires on cancel with the partial message, which suits stop (ticket 12) but not a disconnect.
- **Refreshing mid-reply shows Try again.** The page can't yet tell that a reply is still streaming on the server, so a conversation reopened during a reply looks unanswered. Pressing Try again then would stream a second reply. This is harmless for now and worth revisiting with ticket 12.
- **Failed replies.** Any `error` chunk, before or after the first token, means nothing is saved. An empty but successful reply is still saved as-is.
- **Stored assistant parts keep `providerMetadata`** (the OpenAI route adds item ids and encrypted reasoning). The context builder strips everything but text, so this metadata never goes back to the proxy.
- **Requests carry only what's new.** `prepareSendMessagesRequest` sends `{ trigger, conversationId, text }` or `{ trigger: "regenerate-message", conversationId }`. The server never trusts history from the client. The user message gets a server id. The assistant id comes from `generateMessageId` and matches the id the browser shows.
- **Message order** is `created_at`, then `rowid`, because a user message and a fast reply can share a millisecond.
- **Seams left for later tickets.** `buildContext` marks where the system prompt (10), token budget with the dropped-turns flag (09) and attachments (08) go. For now a retired-model conversation returns 404 at `/c/<id>` (ticket 05 makes it read-only), and `send` already rejects it. The home page is a single "Start a new conversation" button that uses the first catalog model (tickets 04 and 05 replace it). The Try again under an unanswered message is a placeholder in `src/app/try-again-placeholder.tsx`, to be replaced by ticket 02's button.
- No schema change was needed.
