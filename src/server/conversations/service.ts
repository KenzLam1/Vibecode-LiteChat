import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  readUIMessageStream,
  streamText,
  type FinishReason,
  type InferUIMessageChunk,
  type LanguageModelUsage,
} from "ai";

import { findModel, type CatalogModel } from "@/lib/models";
import type { CurrentUser } from "@/server/current-user";
import type { Db } from "@/server/db";
import {
  conversations,
  messages,
  users,
  type ChatMessage,
} from "@/server/db/schema";

import {
  buildContext,
  CONTEXT_TOKEN_BUDGET,
  ContextBudgetError,
  type BuiltContext,
} from "./context";
import {
  AttachmentError,
  extractAttachments,
  type AttachmentInput,
} from "./attachments";
import { applyAutomaticTitle, applyFallbackTitle } from "./titles";

export type { AttachmentInput } from "./attachments";

// The Conversation service: the one place that reads and writes
// conversations. Every operation takes the current user and only ever sees
// that user's conversations; anyone else's is simply not found.

export type Conversation = typeof conversations.$inferSelect;

export type OpenConversation = {
  conversation: Conversation;
  messages: ChatMessage[];
  replyInProgress: boolean;
};

export type ChatMessageChunk = InferUIMessageChunk<ChatMessage>;

// A reply being streamed. `stream` goes to the browser; the service reads its
// own copy to the end, so the reply is saved even if the browser goes away.
// `done` settles (never rejects) once the reply has been saved or discarded.
export type Reply = {
  stream: ReadableStream<ChatMessageChunk>;
  done: Promise<void>;
  droppedContext: boolean;
};

export type ReplyRecovery = "concise";

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

