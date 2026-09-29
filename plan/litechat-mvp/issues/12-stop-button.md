# 12 — Stop button

**What to build:** Users can cut a reply short. While a reply streams, the send button becomes Stop. Pressing it ends the stream and keeps what was shown: the partial answer (and any reasoning so far) is saved as the assistant message, so it's still there after a refresh.

See spec: User Stories 36–37; Implementation Decisions → Persistence rules.

**Blocked by:** 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] Stop appears only while a reply streams and ends it immediately
- [ ] Seam-1 test: a stopped reply saves the partial text shown so far
- [ ] After a refresh, the stopped reply shows exactly the partial text
- [ ] The next message after a stop works normally
