# 06 — Conversation titles

**What to build:** The sidebar reads well without any effort from the user. When the first message is sent, the title immediately becomes the first ~40 characters of that message. After the first successful reply, the conversation's own model is asked for a short 3–6 word title, which replaces the fallback. If that call fails or comes back empty, the fallback stays with no error shown. Once the user renames a conversation, nothing automatic ever changes its title, even an AI title that arrives after the rename.

See spec: User Stories 52–54, 56; Implementation Decisions → Title rules.

**Blocked by:** 04 — Conversation sidebar

**Status:** ready-for-agent

- [ ] The first message sets the fallback title immediately in the sidebar
- [ ] The AI title replaces the fallback after the first reply (title call uses `maxOutputTokens` ≥ 800)
- [ ] Seam-1 tests: fallback set on first message; auto title replaces fallback; failed or empty title call keeps the fallback; a user rename is never replaced, including when the auto title arrives after the rename
- [ ] No error is shown to the user when the title call fails
