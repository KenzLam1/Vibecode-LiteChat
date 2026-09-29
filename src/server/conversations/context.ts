import { convertToModelMessages, type ModelMessage } from "ai";

import type { ChatMessage } from "@/server/db/schema";

// The context builder: what the model sees on a turn, built from the saved
// conversation (oldest first, ending with the message being answered).
//
// Only text goes back. Reasoning is shown to the user but never resent, and
// provider metadata would make the OpenAI route send item references the
// stateless proxy can't resolve.
//
// Still to come: the user's system prompt goes first (ticket 10), and earlier
// turns are dropped oldest-first past the token budget, reporting whether any
// were dropped (ticket 09). Attachments become labelled text (ticket 08).
export async function buildContext(
  history: ChatMessage[],
): Promise<ModelMessage[]> {
  const textOnly = history.flatMap((message) => {
    const parts = message.parts.flatMap((part) =>
      part.type === "text" ? [{ type: "text" as const, text: part.text }] : [],
    );
    if (parts.length === 0) return [];
    return [{ id: message.id, role: message.role, parts }];
  });
  return convertToModelMessages(textOnly);
}
