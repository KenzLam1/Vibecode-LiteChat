import "server-only";

import { eq } from "drizzle-orm";

import type { CurrentUser } from "@/server/current-user";
import { getDb } from "@/server/db";
import { SYSTEM_PROMPT_MAX_CHARS, users } from "@/server/db/schema";

export class SystemPromptError extends Error {}

export function getSystemPrompt(user: CurrentUser): string {
  return (
    getDb()
      .select({ systemPrompt: users.systemPrompt })
      .from(users)
      .where(eq(users.id, user.id))
      .get()?.systemPrompt ?? ""
  );
}

export function saveSystemPrompt(user: CurrentUser, systemPrompt: string) {
  if (systemPrompt.length > SYSTEM_PROMPT_MAX_CHARS) {
    throw new SystemPromptError(
      `System prompt must be ${SYSTEM_PROMPT_MAX_CHARS.toLocaleString()} characters or fewer.`,
    );
  }
  getDb()
    .update(users)
    .set({ systemPrompt: systemPrompt || null })
    .where(eq(users.id, user.id))
    .run();
}
