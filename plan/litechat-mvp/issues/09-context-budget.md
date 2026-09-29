# 09 — Context budget

**What to build:** Long conversations never get stuck. Before each model call, the context is built newest-first: the system prompt and the newest message always go in, then earlier turns until the token budget is reached (tokens estimated as characters ÷ 4). The budget is a named constant, starting at 100k tokens and set from the smoke script's context probe. When older turns are left out, the conversation shows "Older messages are no longer included in the model's context." If the newest message alone is over budget (for example, several huge attachments), it is rejected before any model call with "These attachments are too large to send together. Try fewer files."

See spec: User Stories 48–50; `CONTEXT.md` → Context; Implementation Decisions → Context builder.

**Blocked by:** 08 — Document attachments

**Status:** ready-for-agent

- [x] Seam-1 test: with a small budget, the mock model receives only the newest turns that fit, and the result reports that turns were dropped
- [x] Seam-1 test: a newest message over budget is rejected before the model is called, and the user message is not left unanswered in a stuck state
- [x] The "no longer included" note shows in the conversation when turns are dropped
- [x] The budget constant's value is justified by the smoke script's probe result

## Comments

**2026-09-29 — implemented.** Findings:

- `CONTEXT_TOKEN_BUDGET` is 100,000 estimated tokens. The Phase 0 probe
  accepted about 256,000 estimated tokens, so the budget leaves substantial
  room for the proxy's variability and output.
- The builder always keeps the newest message, then adds a contiguous suffix
  of earlier messages newest-first. Estimates use characters divided by four;
  reasoning and context-note data parts never go back to the model.
- A dropped-context marker is stored with the completed assistant message, so
  the warning is visible immediately and still present after a refresh.
- An oversized newest message is rejected before persistence and before the
  model call, so it cannot leave an unanswered user message behind. No schema
  change was needed.
