# Core features

Each feature is tagged by where the evidence came from: **[seen]** means observed in the live UI, **[code]** means read from the client JS/CSS or API responses, and **[claim]** means marketing copy only.

## 1. Multi-model chat, one model per session

- **[seen]** Clicking **+** next to *Sessions* opens a **Select a Model** modal before the chat is created, so the model is fixed per session. Inside a session the model shows as a read-only pill (`Model  GPT 6 LUNA`).
- **[seen]** The modal has two views:
  - **Cards**: grouped by provider, each with a logo, display name, one-line description, and a tier badge (`PREMIUM TIER` / `STANDARD TIER` / `VALUE TIER`).
  - **Compact**: a sortable table (Provider ↑ / Model / Tier) with a ★ favourite toggle per row.
- **[code]** The chosen view, the sort order and favourites are saved in `localStorage`.
- **[code]** **Retired models**: if a session's model has been retired, a banner says *"This model is retired. You can read this chat, or start a new chat to continue."* and offers a *Start a new chat* button. Old chats stay readable.
- **[code]** Pricing UI classes exist (`.model-price-info`, `.price-tier`, `.price-values`). Per-model prices can be shown, but weren't visible for this account.
- **[claim]** The landing page says "OpenAI (GPT-4o, GPT-5) and Anthropic (Claude Sonnet)". This is out of date; see [models.md](models.md).

## 2. Billing accounts and prepaid credit

- **[seen]** The model modal has a **Billing account** dropdown: *"Costs for this session will be charged to the selected account."* Each session is billed to one account.
- **[seen]** Profile → **Billing Accounts** lists accounts with a type prefix (`[Personal]`), a status badge (`ACTIVE`) and **Available credit** ($2.00 here, likely a free starter credit).
- **[code]** The type prefix implies there are also non-personal (team or org) accounts. A hidden `Manage` link goes to `/iam`, probably an admin or IAM console for org accounts.
- **[code]** Tool use is metered separately. Web search costs **1.4¢** per call on models hosted through Fireworks and **2¢** per call on OpenAI and Anthropic models.

## 3. Chat options bar (per-message controls)

A row of pills sits above the composer (screenshot `01`). Each control appears or disappears depending on what the session's model supports.

| Control | Behaviour |
|---|---|
| **Include Memories** toggle | **[seen][code]** Per-session. Saved server-side via `POST /session/{id}/set-include-memories`. The default is stored in `localStorage`. |
| **Tools** pill → dropdown | **[seen]** *Available tools*: **Web Search** checkbox. Below it, **Allow multiple turns**: *"The model may use tools several times per request."* The pill shows a count of enabled tools. |
| **Thinking effort** select | **[seen][code]** Options come from the model's `reasoning-efforts` (`none`/`low`/`medium`/`high`/`extreme`). Hidden when the model has none. The default comes from the model. |
| **Agent mode** toggle | **[code]** *"Works through tasks in multiple steps. Chat controls return when Agent mode is off."* Hidden for every model right now (`agent-enabled: false`). |

**[code]** The tool list depends on the model. `getAvailableToolsForModel` filters by `model/compatible-tool-names` (`openai/web_search`, `anthropic/web_search`, `fireworks/web_search`). *Allow multiple turns* only appears when `supports-multiple-turns` is true. Tool choices are saved per user in `localStorage`.

## 4. Attachments (multimodal input)

- **[seen]** The composer placeholder reads *"Type a message or drop files here…"* and there is a 📎 button.
- **[code]** Files can be added by drag-and-drop, paste, or file picker. Accepted types: `.pdf .docx .xlsx .pptx .txt .md .json .csv .png .jpg .jpeg .webp .gif`.
- **[code]** Staged files appear as pills in a staging area above the input: a 48×48 thumbnail for images, an icon for other files, and a remove button.
- **[code]** Attachments are gated per model. Image and document support are checked separately (`supports-image-attachments` / `supports-document-attachments`), so a model like GLM 5.2 takes documents but not images.
- **[code]** Messages are sent as `multipart/form-data`.

## 5. Streaming responses and rich rendering

