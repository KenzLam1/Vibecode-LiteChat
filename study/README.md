# LiteChat study

> This directory is historical product research. For the current app's
> features, setup, and development commands, see the [project README](../README.md).

A study of **litechat.ai** made on 2026-09-29. It covers the public landing page, the logged-in chat app (as a Personal account), the Profile page, and the SimGen sister app.

## How this was gathered

| Source | What it gave |
|---|---|
| `https://litechat.ai/` (public HTML) | Marketing claims and positioning |
| `https://litechat.ai/login` (public HTML) | Auth methods and login flow |
| `/css/styles.css` (public) | UI component inventory, including features that are hidden in the UI |
| Logged-in app at `/chat` (browser) | Real UI, model catalog JSON from `GET /api/chat-api/v2/models`, the client's API surface, streaming protocol |
| `/profile` (browser) | System prompt, memories, default app, billing |
| `https://sim.litechat.ai/` | SimGen product pitch |
| `https://proxy.litechat.ai` (with the course keys) | How our three API keys behave: routes, models, what works and what doesn't |

**Limits.** No chat messages were sent in the LiteChat app, so no credits were spent. Everything about how responses render (tool calls, citations, refusals, and so on) comes from reading the client JavaScript, not from watching it happen. Agent mode and Office documents exist in the code but are switched off for every model on this account. `/ask` returned an error page.

> Not to be confused with `github.com/DimitriGilbert/LiteChat`. That is an unrelated open-source, local-first, bring-your-own-key chat app with the same name. Web searches mix the two up.

## Files

| File | Contents |
|---|---|
| [features.md](features.md) | Core features, one section each, with what the UI does and how it's gated |
| [models.md](models.md) | The full model catalog: tiers, reasoning levels, attachment and tool support, limits |
| [architecture.md](architecture.md) | Stack, auth, API endpoints, streaming protocol, data model |
| [api-keys.md](api-keys.md) | The three course keys (BUILD LLM Proxy): base URLs, tested capabilities, gotchas |
| [build-plan.md](build-plan.md) | **9-hour plan**: features ranked Required / Nice-to-have / Not feasible, in timed phases |
| [build-notes.md](build-notes.md) | What to copy for our own build, in priority order, plus things to do differently |
| [screenshots/](screenshots/) | Chat session, tools dropdown, model picker (cards and compact views) |

Screenshots `03` and `04` show the account holder's name in the billing account dropdown. Crop or blur them before sharing outside the team.

## One-paragraph summary

LiteChat is a hosted, **prepaid-credit, multi-provider AI chat** app. It is closer to "one account, many models, pay per use" than to a bring-your-own-key tool. The landing page undersells it: it names GPT-4o, GPT-5 and Claude Sonnet, but the app offers **17 models from 7 providers** (OpenAI, Anthropic, Moonshot/Kimi, Z.ai/GLM, MiniMax, Qwen, DeepSeek). Models are grouped into **Value / Standard / Premium** tiers. The model and billing account are chosen per session when it is created. Around the chat are per-model controls: thinking effort, web search, multi-turn tool use, and image and document attachments. There are also user-level **memories** and a **global system prompt**. Agent mode (multi-step runs you can cancel and resume) and Office document output (docx/xlsx/pptx) are built but disabled. The frontend is a single vanilla-JS page. The backend's namespaced JSON keys (`model/id`, `conversation/id`) and ring-style CSRF token strongly suggest Clojure. Replies stream over **SSE** in OpenAI `chat.completion.chunk` format.

**Our keys.** The three course keys go to BUILD LLM Proxy (`proxy.litechat.ai`). They copy the OpenAI, Anthropic and Google APIs, but all three run DeepSeek Flash; the UI labels them ChatGPT, Claude and Gemini. There is no web search and no native PDF input, and image understanding is unreliable. The build plan is scoped to match. See [api-keys.md](api-keys.md).
