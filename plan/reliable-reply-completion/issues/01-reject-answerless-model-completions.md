# 01 — Reject answerless model completions

**What to build:** Treat a model stream that naturally finishes without any
nonblank answer as a failed reply. Keep the user's message, discard the
assistant's reasoning-only output, explain whether the response budget was
exhausted or the model otherwise failed to answer, and let the user try again.
Preserve the existing behavior for explicit user stops and other reply
failures.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A natural `length` finish with reasoning but no nonblank answer shows an
      error naming the selected model and explaining that it used its response
      budget before answering.
- [ ] Any other natural finish with no nonblank answer shows a generic error
      naming the selected model and explaining that it did not produce an
      answer.
- [ ] A reasoning-only failed reply saves no assistant message; the user's
      message remains saved and unanswered.
- [ ] The live failure offers Try again without requiring the user to retype
      their message.
- [ ] Reopening or refreshing the conversation shows the unanswered user
      message with Try again and no persisted failed reasoning block.
- [ ] Try again makes one new model call from the saved message without adding
      a duplicate user message.
- [ ] A reasoning-only failure does not trigger automatic title generation.
- [ ] A normal reply containing reasoning followed by answer text remains a
      successful saved reply.
- [ ] Explicitly stopping during reasoning remains a user-stopped reply and
      preserves the partial content according to the existing stop policy.
- [ ] Proxy errors, idle timeouts, browser disconnects, and overlapping-reply
      protection retain their existing behavior.
- [ ] Abnormal terminal diagnostics record the model identifier, normalized
      finish reason, answer presence, and output usage when available.
- [ ] Diagnostics never record user messages, answers, reasoning,
      attachments, system prompts, or API keys.
- [ ] Conversation-module tests deterministically cover `length` and `stop`
      finishes with reasoning but no answer, including persistence and
      regenerate behavior.
- [ ] The full existing test, typecheck, lint, and build checks pass.

