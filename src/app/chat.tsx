"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const router = useRouter();
  const { messages, sendMessage, regenerate, status, error } =
    useChat<ChatMessage>({
      id: conversationId,
      messages: initialMessages,
      transport,
    });
  const previousStatus = useRef(status);
  const messageList = useRef<HTMLElement>(null);
  const followLatest = useRef(true);
  const [following, setFollowing] = useState(true);
  useEffect(() => {
    if (
      previousStatus.current !== status &&
      (status === "streaming" || status === "ready" || status === "error")
    ) {
      router.refresh();
    }
    previousStatus.current = status;
  }, [router, status]);
  useLayoutEffect(() => {
    if (!followLatest.current || !messageList.current) return;
    messageList.current.scrollTo({ top: messageList.current.scrollHeight });
  }, [messages, status]);
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
      <div className="relative min-h-0 flex-1">
        <main
          ref={messageList}
          onScroll={(event) => {
            const element = event.currentTarget;
            const atBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight < 48;
            if (atBottom !== followLatest.current) {
              followLatest.current = atBottom;
              setFollowing(atBottom);
            }
          }}
          className="h-full overflow-y-auto"
        >
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

        {!following && (
          <button
            type="button"
            aria-label="Scroll to latest message"
            onClick={() => {
              followLatest.current = true;
              setFollowing(true);
              messageList.current?.scrollTo({
                top: messageList.current.scrollHeight,
                behavior: "smooth",
              });
            }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-primary shadow-lg hover:bg-gray-50"
          >
            ↓ Latest
          </button>
        )}
      </div>

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
