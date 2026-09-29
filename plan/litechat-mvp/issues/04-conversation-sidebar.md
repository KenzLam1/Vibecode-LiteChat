# 04 — Conversation sidebar

**What to build:** Users can manage their conversations from a sidebar. It lists the user's conversations with title and date, newest activity first. ＋ starts a new conversation (with a default model until ticket 05 adds the picker). Hovering a row shows inline rename and delete. Delete asks for confirmation in the app ("Delete *X*? This can't be undone.") and then removes the conversation and all its messages for good. A user with no conversations sees a large "Start a new conversation" tile.

See spec: User Stories 17, 51, 55, 57–58; Implementation Decisions → hard delete; Schema.

**Blocked by:** 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] The sidebar lists only the current user's conversations, ordered by most recent activity
- [ ] ＋ creates a conversation titled "New conversation" and opens it
- [ ] Inline rename saves and survives a refresh
- [ ] Delete shows an in-app confirmation (no browser `confirm()`); confirming removes the row; refreshing confirms it's gone
- [ ] Seam-1 test: deleting a conversation removes its messages (cascade)
- [ ] Seam-1 test: rename and delete on another user's conversation return not found
- [ ] The empty-state tile appears when the user has no conversations
