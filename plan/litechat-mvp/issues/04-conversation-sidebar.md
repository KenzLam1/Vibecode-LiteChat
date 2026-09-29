# 04 — Conversation sidebar

**What to build:** Users can manage their conversations from a sidebar. It lists the user's conversations with title and date, newest activity first. ＋ starts a new conversation (with a default model until ticket 05 adds the picker). Hovering a row shows inline rename and delete. Delete asks for confirmation in the app ("Delete *X*? This can't be undone.") and then removes the conversation and all its messages for good. A user with no conversations sees a large "Start a new conversation" tile.

See spec: User Stories 17, 51, 55, 57–58; Implementation Decisions → hard delete; Schema.

**Blocked by:** 03 — Persisted conversations

**Status:** implemented

- [x] The sidebar lists only the current user's conversations, ordered by most recent activity
- [x] ＋ creates a conversation titled "New conversation" and opens it
- [x] Inline rename saves and survives a refresh
- [x] Delete shows an in-app confirmation (no browser `confirm()`); confirming removes the row; refreshing confirms it's gone
- [x] Seam-1 test: deleting a conversation removes its messages (cascade)
- [x] Seam-1 test: rename and delete on another user's conversation return not found
- [x] The empty-state tile appears when the user has no conversations

## Comments

**2026-09-29 — implemented.** Findings:

- `list`, `rename` and `delete` are scoped inside the Conversation service. A
  missing or foreign conversation is consistently reported as not found, and
  the existing foreign-key cascade removes its messages without a migration.
- Conversation mutations are authenticated Server Actions. Rename and delete
  revalidate the app layout so the server-rendered sidebar stays authoritative.
- The delete prompt is an app-owned alert dialog with the required title and
  warning; it never calls the browser's `confirm()` API.
- The production build on port 3001 verified create/open, newest-first listing,
  inline rename persistence after reload, and the delete confirmation UI.
