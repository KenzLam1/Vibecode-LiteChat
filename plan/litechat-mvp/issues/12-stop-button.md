# 12 — Stop button

**What to build:** Users can cut a reply short. While a reply streams, the send button becomes Stop. Pressing it ends the stream and keeps what was shown: the partial answer (and any reasoning so far) is saved as the assistant message, so it's still there after a refresh.

See spec: User Stories 36–37; Implementation Decisions → Persistence rules.

**Blocked by:** 03 — Persisted conversations

**Status:** implemented

- [x] Stop appears only while a reply streams and ends it immediately
- [x] Seam-1 test: a stopped reply saves the partial text shown so far
- [x] After a refresh, the stopped reply shows exactly the partial text
- [x] The next message after a stop works normally

## Comments

**2026-09-29 — implemented.** Findings:

- Active model calls have a separate user-stop abort signal. The existing idle
  timeout still becomes an error and saves nothing; a user stop remains an
  abort and `readUIMessageStream` yields the partial assistant message for
  persistence.
- In a live Claude run, Stop replaced Send during streaming. The answer ended
  at `Avant d` both before and after refresh, and the following message
  completed normally.
- **The ticket 03 refresh-mid-reply double-reply issue is resolved.** Active
  replies are shared across Next.js server bundles through a process-global
  registry. A reopened page shows `The reply is still finishing` instead of
  Try again, and the service also rejects overlapping sends or regenerates.
- A normal browser disconnect still leaves the server tee running, so refresh
  continues to save the full reply unless the user explicitly presses Stop.
