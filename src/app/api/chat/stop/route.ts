import { z } from "zod";

import { conversationService, ConversationError } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

const body = z.object({ conversationId: z.string() });

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request.", { status: 400 });

  try {
    await conversationService().stop(user, parsed.data.conversationId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ConversationError) {
      return new Response(error.message, {
        status: error.reason === "not-found" ? 404 : 400,
      });
    }
    throw error;
  }
}
