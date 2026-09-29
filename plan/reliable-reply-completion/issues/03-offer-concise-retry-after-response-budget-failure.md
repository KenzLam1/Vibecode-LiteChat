# 03 — Offer a concise retry after response-budget failure

**What to build:** When a model uses its response budget while reasoning and
produces no answer, explain why retrying the same request may fail again and
offer a safer Try a concise answer action. The action makes one new model call
from the saved user message, steering the model to answer directly and briefly
without duplicating the message or entering an automatic retry loop. Also
suggest that the user split a large request into a smaller first step.

**Blocked by:** 01 — Reject answerless model completions.

**Status:** ready-for-agent

- [x] The response-budget failure names the selected model and states that it
      reached its response limit while reasoning without producing an answer.
- [x] The failure warns that retrying the unchanged request may produce the
      same result.
- [x] The failure suggests splitting a large request into a smaller first
      step.
- [x] The response-budget failure offers Try a concise answer instead of the
      generic Try again action.
- [x] Try a concise answer makes exactly one new model call from the saved,
      unanswered user message without saving a duplicate user message.
- [x] The recovery call asks for a short, direct answer and minimizes extended
      reasoning where the selected model supports that control.
- [x] Recovery instructions affect only that retry and are not persisted as a
      user-authored message or included in later conversation turns.
- [x] A failed concise retry remains an actionable failure and never triggers
      another model call automatically.
- [x] The specialized explanation and concise-retry action remain available
      after reopening or refreshing the conversation.
- [x] A normal answerless completion that did not exhaust the response budget
      retains the existing generic failure and Try again behavior.
- [x] An output-limited reply containing answer text retains its partial answer
      and incomplete warning rather than offering the answerless recovery.
- [x] Explicit user stops, proxy errors, idle timeouts, browser disconnects,
      and overlapping-reply protection retain their existing behavior.
- [x] Safe diagnostics distinguish a concise recovery attempt and its terminal
      outcome without recording prompts, answers, reasoning, attachments,
      system prompts, or API keys.
- [x] Conversation-module tests cover the recovery call, persistence across
      reopen, one-call behavior, and prevention of duplicate user messages.
- [x] Message-rendering tests distinguish the response-budget recovery from
      generic failures and incomplete partial answers.
- [x] The full existing test, typecheck, lint, and build checks pass.
