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
