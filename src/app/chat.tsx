"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { CatalogModel } from "@/lib/models";
import type { ChatMessage } from "@/server/db/schema";

import { Composer } from "./components/composer";
import {
  AssistantBubble,
  MessageBubble,
  hasAnswer,
} from "./components/message-bubble";
import { ReplyError } from "./components/reply-error";
import { ThinkingTimer } from "./components/thinking-timer";
import { TryAgainButton } from "./components/try-again";

// The server keeps the history, so a request carries only what's new: the
// text of a sent message, or which conversation to regenerate.
const transport = new DefaultChatTransport<ChatMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages, trigger }) => {
    if (trigger === "regenerate-message") {
      return { body: { trigger, conversationId: id } };
    }
    const text = (messages.at(-1)?.parts ?? [])
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
    return { body: { trigger, conversationId: id, text } };
  },
});

export function Chat({
  conversationId,
  model,
  initialMessages,
}: {
  conversationId: string;
  model: CatalogModel;
  initialMessages: ChatMessage[];
}) {
  const { messages, sendMessage, regenerate, status, error } =
    useChat<ChatMessage>({
      id: conversationId,
      messages: initialMessages,
      transport,
    });
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  // The timer runs from the request until the first answer token; reasoning
  // arriving first doesn't stop it.
  const thinking =
    busy && !(lastMessage?.role === "assistant" && hasAnswer(lastMessage));
  // A reopened conversation whose last message never got an answer.
  const unanswered = status === "ready" && lastMessage?.role === "user";

  return (
    <div className="flex h-dvh w-full flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 && (
            <p className="mt-24 text-center text-gray-500">
              Send a message to start chatting with {model.displayName}.
            </p>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {thinking && (
            <AssistantBubble>
              <ThinkingTimer />
            </AssistantBubble>
          )}
          {unanswered && (
            <div>
              <TryAgainButton onClick={() => void regenerate()} />
            </div>
          )}
          {error && !busy && (
            <ReplyError error={error} onRetry={() => void regenerate()} />
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer
          model={model}
          busy={busy}
          onSend={(text) => void sendMessage({ text })}
        />
      </footer>
    </div>
  );
}