type SafeReplyUsage = {
  inputTokens?: number;
  outputTokens?: number;
  textTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export class ReplyTerminalError extends Error {
  readonly details: {
    modelId: string;
    finishReason: FinishReason;
    hasAnswer: boolean;
    recovery: "standard" | ReplyRecovery;
    usage: SafeReplyUsage;
  };

  constructor(
    modelId: string,
    finishReason: FinishReason,
    hasAnswer: boolean,
    usage: LanguageModelUsage,
    recovery?: ReplyRecovery,
  ) {
    super("The model reply ended in an abnormal terminal state.");
    this.name = "ReplyTerminalError";
    this.details = {
      modelId,
      finishReason,
      hasAnswer,
      recovery: recovery ?? "standard",
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        textTokens: usage.outputTokenDetails.textTokens,
        reasoningTokens: usage.outputTokenDetails.reasoningTokens,
        totalTokens: usage.totalTokens,
      },
    };
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
  contextTokenBudget?: number;
  activeReplies?: ActiveReplyRegistry;
};

export type ActiveReplyRegistry = Map<
  string,
  { controller: AbortController; done: Promise<void> }
>;

export type ConversationService = ReturnType<typeof createConversationService>;

const NEW_CONVERSATION_TITLE = "New conversation";
const CONCISE_RECOVERY_INSTRUCTION =
  "For this retry, answer the user's request directly and concisely. Avoid extended reasoning. If the request is too large, provide the smallest useful first step and state what remains.";

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
  contextTokenBudget = CONTEXT_TOKEN_BUDGET,
  activeReplies = new Map(),
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

  function currentSystemPrompt(user: CurrentUser): string | null {
    return (
      db
        .select({ systemPrompt: users.systemPrompt })
        .from(users)
        .where(eq(users.id, user.id))
        .get()?.systemPrompt ?? null
    );
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

  function requireNoActiveReply(conversationId: string) {
    if (activeReplies.has(conversationId)) {
      throw new ConversationError(
        "rejected",
        "A reply is already in progress for this conversation.",
      );
    }
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

  function setReplyFailure(
    conversationId: string,
    messageId: string,
    failed: boolean,
  ) {
    const message = db
      .select({ role: messages.role, parts: messages.parts })
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .get();
    if (message?.role !== "user") return;

    const parts: ChatMessage["parts"] = message.parts.filter(
      (part) => part.type !== "data-replyFailure",
    );
    if (failed) {
      parts.push({
        type: "data-replyFailure",
        data: { reason: "response-budget", recovery: "concise" },
      });
    }
    db.update(messages)
      .set({ parts })
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.conversationId, conversationId),
        ),
      )
      .run();
  }

  function settingsForRecovery(
    model: CatalogModel,
    settings: ModelSettings,
    recovery?: ReplyRecovery,
  ): ModelSettings {
    if (recovery !== "concise") return settings;
    const providerOptions = settings.providerOptions ?? {};
    if (model.route === "anthropic") {
      return {
        ...settings,
        providerOptions: {
          ...providerOptions,
          anthropic: { ...providerOptions.anthropic, effort: "low" },
        },
      };
    }
    if (model.route === "google") {
      const google = providerOptions.google ?? {};
      const thinkingConfig =
        "thinkingConfig" in google &&
        typeof google.thinkingConfig === "object" &&
        google.thinkingConfig !== null
          ? google.thinkingConfig
          : {};
      return {
        ...settings,
        providerOptions: {
          ...providerOptions,
          google: {
            ...google,
            thinkingConfig: { ...thinkingConfig, thinkingLevel: "low" },
          },
        },
      };
    }
    return {
      ...settings,
      providerOptions: {
        ...providerOptions,
        openai: { ...providerOptions.openai, reasoningEffort: "low" },
      },
    };
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
    user: CurrentUser,
    conversation: Conversation,
    model: CatalogModel,
    replyToMessageId: string,
    preparedContext?: BuiltContext,
    recovery?: ReplyRecovery,
  ): Promise<Reply> {
    const failedText = `${model.displayName} didn't answer. Please try again.`;
    const outputLimitedText = `${model.displayName} reached its response limit while reasoning and didn't produce an answer. Retrying unchanged may fail again. Try a concise answer or split the request into a smaller first step.`;
    const reasoningStartedAt = performance.now();
    let sawReasoning = false;
    let reasoningFinished = false;
    let sawAnswer = false;

    // Aborts the model call when nothing has arrived for a while, before the
    // first token or between tokens.
    const idle = new AbortController();
    const stopped = new AbortController();
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

    const standingSystemPrompt = currentSystemPrompt(user);
    const systemPrompt =
      recovery === "concise"
        ? [standingSystemPrompt, CONCISE_RECOVERY_INSTRUCTION]
            .filter((prompt): prompt is string => Boolean(prompt?.trim()))
            .join("\n\n")
        : standingSystemPrompt;
    const context =
      preparedContext ??
      (await buildContext(history(conversation.id), {
        tokenBudget: contextTokenBudget,
        systemPrompt,
      }));
    const modelSettings = settingsForRecovery(
      model,
      modelFor(model),
      recovery,
    );
    resetIdleTimer();
    const result = streamText({
      ...modelSettings,
      messages: context.messages,
      system: context.systemPrompt,
      abortSignal: AbortSignal.any([idle.signal, stopped.signal]),
      onChunk: resetIdleTimer,
      onFinish: ({ finishReason, text, totalUsage }) => {
        const hasAnswer = /\S/.test(text);
        if (!hasAnswer || finishReason === "length") {
          onReplyError?.(
            new ReplyTerminalError(
              model.id,
              finishReason,
              hasAnswer,
              totalUsage,
              recovery,
            ),
            model,
          );
        }
      },
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
            if (chunk.type === "start" && context.dropped) {
              controller.enqueue(chunk);
              controller.enqueue({
                type: "data-context",
                data: { dropped: true },
              });
              return;
            }
            if (
              chunk.type === "reasoning-delta" &&
              /\S/.test(chunk.delta)
            ) {
              sawReasoning = true;
            }
            const answerStarted =
              chunk.type === "text-delta" && /\S/.test(chunk.delta);
            sawAnswer ||= answerStarted;
            const replyEnded =
              chunk.type === "finish" ||
              chunk.type === "abort" ||
              chunk.type === "error";
            if (
              sawReasoning &&
              !reasoningFinished &&
              (answerStarted || replyEnded)
            ) {
              reasoningFinished = true;
              controller.enqueue({
                type: "data-reasoning",
                data: {
                  durationMs: Math.round(performance.now() - reasoningStartedAt),
                  finished: true,
                },
              });
            }
            if (chunk.type === "abort" && idle.signal.aborted) {
              onReplyError?.(idle.signal.reason, model);
              controller.enqueue({ type: "error", errorText: failedText });
              return;
            }
            if (chunk.type === "finish" && !sawAnswer) {
              const responseBudgetFailure = chunk.finishReason === "length";
              setReplyFailure(
                conversation.id,
                replyToMessageId,
                responseBudgetFailure,
              );
              if (responseBudgetFailure) {
                controller.enqueue({
                  type: "data-replyFailure",
                  data: { reason: "response-budget", recovery: "concise" },
                });
              }
              controller.enqueue({
                type: "error",
                errorText:
                  responseBudgetFailure
                    ? outputLimitedText
                    : failedText,
              });
              return;
            }
            if (chunk.type === "finish" && chunk.finishReason === "length") {
              controller.enqueue({
                type: "data-completion",
                data: { incomplete: true, finishReason: "length" },
              });
            }
            controller.enqueue(chunk);
          },
          flush: () => clearTimeout(idleTimer),
        }),
      )
      .tee();

    const active = {
      controller: stopped,
      done: Promise.resolve(),
    };
    activeReplies.set(conversation.id, active);
    const done = saveWhenFinished(
      conversation.id,
      modelSettings,
      toServer,
    ).finally(() => {
      if (activeReplies.get(conversation.id) === active) {
        activeReplies.delete(conversation.id);
      }
    });
    active.done = done;

    return {
      stream: toBrowser,
      done,
      droppedContext: context.dropped,
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
      return {
        conversation,
        messages: history(conversation.id),
        replyInProgress: activeReplies.has(conversation.id),
      };
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
      input: { text: string; attachments?: AttachmentInput[] },
    ): Promise<Reply> {
      const conversation = requireOwned(user, id);
      const model = requireLiveModel(conversation);
      requireNoActiveReply(conversation.id);
      const text = input.text.trim();
      if (!text && !input.attachments?.length) {
        throw new ConversationError("rejected", "Type a message to send.");
      }
      let attachments;
      try {
        attachments = await extractAttachments(input.attachments ?? []);
      } catch (error) {
        if (error instanceof AttachmentError) {
          throw new ConversationError("rejected", error.message);
        }
        throw error;
      }
      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          ...(text ? [{ type: "text" as const, text }] : []),
          ...attachments.map((data) => ({
            type: "data-attachment" as const,
            data,
          })),
        ],
      } satisfies ChatMessage;
      let context;
      try {
        context = await buildContext(
          [...history(conversation.id), userMessage],
          {
            tokenBudget: contextTokenBudget,
            systemPrompt: currentSystemPrompt(user),
          },
        );
      } catch (error) {
        if (error instanceof ContextBudgetError) {
          throw new ConversationError("rejected", error.message);
        }
        throw error;
      }
      saveMessage(conversation.id, userMessage);
      if (text) applyFallbackTitle(db, conversation.id, text);
      return streamReply(user, conversation, model, userMessage.id, context);
    },

    // Streams a new reply to the saved, unanswered last user message.
    async regenerate(
      user: CurrentUser,
      id: string,
      options: { recovery?: ReplyRecovery } = {},
    ): Promise<Reply> {
      const conversation = requireOwned(user, id);
      const model = requireLiveModel(conversation);
      requireNoActiveReply(conversation.id);
      const last = history(conversation.id).at(-1);
      if (last?.role !== "user") {
        throw new ConversationError(
          "rejected",
          "There is no unanswered message to try again.",
        );
      }
      setReplyFailure(conversation.id, last.id, false);
      return streamReply(
        user,
        conversation,
        model,
        last.id,
        undefined,
        options.recovery,
      );
    },

    async stop(user: CurrentUser, id: string): Promise<void> {
      const conversation = requireOwned(user, id);
      const active = activeReplies.get(conversation.id);
      if (!active) {
        throw new ConversationError("rejected", "There is no reply to stop.");
      }
      active.controller.abort(new DOMException("Reply stopped", "AbortError"));
      await active.done;
    },
  };
}
