"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CatalogModel } from "@/lib/models";
import type { ChatMessage } from "@/server/db/schema";

import { Composer } from "./components/composer";
import {
  AssistantBubble,
  MessageBubble,
  hasAnswer,
  hasReasoning,
  hasResponseBudgetFailure,
} from "./components/message-bubble";
import {
  ReplyError,
  ResponseBudgetRecovery,
} from "./components/reply-error";
import { ThinkingTimer } from "./components/thinking-timer";
import { useToast } from "./components/toast";
import { TryAgainButton } from "./components/try-again";

// The server keeps the history, so a request carries only what's new: the
// text of a sent message, or which conversation to regenerate.
const transport = new DefaultChatTransport<ChatMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages, trigger, body }) => {
    if (trigger === "regenerate-message") {
      return {
        body: {
          trigger,
          conversationId: id,
          ...(body?.recovery === "concise"
            ? { recovery: "concise" as const }
            : {}),
        },
      };
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
  const router = useRouter();
  const toast = useToast();
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
  useEffect(() => {
    if (error) toast(error.message);
  }, [error, toast]);
  useLayoutEffect(() => {
    if (!followLatest.current || !messageList.current) return;
    messageList.current.scrollTo({ top: messageList.current.scrollHeight });
  }, [messages, status]);
  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const responseBudgetFailure = Boolean(
    lastMessage && hasResponseBudgetFailure(lastMessage),
  );
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
    const response = await fetch("/api/chat/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    if (!response.ok) toast(await response.text());
  }

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
              responseBudgetFailure ? (
                <ResponseBudgetRecovery
                  modelName={model.displayName}
                  onConciseRetry={() =>
                    void regenerate({ body: { recovery: "concise" } })
                  }
                />
              ) : (
                <div>
                  <TryAgainButton onClick={() => void regenerate()} />
                </div>
              )
            )}
            {initialReplyInProgress && status === "ready" && (
              <p className="text-sm text-gray-500" role="status">
                The reply is still finishing. Refresh in a moment.
              </p>
            )}
            {error && !busy && (
              <ReplyError
                error={error}
                onRetry={() => void regenerate()}
                responseBudgetFailure={responseBudgetFailure}
                modelName={model.displayName}
                onConciseRetry={() =>
                  void regenerate({ body: { recovery: "concise" } })
                }
              />
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
