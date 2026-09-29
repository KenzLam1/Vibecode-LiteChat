# 09 — Context budget

**What to build:** Long conversations never get stuck. Before each model call, the context is built newest-first: the system prompt and the newest message always go in, then earlier turns until the token budget is reached (tokens estimated as characters ÷ 4). The budget is a named constant, starting at 100k tokens and set from the smoke script's context probe. When older turns are left out, the conversation shows "Older messages are no longer included in the model's context." If the newest message alone is over budget (for example, several huge attachments), it is rejected before any model call with "These attachments are too large to send together. Try fewer files."

See spec: User Stories 48–50; `CONTEXT.md` → Context; Implementation Decisions → Context builder.

**Blocked by:** 08 — Document attachments

**Status:** ready-for-agent

- [ ] Seam-1 test: with a small budget, the mock model receives only the newest turns that fit, and the result reports that turns were dropped
- [ ] Seam-1 test: a newest message over budget is rejected before the model is called, and the user message is not left unanswered in a stuck state
- [ ] The "no longer included" note shows in the conversation when turns are dropped
- [ ] The budget constant's value is justified by the smoke script's probe result
