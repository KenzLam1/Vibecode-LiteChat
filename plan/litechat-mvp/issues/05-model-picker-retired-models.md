# 05 — Model picker, fixed model, retired models

**What to build:** Each conversation is tied to one model for life. ＋ opens a "Select a Model" dialog with three cards (ChatGPT, Claude, Gemini; display name and short description from the model catalog). Choosing one creates the conversation with that model. Inside the conversation, the model shows as a read-only pill, and the server always reads the model from the conversation, never from the client. If a conversation's model is no longer in the catalog (a retired model), the conversation stays readable, but a banner says it can't be continued and offers "Start a new conversation"; the composer is disabled.

See spec: User Stories 13–16, 60–61; Implementation Decisions → Model catalog; `CONTEXT.md` → Model, Retired model.

**Blocked by:** 04 — Conversation sidebar

**Status:** implemented

- [x] ＋ opens the dialog; picking a card creates and opens a conversation with that model
- [x] The model pill shows the conversation's model and can't be changed
- [x] One conversation per model streams correctly; "Who are you?" gives each model's persona name
- [x] The chat route ignores any model sent by the client
- [x] Seam-1 tests: a conversation whose model id isn't in the catalog opens, and send to it is rejected
- [x] Temporarily removing a model from the catalog shows the retired banner on its conversations

## Comments

**2026-09-29 — implemented.** Findings:

- The reusable model picker renders every card, display name and description
  from `src/lib/models.ts`; choosing a card sends only its catalog id to the
  authenticated start action. The chat request body has no model field, and
  the Conversation service always resolves the stored `model_id`.
- A catalog miss no longer becomes a 404. The route renders the stored messages,
  a retired-model banner, a retired model pill, a disabled/read-only composer
  replacement, and a model-picker entry point for starting over.
- The production build on port 3001 verified a Claude selection and its fixed
  pill. A disposable row with `retired-example` verified the read-only banner
  and was removed afterward.
- Calling the app's local chat route with “Who are you?” returned `GPT`,
  `Claude`, and `Gemini` from the ChatGPT, Claude, and Gemini conversations,
  respectively. The disposable verification conversations were removed.
