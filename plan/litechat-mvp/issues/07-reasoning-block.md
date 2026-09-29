# 07 — Reasoning block

**What to build:** Users can see the model think. While the model reasons, its reasoning streams into a "Thought for Xs" block above the answer, which collapses once the answer arrives and can be expanded again. Reasoning is stored with the message, so it's still there after a refresh. It is never sent back to the model on later turns. On any route where the AI SDK doesn't surface reasoning parts (as reported by the smoke script), only the thinking timer shows; no custom parser.

See spec: User Stories 22–25; `CONTEXT.md` → Reasoning; Implementation Decisions → Context builder.

**Blocked by:** 02 — Safe markdown, thinking timer, Try again; 03 — Persisted conversations

**Status:** ready-for-agent

- [x] Reasoning streams live into the block and it collapses when the answer starts
- [x] The block shows how long the model thought and can be expanded after a refresh
- [x] Seam-1 test: the context passed to the mock model on the next turn contains no reasoning parts
- [x] A route without reasoning parts shows the timer only, with no empty block

## Comments

**2026-09-29 — implemented.** Findings:

- Reasoning duration is measured from the reply request until the first
  nonblank answer token. A small `data-reasoning` part persists that duration
  beside the SDK's reasoning part, without a database migration.
- In a live Claude run the open block streamed reasoning, then collapsed to
  `Thought for 1.5s` when the answer appeared. Persisted Claude and Gemini
  blocks retained their durations and expanded after a refresh.
- ChatGPT still exposes no reasoning text through the SDK. It showed the
  existing timer while waiting and no empty block after the answer.
- The context builder continues to convert only answer text and attachment
  text, so neither reasoning nor its timing marker is sent on later turns.
