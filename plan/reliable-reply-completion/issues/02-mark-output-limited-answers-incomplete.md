# 02 — Mark output-limited answers as incomplete

**What to build:** Preserve useful answer text when a model reaches its output
limit, but clearly mark the reply as incomplete wherever it is shown. The
warning must survive refreshes while ordinary completed replies remain
unchanged.

**Blocked by:** 01 — Reject answerless model completions.

**Status:** implemented

- [x] A `length` finish containing nonblank answer text saves the assistant
      message instead of treating it as an answerless failure.
- [x] The saved message carries persistent completion data indicating that the
      answer reached the model's output limit.
- [x] The partial answer remains readable and displays a clear warning that it
      may be incomplete.
- [x] The incomplete warning and partial answer remain visible after reopening
      or refreshing the conversation.
- [x] A normal `stop` finish containing answer text saves and renders without
      an incomplete warning.
- [x] Reasoning attached to either a complete or incomplete answer retains its
      existing collapsed and persisted behavior.
- [x] An incomplete saved answer participates in automatic title generation
      under the existing title rules.
- [x] Output-limit diagnostics record the model identifier, `length` finish
      reason, answer presence, and output usage when available without logging
      conversation content or secrets.
- [x] The incomplete marker uses the existing message-parts persistence shape
      and requires no SQLite schema migration.
- [x] Conversation-module tests cover saving and reopening an output-limited
      partial answer and distinguish it from a normal completed answer.
- [x] Message-rendering tests verify that incomplete replies show the warning
      and normal replies do not.
- [x] The full existing test, typecheck, lint, and build checks pass.
