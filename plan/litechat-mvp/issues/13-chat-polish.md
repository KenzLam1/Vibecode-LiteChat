# 13 — Chat polish: scroll-to-bottom and toasts

**What to build:** Two small usability fixes. First, the message list follows a streaming reply automatically, pauses following when the user scrolls up, and shows a scroll-to-bottom button that returns to the latest message and resumes following. Second, non-blocking toast notices (top-right) give a single place for errors that don't belong in a message bubble, such as attachment rejections, a failed rename or delete, and a failed login-session check.

See spec: User Story 66; Further Notes → nice-to-haves.

**Blocked by:** 02 — Safe markdown, thinking timer, Try again; 04 — Conversation sidebar

**Status:** ready-for-agent

- [ ] Auto-scroll follows a streaming reply
- [ ] Scrolling up during a stream stops auto-scroll and shows the scroll-to-bottom button
- [ ] The button jumps to the latest message and auto-scroll resumes
- [ ] Attachment rejections and failed rename or delete show as toasts that disappear on their own
- [ ] Toasts never block typing or clicking