- **[code]** While waiting, the bubble shows a live timer, *"Thinking… 🤔 (3.4s)"*, updated every 100 ms.
- **[code]** Markdown is rendered with `marked`, sanitized with `DOMPurify`, and code is highlighted with `highlight.js`. Code blocks get a **Copy** button. Wide tables scroll horizontally inside the bubble.
- **[code]** **Tool calls** show as cards with a tool name, arguments, and a loading pulse. Stream events include `tool.started`, `tool.sources`, `tool.references`, and `function_call`.
- **[code]** **Citations and footnotes**: inline citation marks with tooltips, plus a *Sources* footnote list under the answer. There is also CSS for Gemini-style "grounding" results, left over from an earlier Gemini integration.
- **[code]** **Inline images** can stream back (`image_url` parts).
- **[code]** **Refusals** are a distinct state. A refusal throws away the partial output and shows a structured refusal message.
- **[code]** Auto-scroll pauses when the user scrolls up, and a *scroll to bottom* button appears.

## 6. Session management

- **[seen]** The sidebar *Sessions* list shows each session's name and date. Hovering shows ✏️ rename and 🗑 delete.
- **[code]** Rename works inline in the sidebar, and on mobile also in the chat header (edit/save/cancel). New sessions start as *"Untitled session"*. The client recognises default names (`isDefaultSessionName`) and auto-titles them.
- **[code]** The sidebar loads more sessions as you scroll. Deletes are soft deletes (`conversation/deleted_at`).
- **[code]** Sessions have a `project_id` field, but no Projects UI exists yet. Projects look like a planned feature.
- **[seen]** An empty state shows a large dashed **＋ Start a New Conversation** tile.

## 7. Personalisation: system prompt and memories

On the Profile page (`/profile`):

- **[seen]** **Global System Prompt**: one textarea, *"This instruction will apply to all chat sessions."*
- **[seen]** **Memory Items**: *"Store personal information that the assistant can remember about you."* Each item has a type (**Preference / Fact / Reminder / Other**) and free text. You can add and delete them.
- **[seen]** **Generate AI Memories** toggle: *"Allow the application to crawl your previous conversations with AI to generate AI-managed 'memories'…"* It is off by default and opt-in. **[code]** `conversation/crawled_at` records which chats the crawler has processed.
- **[code]** Chats only use memories when the per-session **Include Memories** toggle is on (see §3).

## 8. Multi-app shell

- **[seen]** The sidebar has an **Apps** section: **SimGen ↗** (external) and **CHAT**. **[code]** A hidden **Ask** app (`/ask`, unreachable today).
- **[seen]** Profile → **Default App** (SimGen / Ask / Chat) sets where you land after login. SimGen and Ask were shown greyed out.
- **SimGen** (`sim.litechat.ai`) **[seen]** is a separate product: *"Teaching simulators from plain language."* Teachers describe a classroom simulation in chat, get a live preview next to the chat, refine it, snapshot versions, and publish a link for students. Its generated apps get managed services: **a per-sim database, a server-side LLM call (billed), realtime multiplayer, and asset uploads**. It is built on the same brand and account system.

## 9. Built but switched off

| Feature | Evidence |
|---|---|
| **Agent mode** (multi-step runs) | UI toggle plus endpoints `agent-runs`, `agent-run/{id}`, `.../follow?after=cursor` (SSE you can resume), `.../cancel`. Each model has an `agent-capability` with hard limits, e.g. GPT-5.6 Sol: at most 2 web searches, 5 model steps, 120 s, no parallel tool calls. |
| **Office documents** | `office_documents.js`, an `#office-documents` dialog, and `office-capability: {formats: [docx, xlsx, pptx]}`. `office-enabled: false` on every model. |
| **Generate slides** tool | `tools.generate_slides: true` on 15 of 17 models (rate 0¢), but it isn't listed in the Tools dropdown. |
| **Image generation form** | `#image-message-form` / `#image-prompt-input` exist in the DOM and CSS, but the JS never uses them. Probably left over. |

## 10. Mobile and polish

- **[code]** On narrow screens the sidebar and chat are two stacked screens with a back button, not a split view. Modals become bottom sheets. The layout uses `100dvh`, iPhone safe areas, and a 16px input font to stop iOS from zooming.
- **[code]** Toast notifications appear top-right on desktop and top-centre on mobile.
- **[code]** Branding: Fredoka for headings, Inter for body text, Helvetica Neue as secondary. Primary colour `#0780b5` with light-blue accents. Light theme only.
