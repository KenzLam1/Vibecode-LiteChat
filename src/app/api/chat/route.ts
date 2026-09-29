import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";

import { conversationService, ConversationError } from "@/server/conversations";
import { currentUser } from "@/server/current-user";

// The browser sends only what's new; the history always comes from the
// database, never from the client.
const body = z.discriminatedUnion("trigger", [
  z.object({
    trigger: z.literal("submit-message"),
    conversationId: z.string(),
    text: z.string(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1),
          mediaType: z.string(),
          url: z.string().startsWith("data:"),
        }),
      )
      .optional(),
  }),
  z.object({
    trigger: z.literal("regenerate-message"),
    conversationId: z.string(),
  }),
]);

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return new Response("You're logged out. Log in and try again.", {
      status: 401,
    });
  }
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response("Bad request.", { status: 400 });
  }
  const input = parsed.data;
  const conversations = conversationService();

  try {
    const reply =
      input.trigger === "submit-message"
        ? await conversations.send(user, input.conversationId, {
            text: input.text,
            attachments: input.attachments?.map((attachment) => {
              const comma = attachment.url.indexOf(",");
              const header = attachment.url.slice(0, comma);
              const encoded = attachment.url.slice(comma + 1);
              const data = header.endsWith(";base64")
                ? Uint8Array.from(Buffer.from(encoded, "base64"))
                : new TextEncoder().encode(decodeURIComponent(encoded));
              return {
                filename: attachment.filename,
                mediaType: attachment.mediaType,
                data,
              };
            }),
          })
        : await conversations.regenerate(user, input.conversationId);
    return createUIMessageStreamResponse({ stream: reply.stream });
  } catch (error) {
    if (error instanceof ConversationError) {
      // useChat shows a failed response's body text as the error message.
      return new Response(error.message, {
        status: error.reason === "not-found" ? 404 : 400,
      });
    }
    throw error;
  }
}
