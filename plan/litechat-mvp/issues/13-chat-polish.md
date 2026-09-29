# 13 — Chat polish: scroll-to-bottom and toasts

**What to build:** Two small usability fixes. First, the message list follows a streaming reply automatically, pauses following when the user scrolls up, and shows a scroll-to-bottom button that returns to the latest message and resumes following. Second, non-blocking toast notices (top-right) give a single place for errors that don't belong in a message bubble, such as attachment rejections, a failed rename or delete, and a failed login-session check.

See spec: User Story 66; Further Notes → nice-to-haves.

**Blocked by:** 02 — Safe markdown, thinking timer, Try again; 04 — Conversation sidebar

**Status:** ready-for-agent

- [x] Auto-scroll follows a streaming reply
- [x] Scrolling up during a stream stops auto-scroll and shows the scroll-to-bottom button
- [x] The button jumps to the latest message and auto-scroll resumes
- [ ] Attachment rejections and failed rename or delete show as toasts that disappear on their own
- [x] Toasts never block typing or clicking

## Comments

**2026-09-29 — implemented (attachment wiring pending Lane B).** Findings:

- The chat message viewport follows message/status changes while the user is at
  the bottom. Scrolling more than 48px away pauses following and shows a
  floating “↓ Latest” button; clicking it resumes following with a smooth jump.
- Toasts are provided at the app root, render in an `aria-live` top-right stack,
  use `pointer-events-none`, and remove themselves after four seconds. Rename
  and delete failures call the shared API. A forced stale rename verified the
  notice and automatic dismissal in the production build on port 3001.
- **Toast API for Lane B:** in a Client Component, import `useToast` from
  `@/app/components/toast`, call `const toast = useToast()`, then report an
  attachment rejection with one call such as `toast(rejection.message)`.
  `ToastProvider` is already mounted by the app layout.
- The combined attachment/rename/delete box stays unticked only because Lane B
  owns attachment handling and has not wired its rejection path yet. Rename and
  delete failures are complete in this lane.
