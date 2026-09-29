# 07 — Reasoning block

**What to build:** Users can see the model think. While the model reasons, its reasoning streams into a "Thought for Xs" block above the answer, which collapses once the answer arrives and can be expanded again. Reasoning is stored with the message, so it's still there after a refresh. It is never sent back to the model on later turns. On any route where the AI SDK doesn't surface reasoning parts (as reported by the smoke script), only the thinking timer shows; no custom parser.

See spec: User Stories 22–25; `CONTEXT.md` → Reasoning; Implementation Decisions → Context builder.

**Blocked by:** 02 — Safe markdown, thinking timer, Try again; 03 — Persisted conversations

**Status:** ready-for-agent

- [ ] Reasoning streams live into the block and it collapses when the answer starts
- [ ] The block shows how long the model thought and can be expanded after a refresh
- [ ] Seam-1 test: the context passed to the mock model on the next turn contains no reasoning parts
- [ ] A route without reasoning parts shows the timer only, with no empty block
