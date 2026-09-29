# Reliable reply completion

Status: ready-for-agent

## Problem Statement

A model can spend its entire output budget on reasoning and finish without
producing an answer. LiteChat currently treats that terminal event as a
successful reply, saves the reasoning-only assistant message, and renders it
as a collapsed reasoning block. The user sees that the model thought for a
while but receives no answer, no explanation, and no Try again action.

This happened in a Claude conversation after the user asked it to start
building a large prototype. The saved assistant message contained 27,275
characters of reasoning, ended abruptly in the middle of generated code, and
contained no answer text. The evidence strongly indicates that the model
reached LiteChat's 8,192-token output limit while still reasoning, although
the exact finish reason was not retained for later diagnosis.

The same missing terminal-state handling can make an answer that reaches the
output limit look complete even when it has been cut off. Increasing the
output budget alone would make replies slower and more expensive without
guaranteeing that a model reserves enough budget for an answer.

## Solution

LiteChat will classify every model stream by its terminal event and whether it
contains a nonblank answer. A naturally finished stream with no answer is a
failed reply: LiteChat will keep the user's message, discard the assistant's
reasoning, explain what happened, and offer Try again. This restores the
existing failure invariant that an unusable assistant reply never becomes
part of a conversation.

When a model reaches its output limit after producing some answer text,
LiteChat will keep the partial answer and mark it visibly as incomplete. A
normal completed answer remains unchanged. An explicit user stop remains
distinct from a model or proxy failure and continues to preserve the partial
content the user saw.

LiteChat will also record safe diagnostic information about terminal events,
including the model, finish reason, answer presence, and token usage when
available. It will never log message text, reasoning, attachments, system
prompts, or API keys.

## User Stories

1. As a user, I want a model that finishes without an answer to be reported as
   a failed reply, so that I do not mistake a reasoning block for a completed
   response.
2. As a user, I want LiteChat to keep my message when a model produces only
   reasoning, so that I can retry without retyping it.
3. As a user, I want a Try again action after a reasoning-only reply, so that I
   can request another response immediately.
4. As a user, I want reasoning from a failed reply excluded from the saved
   conversation, so that an unusable response does not remain after refresh.
5. As a user, I want the failure message to name the selected model, so that I
   know which model failed.
6. As a user, I want a response-budget failure to explain that the model ran
   out of output space before answering, so that the empty result is
   understandable.
7. As a user, I want an otherwise empty normal completion to show a clear
   generic failure, so that unusual model behavior still has a recovery path.
8. As a user, I want a response that reaches the output limit after beginning
   its answer to remain visible, so that useful partial work is not discarded.
9. As a user, I want a saved partial answer to carry a visible warning that it
   may be incomplete, so that I do not rely on it as a finished response.
10. As a user, I want the incomplete warning to remain after refreshing the
    conversation, so that the response is never later presented as complete.
11. As a user, I want a normal answer to render exactly as it does today, so
    that this reliability change does not add noise to successful replies.
12. As a user, I want reasoning followed by an answer to remain a successful
    reply, so that long but valid reasoning is not mistaken for failure.
13. As a user, I want intentionally stopping a reply to preserve the partial
    content already shown, so that this change does not undo my explicit
    choice.
14. As a user, I want a stopped reply to remain distinguishable from a reply
    that exhausted its output budget, so that the app does not blame the model
    for my action.
15. As a user, I want proxy errors and idle timeouts to retain their current
    Retry behavior, so that all failed replies recover consistently.
16. As a user reopening a conversation after a reasoning-only failure, I want
    to see my unanswered message and Try again, so that recovery survives a
    refresh.
17. As a user, I want retrying to make one new model call from the same saved
    message, so that Retry cannot create duplicate user messages.
18. As a user, I want an automatic conversation title to be generated only
    from a usable saved reply, so that a reasoning-only failure has no
    successful-reply side effects.
19. As a developer, I want terminal finish reasons captured before the model
    stream is reduced to a saved assistant message, so that completion policy
    can distinguish success, truncation, failure, and user stop.
20. As a developer, I want safe terminal diagnostics for each abnormal reply,
    so that future reports can be explained without inspecting private model
    content.
21. As a developer, I want reasoning-only and output-limit cases covered by
    deterministic mock-model tests, so that this failure cannot silently
    return.
22. As a developer, I want the output-token limit to remain independently
    configurable, so that completion correctness does not depend on choosing
    a sufficiently large limit.

## Implementation Decisions

- The Conversation module owns terminal reply classification. The browser and
  message renderer consume the resulting success, incomplete, stopped, or
  failure behavior rather than independently inferring it from visible parts.
- The existing Conversation module interface remains the primary seam. No new
  public module is introduced for completion classification.
- The module tracks whether any nonblank answer text was received separately
  from whether reasoning was received.
- A natural finish with no nonblank answer text is a failed reply regardless
  of whether its finish reason is `length`, `stop`, or another provider value.
