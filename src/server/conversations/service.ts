import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  readUIMessageStream,
  streamText,
  type InferUIMessageChunk,
} from "ai";

import { findModel, type CatalogModel } from "@/lib/models";
import type { CurrentUser } from "@/server/current-user";
import type { Db } from "@/server/db";
import {
  conversations,
  messages,
  type ChatMessage,
} from "@/server/db/schema";

import { buildContext } from "./context";
import { applyAutomaticTitle, applyFallbackTitle } from "./titles";

// The Conversation service: the one place that reads and writes
// conversations. Every operation takes the current user and only ever sees
// that user's conversations; anyone else's is simply not found.

export type Conversation = typeof conversations.$inferSelect;

export type OpenConversation = {
  conversation: Conversation;
  messages: ChatMessage[];
};

export type ChatMessageChunk = InferUIMessageChunk<ChatMessage>;

// A reply being streamed. `stream` goes to the browser; the service reads its
// own copy to the end, so the reply is saved even if the browser goes away.
// `done` settles (never rejects) once the reply has been saved or discarded.
export type Reply = {
  stream: ReadableStream<ChatMessageChunk>;
  done: Promise<void>;
};

export class ConversationError extends Error {
  constructor(
    // "not-found": missing, or someone else's. "rejected": the request can't
    // be carried out; `message` is safe to show the user.
    readonly reason: "not-found" | "rejected",
    message: string,
  ) {
    super(message);
    this.name = "ConversationError";
  }
}

type StreamTextOptions = Parameters<typeof streamText>[0];

// Everything a call to one catalog model needs (see Providers' modelCall).
export type ModelSettings = Pick<
  StreamTextOptions,
  "model" | "providerOptions" | "maxOutputTokens"
>;

export type ConversationServiceDeps = {
  db: Db;
  // Resolves a catalog model to a language model. Injected so tests can
  // substitute the AI SDK mock.
  modelFor: (model: CatalogModel) => ModelSettings;
  now?: () => Date;
  // Called with the underlying error whenever a reply fails.
  onReplyError?: (error: unknown, model: CatalogModel) => void;
  // How long a reply may go without sending anything before it counts as
  // failed. Injected so tests don't wait.
  replyIdleTimeoutMs?: number;
};

export type ConversationService = ReturnType<typeof createConversationService>;

const NEW_CONVERSATION_TITLE = "New conversation";

// A proxy connection can open and then never answer. Long enough for a slow
// model to reason before its first token; well short of the ~5 minutes the
// connection would otherwise hang for.
export const REPLY_IDLE_TIMEOUT_MS = 90_000;

