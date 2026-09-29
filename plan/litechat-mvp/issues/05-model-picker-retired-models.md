# 05 — Model picker, fixed model, retired models

**What to build:** Each conversation is tied to one model for life. ＋ opens a "Select a Model" dialog with three cards (ChatGPT, Claude, Gemini; display name and short description from the model catalog). Choosing one creates the conversation with that model. Inside the conversation, the model shows as a read-only pill, and the server always reads the model from the conversation, never from the client. If a conversation's model is no longer in the catalog (a retired model), the conversation stays readable, but a banner says it can't be continued and offers "Start a new conversation"; the composer is disabled.

See spec: User Stories 13–16, 60–61; Implementation Decisions → Model catalog; `CONTEXT.md` → Model, Retired model.

**Blocked by:** 04 — Conversation sidebar

**Status:** ready-for-agent

- [ ] ＋ opens the dialog; picking a card creates and opens a conversation with that model
- [ ] The model pill shows the conversation's model and can't be changed
- [ ] One conversation per model streams correctly; "Who are you?" gives each model's persona name
- [ ] The chat route ignores any model sent by the client
- [ ] Seam-1 tests: a conversation whose model id isn't in the catalog opens, and send to it is rejected
- [ ] Temporarily removing a model from the catalog shows the retired banner on its conversations
