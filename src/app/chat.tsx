"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import Link from "next/link";
import { useState } from "react";

import type { CatalogModel } from "@/lib/models";
import type { ChatMessage } from "@/server/db/schema";

import { Composer } from "./components/composer";
import {
  AssistantBubble,
  MessageBubble,
  hasAnswer,
  hasReasoning,
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
    const attachments = (messages.at(-1)?.parts ?? []).flatMap((part) =>
      part.type === "file"
        ? [
            {
              filename: part.filename ?? "document",
              mediaType: part.mediaType,
              url: part.url,
            },
          ]
        : [],
    );
    return { body: { trigger, conversationId: id, text, attachments } };
  },
});

function filePart(file: File): Promise<FileUIPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        type: "file",
        filename: file.name,
        mediaType: file.type || "application/octet-stream",
        url: String(reader.result),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function Chat({
  conversationId,
  model,
  initialMessages,
  initialReplyInProgress,
}: {
  conversationId: string;
  model: CatalogModel;
  initialMessages: ChatMessage[];
  initialReplyInProgress: boolean;
}) {
  const [stopError, setStopError] = useState<string>();
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
    busy &&
    !(
      lastMessage?.role === "assistant" &&
      (hasAnswer(lastMessage) || hasReasoning(lastMessage))
    );
  // A reopened conversation whose last message never got an answer.
  const unanswered =
    status === "ready" &&
    lastMessage?.role === "user" &&
    !initialReplyInProgress;

  async function stopReply() {
    setStopError(undefined);
    const response = await fetch("/api/chat/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    if (!response.ok) setStopError(await response.text());
  }

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="font-display text-2xl font-semibold text-primary">
            LiteChat
          </h1>
          <Link href="/profile" className="text-sm font-medium text-primary hover:underline">
            Profile
          </Link>
        </div>
      </header>

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
          {initialReplyInProgress && status === "ready" && (
            <p className="text-sm text-gray-500" role="status">
              The reply is still finishing. Refresh in a moment.
            </p>
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
          error={stopError ?? error?.message}
          onStop={() => void stopReply()}
          onSend={async (text, files) => {
            await sendMessage({
              text,
              files: await Promise.all(files.map(filePart)),
            });
          }}
        />
      </footer>
    </div>
  );
}
