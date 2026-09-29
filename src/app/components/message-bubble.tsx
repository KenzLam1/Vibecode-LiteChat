"use client";

import type { UIMessage } from "ai";
import { useEffect, useState, type ReactNode } from "react";

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

function reasoningText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "reasoning" ? [part.text] : []))
    .join("\n\n");
}

export function hasReasoning(message: UIMessage): boolean {
  return reasoningText(message).trim().length > 0;
}

function reasoningDuration(message: UIMessage): number | undefined {
  const part = message.parts.find((candidate) => candidate.type === "data-reasoning");
  if (!part || !("data" in part)) return undefined;
  return (part.data as { durationMs?: number }).durationMs;
}

function attachments(message: UIMessage) {
  return message.parts.flatMap((part) => {
    if (part.type === "file") {
      return [{ filename: part.filename ?? "document", truncated: false }];
    }
    if (part.type === "data-attachment") {
      const data = part.data as { filename: string; truncated: boolean };
      return [{ filename: data.filename, truncated: data.truncated }];
    }
    return [];
  });
}

function droppedContext(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      part.type === "data-context" &&
      (part.data as { dropped?: boolean }).dropped === true,
  );
}

function incompleteResponse(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      part.type === "data-completion" &&
      (part.data as { incomplete?: boolean; finishReason?: string }).incomplete ===
        true &&
      (part.data as { finishReason?: string }).finishReason === "length",
  );
}

export function hasResponseBudgetFailure(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      part.type === "data-replyFailure" &&
      (part.data as { reason?: string }).reason === "response-budget",
  );
}

function ContextNote() {
  return (
    <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Older messages are no longer included in the model&apos;s context.
    </p>
  );
}

function IncompleteResponseNote() {
  return (
    <p
      role="status"
      className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      This response may be incomplete because the model reached its output
      limit.
    </p>
  );
}

function ReasoningBlock({ message }: { message: UIMessage }) {
  const durationMs = reasoningDuration(message);
  const finished = hasAnswer(message) || durationMs !== undefined;
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);

  useEffect(() => {
    if (finished) return;
    const startedAt = performance.now();
    const interval = setInterval(
      () => setLiveElapsedMs(performance.now() - startedAt),
      100,
    );
    return () => clearInterval(interval);
  }, [finished]);

  const label = finished
    ? durationMs === undefined
      ? "Thought"
      : `Thought for ${(durationMs / 1000).toFixed(1)}s`
    : `Thinking… (${(liveElapsedMs / 1000).toFixed(1)}s)`;

  return (
    <details open={!finished} className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-gray-600">
        {label}
      </summary>
      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
        {reasoningText(message)}
      </p>
    </details>
  );
}

// User text is shown as typed; replies are rendered as markdown. A reply with
// no answer text yet renders nothing: the thinking timer stands in for it.
export function MessageBubble({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const documents = attachments(message);
    return (
      <UserBubble>
        <div className="flex flex-col gap-2">
          {documents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {documents.map((document, index) => (
                <span
                  key={`${document.filename}-${index}`}
                  className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium"
                >
                  {document.filename}
                </span>
              ))}
            </div>
          )}
          {answerText(message) && <span>{answerText(message)}</span>}
          {documents
            .filter((document) => document.truncated)
            .map((document, index) => (
              <span key={`${document.filename}-truncated-${index}`} className="text-xs text-white/80">
                {document.filename} was truncated to its first 50,000 characters.
              </span>
            ))}
        </div>
      </UserBubble>
    );
  }
  const contextWasDropped = droppedContext(message);
  const incomplete = incompleteResponse(message);
  const reasoning = hasReasoning(message);
  if (!hasAnswer(message) && !reasoning && !contextWasDropped && !incomplete) {
    return null;
  }
  return (
    <AssistantBubble>
      {contextWasDropped && <ContextNote />}
      {reasoning && <ReasoningBlock message={message} />}
      {incomplete && <IncompleteResponseNote />}
      {hasAnswer(message) && <Markdown>{answerText(message)}</Markdown>}
    </AssistantBubble>
  );
}