- A `length` finish with no answer produces a user-facing error stating that
  the selected model used its response budget before producing an answer and
  inviting the user to try again.
- A non-`length` finish with no answer produces a generic user-facing error
  stating that the selected model did not produce an answer and inviting the
  user to try again.
- A failed reasoning-only stream emits the same error shape used by existing
  failed replies. It does not save an assistant message, and the saved user
  message remains the target of the existing regenerate behavior.
- A `length` finish with nonblank answer text saves the assistant message and
  adds persistent message data indicating that the answer reached the output
  limit. The renderer shows a clear incomplete-response warning with that
  message before and after refresh.
- A `stop` finish with nonblank answer text is a normal successful reply.
- Explicit user cancellation remains a stopped reply, not a failure. It keeps
  the partial answer and reasoning currently shown, including the existing
  behavior when the user stops before answer text begins.
- Existing proxy-error and idle-timeout handling remains unchanged. Those
  terminal paths still discard the assistant message and retain the user's
  unanswered message.
- Automatic title generation runs only after an assistant message is saved.
  A reasoning-only failure therefore does not trigger it; an incomplete answer
  that is deliberately saved may trigger it under the existing title rules.
- The finish reason is read from the model stream's terminal event before
  persistence. It is not inferred from output size.
- Abnormal-terminal diagnostics include the conversation model identifier,
  normalized finish reason, whether answer text was present, and output usage
  when the model adapter provides it. Diagnostics exclude all user and model
  content.
- The existing reply-error reporting dependency should carry the structured
  terminal failure rather than requiring callers to inspect stream chunks.
- The incomplete marker is stored in the existing JSON message-parts shape, so
  no SQLite schema migration is required.
- The current 8,192-token reply budget remains unchanged by this feature.
  Raising it may be evaluated separately with proxy health, latency, and usage
  evidence, but it is not a correctness mechanism.
- The model is not prompted to reveal less reasoning or forced to produce an
  answer first as part of this feature. Prompting is not a reliable substitute
  for validating terminal output.

## Testing Decisions

- A good test exercises behavior visible to the user or persisted in the
  conversation: stream errors and warnings, saved messages, Retry eligibility,
  and behavior after reopening. Tests do not assert private helper calls or
  the internal shape of the classifier.
- The primary test surface is the existing Conversation module seam with a
  fresh in-memory SQLite database and the AI SDK mock-model adapter. This is
  the highest existing seam that covers model chunks, terminal classification,
  persistence, regeneration, and reopening without a live proxy.
- Extend the existing scripted mock model so a test can choose its finish
  reason and can finish after reasoning without emitting an answer part.
- Test that reasoning followed by `length` with no answer sends a specific
  response-budget error to the browser, saves only the user message, does not
  generate an automatic title, and allows regenerate to replay that message.
- Test that reasoning followed by `stop` with no answer sends the generic
  no-answer error and saves only the user message.
- Test that a `length` finish after nonblank answer text saves the answer with
  its incomplete marker.
- Test that reopening a conversation retains the incomplete marker and the
  same partial answer.
- Test that a normal `stop` finish after reasoning and answer text remains a
  successful saved reply without an incomplete marker.
- Test that an explicit user stop during reasoning remains persisted according
  to the existing stop policy and is not transformed into a no-answer error.
- Test that existing idle-timeout, failure-before-first-token,
  failure-mid-stream, browser-disconnect, and overlapping-reply behavior still
  passes unchanged.
- Use the existing message-rendering test seam only to verify that a persisted
  incomplete marker renders the warning and that a normal reply does not. No
  new rendering test interface is needed.
- Existing Conversation module and message-rendering tests are the prior art;
  this feature extends their adapters and assertions rather than creating an
  HTTP or end-to-end suite.

## Out of Scope

- Increasing or dynamically selecting the model output-token limit.
- Automatically continuing a response after it reaches the output limit.
- Adding a dedicated Continue button or synthesizing a hidden continuation
  message.
- Changing model prompts to suppress, shorten, or expose reasoning.
- Changing which models expose reasoning in the UI.
- Recovering the incomplete reasoning-only message already stored in the
  reported conversation.
- Adding resumable streams across a server restart.
- Changing the context budget, attachment limits, model catalog, or title
  generation policy beyond preventing title generation for failed replies.
- Adding HTTP-route or browser end-to-end tests where the existing module seams
  already cover the behavior.

## Further Notes

- The reported reproduction is a Claude conversation whose second assistant
  message contains one large reasoning part, no answer part, and a completed
  reasoning-duration marker. Its final characters end in the middle of a
  Python constant declaration, which is consistent with output-budget
  exhaustion.
- The current model stream already exposes a normalized finish reason,
  including `stop`, `length`, `content-filter`, `tool-calls`, `error`, and
  `other`. The feature should preserve that signal instead of attempting to
  reconstruct it after persistence.
- The key invariant is: a naturally finished model call is not a successful
  reply unless it contains a nonblank answer. Reasoning alone never satisfies
  the user's request.
