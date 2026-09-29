# 06 — Conversation titles

**What to build:** The sidebar reads well without any effort from the user. When the first message is sent, the title immediately becomes the first ~40 characters of that message. After the first successful reply, the conversation's own model is asked for a short 3–6 word title, which replaces the fallback. If that call fails or comes back empty, the fallback stays with no error shown. Once the user renames a conversation, nothing automatic ever changes its title, even an AI title that arrives after the rename.

See spec: User Stories 52–54, 56; Implementation Decisions → Title rules.

**Blocked by:** 04 — Conversation sidebar

**Status:** implemented

- [x] The first message sets the fallback title immediately in the sidebar
- [x] The AI title replaces the fallback after the first reply (title call uses `maxOutputTokens` ≥ 800)
- [x] Seam-1 tests: fallback set on first message; auto title replaces fallback; failed or empty title call keeps the fallback; a user rename is never replaced, including when the auto title arrives after the rename
- [x] No error is shown to the user when the title call fails

## Comments

**2026-09-29 — implemented.** Findings:

- Title policy lives in `src/server/conversations/titles.ts`. The first message
  becomes a whitespace-normalized 40-character fallback immediately; longer
  text ends with an ellipsis.
- The first saved assistant reply makes one text-only `generateText` call with
  the conversation's own model settings and at least 800 output tokens. Empty
  output and provider failures are swallowed, leaving the fallback unchanged.
- Automatic writes include `title_source IN ('default', 'fallback')` in the
  update itself. A user rename therefore wins even if the model call began
  before the rename.
- Chat status changes refresh the server-rendered shell so the fallback and
  completed automatic title can appear without a page reload.
- A production-route check moved a ChatGPT conversation from `default` to the
  fallback “Explain why the sky looks blue in simpl…” immediately, then to the
  automatic title “Why the Sky Looks Blue” after the reply. The disposable
  conversation was removed afterward.
