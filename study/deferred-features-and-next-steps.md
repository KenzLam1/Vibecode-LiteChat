# Deferred Features and Next Steps

This document compares the current Vibecode-LiteChat implementation with the
features recorded in the historical LiteChat study. The app's core MVP is
substantially complete; most remaining gaps are advanced features that were
deliberately left out of the nine-hour build scope.

## Implemented baseline

- Multi-model chat through the ChatGPT, Claude, and Gemini proxy routes.
- A model picker shown before conversation creation, with one fixed model per
  conversation.
- Readable retired-model conversations that cannot receive new messages.
- Streaming replies, a thinking timer, and persisted collapsible reasoning.
- Safe Markdown, syntax highlighting, copyable code blocks, and horizontally
  scrolling tables.
- Persistent conversations with individual URLs and full history after a
  refresh.
- Sidebar creation, opening, inline renaming, hard deletion, newest-first
  ordering, and an empty-conversation state.
- Immediate fallback titles followed by AI-generated conversation titles.
- PDF, TXT, Markdown, CSV, and JSON attachments through the file picker,
  drag-and-drop, or paste.
- Server-side document text extraction, a five-file limit, a 50,000-character
  per-file limit, truncation notices, and rejection of scanned or empty PDFs.
- A 100,000-token estimated context budget and a warning when older turns fall
  outside the model context.
- Username/password accounts, isolated user data, secure cookie sessions, and
  logout.
- A per-user global system prompt.
- Stop generation while retaining the partial response.
- Retry, idle-timeout, interrupted-stream, and overlapping-request handling.
- Auto-scroll that pauses when the user scrolls upward, a latest-message
  button, and toast notifications.
- Initial handling for answerless completions and output-limited partial
  answers.

## Deferred features

### Personalisation

- Manual memory items with Preference, Fact, Reminder, and Other types.
- A per-conversation Include Memories toggle.
- Opt-in AI memory generation from previous conversations.

### Tools and rich responses

- Web search through a separate search provider.
- Tool-call cards and tool execution status.
- Citations, source tooltips, and answer footnotes.
- Multiple tool-use turns with a bounded step limit.
- Inline generated images and structured refusal rendering.

The proxy rejects the providers' built-in search tools, so web search requires
a separate API such as Tavily or Brave Search.

### Attachments and generated files

- Image attachments and image understanding.
- DOCX, XLSX, and PPTX input extraction.
- Downloadable Office document generation.
- Slide generation.

Native PDF input is not viable through the current proxy; the implemented
server-side text extraction should remain the PDF path.

### Model controls and picker

- Thinking-effort selection.
- Compact model-picker view.
- Favourites and model sorting.
- Value, Standard, and Premium tiers.
- Multiple models from each provider.
- Per-model pricing display.

Thinking effort had no measurable effect during proxy testing, and each course
key exposes only one model. Those controls would currently be misleading.

### Billing and organisations

- Prepaid credits and top-ups.
- Per-conversation billing-account selection.
- Per-message and per-tool cost reporting.
- Organisation accounts, roles, and an IAM console.

### Conversation management

- Paginated or infinite-loading conversation history.
- Soft deletion, trash, and restoration.
- Resumable ordinary chat streams after a disconnect or server restart.
- Summaries of older turns that no longer fit in the model context.

The current app intentionally uses hard deletion rather than LiteChat's soft
deletion model.

### Accounts and production readiness

- Google SSO.
- Password reset and email verification.
- Account deletion.
- Login and sign-up rate limiting.
- Invite-only or otherwise restricted registration.
- Production hosting, durable hosted storage, and backups.

### Advanced product areas

- Agent mode with background runs, hard limits, resumable events, and cancel.
- Projects and project-scoped conversations.
- SimGen and Ask applications.
- A public marketing landing page generated from the model catalog.

### Interface polish

- Dedicated mobile navigation that switches between the sidebar and chat.
- Bottom-sheet dialogs on mobile.
- Dark mode.

## Current unfinished work

An uncommitted feature is in progress to offer **Try a concise answer** when a
model spends its response budget reasoning without producing an answer. It is
intended to retry once with temporary instructions for a short, direct answer,
without duplicating or changing the user's saved message.

At the time of this review:

- All 83 automated tests pass.
- Lint reports no errors.
- Type checking fails because the new code uses `data-reply-failure` in several
  places while the typed AI SDK data-part name is `data-replyFailure`.
- The concise-retry issue's acceptance checklist is still open.

The committed MVP is complete, but the present uncommitted worktree should not
be treated as release-ready until this feature is finished and all checks pass.

## Recommended next steps

1. **Finish concise retry and restore a green build.** Correct the data-part
   naming mismatch, finish the persistence and recovery behaviour, update its
   tests, and run test, typecheck, lint, and production build checks.
2. **Add manual memories.** Implement typed memory items and a per-conversation
   Include Memories toggle. This is the most distinctive missing LiteChat
   feature that does not require an external service.
3. **Improve the mobile experience.** Replace the fixed desktop sidebar layout
   with separate sidebar and chat screens on narrow viewports, and turn dialogs
   into bottom sheets.
4. **Complete document input support.** Add safe server-side extraction for
   DOCX, XLSX, and PPTX while keeping the existing attachment limits and
   extracted-text persistence model.
5. **Expose usage information.** Persist token usage and show it per response;
   add cost estimates only after reliable pricing data is available.
6. **Add custom web search if a search key is available.** Start with one
   bounded search tool and a Sources list, then add multi-turn tools only after
   the single-call path is reliable.
7. **Prepare for deployment.** Restrict registration, add authentication rate
   limits, choose durable hosted storage, introduce backups, and review the
   application's security boundaries.

Billing, organisation accounts, agent mode, Office output generation, and
Projects should remain later-stage work. Each requires a larger subsystem and
is better justified after the core application is deployed and used.
