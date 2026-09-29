# LiteChat

A hosted multi-model AI chat app, rebuilt from a study of litechat.ai. A user signs in, starts conversations with one of several assistant models, and gets streamed replies.

## Language

**User**:
A person with an account, identified by a unique, case-insensitive username. Sees only their own conversations.
_Avoid_: Account, member

**Conversation**:
A titled thread of messages between one user and the assistant, listed in the sidebar.
_Avoid_: Session, chat, thread

**Model**:
An assistant the user picks when starting a conversation (ChatGPT, Claude or Gemini). Chosen once per conversation and never changed.
_Avoid_: Persona, provider, bot

**Retired model**:
A model no longer offered. Its conversations stay readable but cannot be continued.

**Context**:
The part of a conversation sent to the model on a given turn: the system prompt, the newest message, and as many earlier turns as fit the budget. Older turns can fall out of the context while staying in the conversation.
_Avoid_: History, memory

**Reasoning**:
The model's thinking that precedes its answer. Shown to the user and kept with the message, but never sent back to the model on later turns.
_Avoid_: Thoughts, chain of thought

**Attachment**:
A document a user adds to a message. The model receives the document's extracted text, never the file itself.
_Avoid_: Upload, file

**System prompt**:
A user's standing instruction, applied to every one of their conversations from the next turn onward.
_Avoid_: Custom instructions, global prompt

**Login session**:
The signed-in state of a user in a browser, held by a cookie. Unrelated to conversations.
_Avoid_: Session (on its own)
