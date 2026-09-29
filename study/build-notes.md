# Build notes for Vibecode-LiteChat

What to take from the LiteChat study, in the order to build it. See [features.md](features.md) and [architecture.md](architecture.md) for the evidence. Items marked ⚠️ are limited by our API keys; see [api-keys.md](api-keys.md) and [build-plan.md](build-plan.md).

## MVP: what makes it LiteChat

1. **One model per session.** Pick the model when the session is created and show it as a read-only pill. Keep chats with retired models readable, with a "start a new chat" prompt.
2. **Capability-driven composer.** One `/models` endpoint returns each model's flags: thinking efforts, image/doc attachments, tools, multi-turn. The UI shows or hides controls from those flags and never hard-codes model names. This is the key design choice that lets them add models cheaply.
3. **Streaming in one format.** POST the message, then stream the reply over SSE in the OpenAI `chat.completion.chunk` shape. Convert every provider's output to that shape on the server.
4. **Session sidebar.** Auto-titled sessions ("Untitled session" is replaced after the first reply), inline rename, soft delete, and loading more as you scroll.
5. **Safe markdown rendering.** `marked` + `DOMPurify` + `highlight.js`, copy buttons on code blocks, tables that scroll, and a thinking timer while waiting.
6. **Attachments.** Drag, paste, or pick a file; staged pills with thumbnails; image and document support gated per model. ⚠️ The proxy rejects PDFs and reads images unreliably: extract document text on the server, and keep images behind their flag.

## v1: the features that set it apart

7. **Web search tool** with citations and a footnotes list, plus the *Allow multiple turns* option. ⚠️ The proxy rejects built-in search tools; only possible as our own function tool with a separate search API key.
8. **Thinking effort selector**, with the options taken from each model. ⚠️ The effort setting has no measurable effect through the proxy; show the model's reasoning instead.
9. **Global system prompt and typed memories** (preference/fact/reminder/other), a per-session *Include memories* toggle, and an opt-in AI memory crawler.
10. **Model picker** with Cards and Compact views, tier badges, favourites, and sorting. ⚠️ With one model per key we have only 3 cards and no real tiers, so Compact view, favourites and sorting aren't worth building.
11. **Billing**: prepaid credit, billing accounts (personal first, org later), each session tied to one account, and tool calls metered separately.

## Later: what LiteChat itself hasn't switched on yet

12. **Agent mode**: multi-step runs with hard per-model limits (steps, tool calls, time, spend), an SSE stream you can resume with a cursor, and a cancel button.
13. **Office outputs** (docx/xlsx/pptx) and a slide-generation tool.
14. **Projects** (the `project_id` field is already on sessions).

## Things to do differently or better

- **Keep the landing page up to date.** Theirs names GPT-4o, GPT-5 and Claude Sonnet while the app has 17 newer models. Generate the landing page's model list from the same `/models` data.
- **Let people self-sign up.** `/signup` and `/pricing` return 404, so it's unclear how a new user joins.
- **Make plain chat streams resumable too.** Only agent runs have a cursor today. A dropped connection during a long answer loses the rest.
- **Add dark mode.** The CSS only defines a light theme.
- **Split the frontend.** A single 120 KB inline script is hard to work on. Keep the same simple, framework-free approach if we like it, but use modules.
- **Show prices or credit use per message.** The pricing CSS is already there but not shown. Showing cost per reply builds trust with prepaid users.
- **Validate model metadata.** Kimi K3 lists a 1M-token output limit that is bigger than its input limit.
