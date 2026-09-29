import { z } from "zod";

import { requireUser } from "@/server/current-user";
import { SYSTEM_PROMPT_MAX_CHARS } from "@/server/db/schema";
import {
  saveSystemPrompt,
  SystemPromptError,
} from "@/server/system-prompt";

const body = z.object({
  systemPrompt: z.string().max(SYSTEM_PROMPT_MAX_CHARS),
});

export async function PUT(request: Request) {
  const user = await requireUser();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(
      `System prompt must be ${SYSTEM_PROMPT_MAX_CHARS.toLocaleString()} characters or fewer.`,
      { status: 400 },
    );
  }
  try {
    saveSystemPrompt(user, parsed.data.systemPrompt);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof SystemPromptError) {
      return new Response(error.message, { status: 400 });
    }
    throw error;
  }
}
