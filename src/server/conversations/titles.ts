import { generateText } from "ai";
import { and, count, eq, inArray } from "drizzle-orm";

import type { Db } from "@/server/db";
import { conversations, messages } from "@/server/db/schema";

const FALLBACK_TITLE_CHARS = 40;
export const TITLE_MAX_OUTPUT_TOKENS = 800;

type TitleModelSettings = Pick<
  Parameters<typeof generateText>[0],
  "model" | "providerOptions" | "maxOutputTokens"
>;

function fallbackTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= FALLBACK_TITLE_CHARS) return normalized;
  return `${normalized.slice(0, FALLBACK_TITLE_CHARS - 1).trimEnd()}…`;
}

export function applyFallbackTitle(
  db: Db,
  conversationId: string,
  text: string,
): void {
  db.update(conversations)
    .set({ title: fallbackTitle(text), titleSource: "fallback" })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.titleSource, "default"),
      ),
    )
    .run();
}

export async function applyAutomaticTitle(
  db: Db,
  conversationId: string,
  modelSettings: TitleModelSettings,
): Promise<void> {
  try {
    const assistantMessages = db
      .select({ count: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.role, "assistant"),
        ),
      )
      .get();
    if (assistantMessages?.count !== 1) return;

    const conversation = db
      .select({ title: conversations.title, source: conversations.titleSource })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    if (!conversation || !["default", "fallback"].includes(conversation.source)) {
      return;
    }

    const result = await generateText({
      ...modelSettings,
      maxOutputTokens: Math.max(
        modelSettings.maxOutputTokens ?? 0,
        TITLE_MAX_OUTPUT_TOKENS,
      ),
      prompt:
        "Write a concise 3–6 word title for this conversation. " +
        "Return only the title, with no quotation marks or punctuation.\n\n" +
        `First message: ${conversation.title}`,
    });
    const title = result.text.trim().replace(/^["']|["']$/g, "").trim();
    if (!title) return;

    // The source check makes a user rename win even if it happens while the
    // title request is in flight.
    db.update(conversations)
      .set({ title, titleSource: "auto" })
      .where(
        and(
          eq(conversations.id, conversationId),
          inArray(conversations.titleSource, ["default", "fallback"]),
        ),
      )
      .run();
  } catch {
    // Titles are optional polish. A provider failure must not affect the reply.
  }
}
