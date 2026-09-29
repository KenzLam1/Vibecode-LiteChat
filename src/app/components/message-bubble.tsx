"use client";

import type { UIMessage } from "ai";
import type { ReactNode } from "react";

import { Markdown } from "./markdown";

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[80%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-white shadow-sm">
      {children}
    </div>
  );
}

export function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 max-w-full self-start rounded-2xl rounded-bl-md border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm">
      {children}
    </div>
  );
}

// The answer text of a message, without reasoning or other parts.
export function answerText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");
}

// True once the first answer token has arrived (reasoning doesn't count).
export function hasAnswer(message: UIMessage): boolean {
  return answerText(message).trim().length > 0;
}

// User text is shown as typed; replies are rendered as markdown. A reply with
// no answer text yet renders nothing: the thinking timer stands in for it.
export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    return <UserBubble>{answerText(message)}</UserBubble>;
  }
  if (!hasAnswer(message)) return null;
  return (
    <AssistantBubble>
      <Markdown>{answerText(message)}</Markdown>
    </AssistantBubble>
  );
}
