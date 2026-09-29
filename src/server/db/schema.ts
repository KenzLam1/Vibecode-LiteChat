import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type { UIMessage } from "ai";

import { SYSTEM_PROMPT_MAX_CHARS } from "@/lib/limits";

export { SYSTEM_PROMPT_MAX_CHARS } from "@/lib/limits";

// IDs are random text, never sequential integers.
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const users = sqliteTable(
  "users",
  {
    id: id(),
    // Stored lowercased, so uniqueness is case-insensitive.
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    systemPrompt: text("system_prompt"),
    createdAt: createdAt(),
  },
  (table) => [
    check("username_lowercase", sql`${table.username} = lower(${table.username})`),
    check(
      "system_prompt_length",
      sql`length(${table.systemPrompt}) <= ${sql.raw(String(SYSTEM_PROMPT_MAX_CHARS))}`,
    ),
  ],
);

export const loginSessions = sqliteTable("login_sessions", {
  // SHA-256 of the login session token; the token itself is never stored.
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

export const titleSources = ["default", "fallback", "auto", "user"] as const;
export type TitleSource = (typeof titleSources)[number];

export const conversations = sqliteTable(
  "conversations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleSource: text("title_source", { enum: titleSources })
      .notNull()
      .default("default"),
    // A catalog model id. Retired models are derived from the catalog, never stored.
    modelId: text("model_id").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
    check(
      "title_source_valid",
      sql`${table.titleSource} in ('default', 'fallback', 'auto', 'user')`,
    ),
  ],
);

// Parts use the AI SDK UIMessage shape: text, reasoning, and an attachment
// data part.
export type AttachmentData = {
  filename: string;
  size: number;
  text: string;
  truncated: boolean;
};
export type ContextData = { dropped: true };
export type ReasoningData = { durationMs: number; finished: true };
export type ChatMessage = UIMessage<
  never,
  {
    attachment: AttachmentData;
    context: ContextData;
    reasoning: ReasoningData;
  }
>;

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    parts: text("parts", { mode: "json" })
      .notNull()
      .$type<ChatMessage["parts"]>(),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    check("role_valid", sql`${table.role} in ('user', 'assistant')`),
  ],
);
