import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { models } from "@/lib/models";
import { requireUser } from "@/server/current-user";
import {
  REPLY_MAX_OUTPUT_TOKENS,
  modelCall,
  proxyRequestId,
} from "@/server/providers";

// Walking skeleton: talks to the first catalog model and keeps nothing. The
// conversation service replaces this body once conversations are persisted.
export async function POST(request: Request) {
  await requireUser();
  const { messages }: { messages: UIMessage[] } = await request.json();
  const model = models[0];

  // Only text goes back to the model: reasoning is shown to the user but never
  // resent, and provider metadata would make the OpenAI route send item
  // references the proxy can't resolve.
  const textOnly = messages.map((message) => ({
    ...message,
    parts: message.parts.flatMap((part) =>
      part.type === "text" ? [{ type: "text" as const, text: part.text }] : [],
    ),
  }));

  const result = streamText({
    ...modelCall(model),
    messages: await convertToModelMessages(textOnly),
    maxOutputTokens: REPLY_MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      const requestId = proxyRequestId(error);
      console.error(
        `[chat] ${model.id} reply failed${requestId ? ` (x-request-id ${requestId})` : ""}:`,
        error,
      );
      return `${model.displayName} didn't answer. Please try again.`;
    },
  });
}
