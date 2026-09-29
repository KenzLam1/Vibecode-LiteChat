import { convertToModelMessages, type ModelMessage } from "ai";

import type { ChatMessage } from "@/server/db/schema";

export const CONTEXT_TOKEN_BUDGET = 100_000;

export class ContextBudgetError extends Error {}

export type BuiltContext = {
  messages: ModelMessage[];
  dropped: boolean;
};

type TextMessage = {
  id: string;
  role: ChatMessage["role"];
  parts: { type: "text"; text: string }[];
};

function estimatedTokens(message: TextMessage): number {
  return Math.ceil(
    message.parts.reduce((characters, part) => characters + part.text.length, 0) /
      4,
  );
}

function estimatedTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// The context builder: what the model sees on a turn, built from the saved
// conversation (oldest first, ending with the message being answered).
//
// Only text goes back. Reasoning is shown to the user but never resent, and
// provider metadata would make the OpenAI route send item references the
// stateless proxy can't resolve.
//
// Attachments become labelled text. Earlier turns are dropped oldest-first
// past the token budget and the result reports when that happened. The user's
// system prompt will go first (ticket 10).
export async function buildContext(
  history: ChatMessage[],
  {
    tokenBudget = CONTEXT_TOKEN_BUDGET,
    systemPrompt,
  }: { tokenBudget?: number; systemPrompt?: string | null } = {},
): Promise<BuiltContext> {
  const textOnly: TextMessage[] = history.flatMap((message) => {
    const parts = message.parts.flatMap((part) => {
      if (part.type === "text") {
        return [{ type: "text" as const, text: part.text }];
      }
      if (part.type === "data-attachment") {
        return [
          {
            type: "text" as const,
            text: `[Attached file: ${part.data.filename}]\n${part.data.text}`,
          },
        ];
      }
      return [];
    });
    if (parts.length === 0) return [];
    return [{ id: message.id, role: message.role, parts }];
  });
  const newest = textOnly.at(-1);
  if (!newest) return { messages: [], dropped: false };
  if (estimatedTokens(newest) > tokenBudget) {
    throw new ContextBudgetError(
      "These attachments are too large to send together. Try fewer files.",
    );
  }

  const activeSystemPrompt = systemPrompt?.trim() ? systemPrompt : undefined;
  let remaining =
    tokenBudget -
    estimatedTokens(newest) -
    (activeSystemPrompt ? estimatedTextTokens(activeSystemPrompt) : 0);
  const selected = [newest];
  const earlier = textOnly.slice(0, -1);
  for (let index = earlier.length - 1; index >= 0; index -= 1) {
    const cost = estimatedTokens(earlier[index]);
    if (cost > remaining) break;
    selected.unshift(earlier[index]);
    remaining -= cost;
  }

  const messages = await convertToModelMessages(selected);
  return {
    messages: activeSystemPrompt
      ? [{ role: "system", content: activeSystemPrompt }, ...messages]
      : messages,
    dropped: selected.length < textOnly.length,
  };
}
