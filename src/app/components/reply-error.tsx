"use client";

import { AssistantBubble } from "./message-bubble";
import { TryAgainButton } from "./try-again";

const FALLBACK = "The reply failed. Please try again.";

// The chat route sends a short, user-facing sentence when a stream fails. Any
// other error (an HTML error page, a JSON body, a browser network error) is
// replaced by a generic sentence rather than shown raw.
export function replyErrorMessage(error: Error): string {
  const message = error.message.trim();
  if (!message || message.length > 200 || /^[<{[]/.test(message)) {
    return FALLBACK;
  }
  if (/failed to fetch|network ?error|load failed/i.test(message)) {
    return "The connection dropped before the reply arrived. Please try again.";
  }
  return message;
}

export function ReplyError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <AssistantBubble>
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-sm text-red-700">{replyErrorMessage(error)}</p>
        <TryAgainButton onClick={onRetry} />
      </div>
    </AssistantBubble>
  );
}