export function createConversationService({
  db,
  modelFor,
  now = () => new Date(),
  onReplyError,
  replyIdleTimeoutMs = REPLY_IDLE_TIMEOUT_MS,
}: ConversationServiceDeps) {
  function findOwned(user: CurrentUser, id: string): Conversation | undefined {
    return db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
      .get();
  }

  function requireOwned(user: CurrentUser, id: string): Conversation {
    const conversation = findOwned(user, id);
    if (!conversation) {
      throw new ConversationError("not-found", "Conversation not found.");
    }
    return conversation;
  }

  // Retired models are derived from the catalog, never stored.
  function requireLiveModel(conversation: Conversation): CatalogModel {
    const model = findModel(conversation.modelId);
    if (!model) {
      throw new ConversationError(
        "rejected",
        "This conversation's model is no longer available.",
      );
    }
    return model;
  }

  function history(conversationId: string): ChatMessage[] {
    return db
      .select({ id: messages.id, role: messages.role, parts: messages.parts })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      // Messages saved in the same millisecond keep their insertion order.
      .orderBy(asc(messages.createdAt), asc(sql`rowid`))
      .all();
  }

  // Every saved message bumps the conversation's activity time.
  function saveMessage(
    conversationId: string,
    message: {
      id?: string;
      role: "user" | "assistant";
      parts: ChatMessage["parts"];
    },
  ) {
    const at = now();
    db.transaction((tx) => {
      tx.insert(messages)
        .values({
          id: message.id,
          conversationId,
          role: message.role,
          parts: message.parts,
          createdAt: at,
        })
        .run();
      tx.update(conversations)
        .set({ updatedAt: at })
        .where(eq(conversations.id, conversationId))
        .run();
    });
  }

  // Reads the server's copy of the reply to the end and saves it only if it
  // finished; a reply that failed at any point saves nothing.
  async function saveWhenFinished(
    conversationId: string,
    modelSettings: ModelSettings,
    stream: ReadableStream<ChatMessageChunk>,
  ) {
    let reply: ChatMessage | undefined;
    try {
      for await (const snapshot of readUIMessageStream<ChatMessage>({
        stream,
        terminateOnError: true,
      })) {
        reply = snapshot;
      }
    } catch {
      return;
    }
    if (!reply) return;
    try {
      saveMessage(conversationId, {
        id: reply.id,
        role: "assistant",
        parts: reply.parts,
      });
      await applyAutomaticTitle(db, conversationId, modelSettings);
    } catch (error) {
      console.error(`[conversations] saving a reply failed:`, error);
    }
  }

  async function streamReply(
    conversation: Conversation,
    model: CatalogModel,
  ): Promise<Reply> {
    const failedText = `${model.displayName} didn't answer. Please try again.`;

    // Aborts the model call when nothing has arrived for a while, before the
    // first token or between tokens.
    const idle = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () =>
          idle.abort(
            new DOMException(
              `No reply data for ${replyIdleTimeoutMs}ms`,
              "TimeoutError",
            ),
          ),
        replyIdleTimeoutMs,
      );
    };

    const context = await buildContext(history(conversation.id));
    const modelSettings = modelFor(model);
    resetIdleTimer();
    const result = streamText({
      ...modelSettings,
      messages: context,
      abortSignal: idle.signal,
      onChunk: resetIdleTimer,
      // Failures are reported once, through the UI stream below.
      onError: () => {},
    });

    const [toBrowser, toServer] = result
      .toUIMessageStream<ChatMessage>({
        generateMessageId: () => crypto.randomUUID(),
        onError: (error) => {
          onReplyError?.(error, model);
          return failedText;
        },
      })
      // The AI SDK reports an abort as a stop, not a failure; a stalled reply
      // is a failure, so it shows Try again and saves nothing.
      .pipeThrough(
        new TransformStream<ChatMessageChunk, ChatMessageChunk>({
          transform(chunk, controller) {
            if (chunk.type === "abort" && idle.signal.aborted) {
              onReplyError?.(idle.signal.reason, model);
              controller.enqueue({ type: "error", errorText: failedText });
              return;
            }
            controller.enqueue(chunk);
          },
          flush: () => clearTimeout(idleTimer),
        }),
      )
      .tee();

    return {
      stream: toBrowser,
      done: saveWhenFinished(conversation.id, modelSettings, toServer),
    };
  }

  return {
    async list(user: CurrentUser): Promise<Conversation[]> {
      return db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, user.id))
        .orderBy(desc(conversations.updatedAt), desc(conversations.createdAt))
        .all();
    },

    async start(user: CurrentUser, modelId: string): Promise<Conversation> {
      if (!findModel(modelId)) {
        throw new ConversationError("rejected", "That model isn't available.");
      }
      const at = now();
      return db
        .insert(conversations)
        .values({
          userId: user.id,
          modelId,
          title: NEW_CONVERSATION_TITLE,
          createdAt: at,
          updatedAt: at,
        })
        .returning()
        .get();
    },

    async open(user: CurrentUser, id: string): Promise<OpenConversation | null> {
      const conversation = findOwned(user, id);
      if (!conversation) return null;
      return { conversation, messages: history(conversation.id) };
    },

    async rename(
      user: CurrentUser,
      id: string,
      title: string,
    ): Promise<Conversation> {
      requireOwned(user, id);
      const nextTitle = title.trim();
      if (!nextTitle) {
        throw new ConversationError("rejected", "Enter a conversation title.");
      }
      return db
        .update(conversations)
        .set({ title: nextTitle, titleSource: "user" })
        .where(
          and(eq(conversations.id, id), eq(conversations.userId, user.id)),
        )
        .returning()
        .get();
    },

    async delete(user: CurrentUser, id: string): Promise<void> {
      requireOwned(user, id);
      db.delete(conversations)
        .where(
          and(eq(conversations.id, id), eq(conversations.userId, user.id)),
        )
        .run();
    },

    // Saves the user's message before the model is called, then streams the
    // reply to it.
    async send(
      user: CurrentUser,
      id: string,
      input: { text: string },
    ): Promise<Reply> {
      const conversation = requireOwned(user, id);
      const model = requireLiveModel(conversation);
      const text = input.text.trim();
      if (!text) {
        throw new ConversationError("rejected", "Type a message to send.");
      }
      saveMessage(conversation.id, {
        role: "user",
        parts: [{ type: "text", text }],
      });
      applyFallbackTitle(db, conversation.id, text);
      return streamReply(conversation, model);
    },

    // Streams a new reply to the saved, unanswered last user message.
    async regenerate(user: CurrentUser, id: string): Promise<Reply> {
      const conversation = requireOwned(user, id);
      const model = requireLiveModel(conversation);
      const last = history(conversation.id).at(-1);
      if (last?.role !== "user") {
        throw new ConversationError(
          "rejected",
          "There is no unanswered message to try again.",
        );
      }
      return streamReply(conversation, model);
    },
  };
}
