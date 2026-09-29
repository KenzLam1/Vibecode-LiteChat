# 10 — System prompt

**What to build:** Users can give standing instructions. A profile page has one system prompt field with a character counter, capped at 4,000 characters. The current system prompt is applied to every one of the user's conversations from their next turn onward, including existing conversations. It is added on top of the proxy's own persona prompt. The app never adds identity or persona instructions of its own.

See spec: User Stories 62–64; `CONTEXT.md` → System prompt.

**Blocked by:** 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] The profile page saves the system prompt, and it survives a refresh
- [ ] More than 4,000 characters can't be saved; the counter shows the limit
- [ ] "Always answer in French" takes effect on the next turn of an existing conversation
- [ ] Seam-1 test: after changing the system prompt, the next context passed to the mock model uses the new prompt
