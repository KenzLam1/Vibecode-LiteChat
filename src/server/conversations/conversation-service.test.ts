import type { FinishReason } from "ai";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/current-user";
import { createDb, type Db } from "@/server/db";
import { conversations, messages, users } from "@/server/db/schema";

import {
  ConversationError,
  ReplyTerminalError,
  createConversationService,
  type AttachmentInput,
  type ConversationService,
} from "./service";

// Seam 1: the Conversation service, against a fresh in-memory database and
// the AI SDK mock model.

type LanguageModelV3StreamPart = Awaited<
  ReturnType<MockLanguageModelV3["doStream"]>
>["stream"] extends ReadableStream<infer Part>
  ? Part
  : never;

type CompletedScript = {
  reply?: string;
  reasoning?: string;
  finishReason?: FinishReason;
};

type Script =
  | CompletedScript
  | { failBeforeFirstToken: true }
  | { failAfter: string }
  | { stallAfter: string }
  | { stallReasoningAfter: string };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function generatedText(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage,
    warnings: [],
  };
}

function chunksFor(script: Script): LanguageModelV3StreamPart[] {
  if ("failAfter" in script) {
    return [
      { type: "text-start", id: "t" },
      { type: "text-delta", id: "t", delta: script.failAfter },
      { type: "error", error: new Error("upstream request failed") },
    ];
  }
  if ("stallAfter" in script) {
    return script.stallAfter
      ? [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: script.stallAfter },
        ]
      : [];
  }
  if ("stallReasoningAfter" in script) {
    return script.stallReasoningAfter
      ? [
          { type: "reasoning-start", id: "r" },
          {
            type: "reasoning-delta",
            id: "r",
            delta: script.stallReasoningAfter,
          },
        ]
      : [];
  }
  if ("failBeforeFirstToken" in script) return [];
  const reasoning: LanguageModelV3StreamPart[] = script.reasoning
    ? [
        { type: "reasoning-start", id: "r" },
        { type: "reasoning-delta", id: "r", delta: script.reasoning },
        { type: "reasoning-end", id: "r" },
      ]
    : [];
  const answer: LanguageModelV3StreamPart[] =
    script.reply === undefined
      ? []
      : [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: script.reply },
          { type: "text-end", id: "t" },
        ];
  const finishReason = script.finishReason ?? "stop";
  return [
    ...reasoning,
    ...answer,
    {
      type: "finish",
      usage,
      finishReason: { unified: finishReason, raw: finishReason },
    },
  ];
}

// Sends its chunks, then goes quiet without closing, like a proxy connection
// that stops answering. Aborting it fails the stream, as fetch does.
function stalledStream(
  chunks: LanguageModelV3StreamPart[],
  abortSignal: AbortSignal | undefined,
) {
  return new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      abortSignal?.addEventListener("abort", () =>
        controller.error(abortSignal.reason),
      );
    },
  });
}

// A mock model that plays one script per call, in order.
function scriptedModel(...scripts: Script[]) {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async ({ abortSignal }) => {
      const script = scripts[call++];
      if (!script) throw new Error("The mock model has no script left");
      if ("failBeforeFirstToken" in script) {
        throw new Error("connection timed out");
      }
      if ("stallAfter" in script || "stallReasoningAfter" in script) {
        return { stream: stalledStream(chunksFor(script), abortSignal) };
      }
      return {
        stream: simulateReadableStream({
          chunks: chunksFor(script),
          chunkDelayInMs: 1,
        }),
      };
    },
  });
}

function titledModel(title: string, ...scripts: Script[]) {
  const streaming = scriptedModel(...scripts);
  return new MockLanguageModelV3({
    doStream: (options) => streaming.doStream(options),
    doGenerate: generatedText(title),
  });
}

// Reads everything, like a browser that stays connected.
async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const chunks: T[] = [];
  const reader = stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    chunks.push(next.value);
  }
  return chunks;
}

function textOf(message: { parts: { type: string; text?: string }[] }) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function attachment(
  filename: string,
  contents: string,
  mediaType = "text/plain",
): AttachmentInput {
  return {
    filename,
    mediaType,
    data: new TextEncoder().encode(contents),
  };
}

let db: Db;
let alice: CurrentUser;
let bob: CurrentUser;
let model: MockLanguageModelV3;
let clock: number;
let service: ConversationService;

function addUser(username: string): CurrentUser {
  return db
    .insert(users)
    .values({ username, passwordHash: "!" })
    .returning({ id: users.id, username: users.username })
    .get();
}

// Every service call sees a clock that has moved on by one second.
function useModel(
  next: MockLanguageModelV3,
  options: {
    contextTokenBudget?: number;
    onReplyError?: (error: unknown) => void;
  } = {},
) {
  model = next;
  service = createConversationService({
    db,
    modelFor: () => ({ model }),
    now: () => new Date((clock += 1000)),
    replyIdleTimeoutMs: 50,
    ...options,
  });
}

beforeEach(() => {
  db = createDb(":memory:");
  alice = addUser("alice");
  bob = addUser("bob");
  clock = Date.UTC(2026, 8, 29);
  useModel(scriptedModel());
});

describe("start and open", () => {
  it("opens a new conversation with no messages", async () => {
    const conversation = await service.start(alice, "claude");

    const opened = await service.open(alice, conversation.id);

    expect(opened?.conversation).toMatchObject({
      id: conversation.id,
      modelId: "claude",
    });
    expect(opened?.messages).toEqual([]);
  });
});

describe("list", () => {
  it("lists only the user's conversations by newest activity", async () => {
    const older = await service.start(alice, "claude");
    await service.start(bob, "claude");
    const newer = await service.start(alice, "gemini");

    expect((await service.list(alice)).map(({ id }) => id)).toEqual([
      newer.id,
      older.id,
    ]);
  });
});

describe("rename", () => {
  it("renames a conversation and keeps the new title", async () => {
    const conversation = await service.start(alice, "claude");

    await service.rename(alice, conversation.id, "Research notes");

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "Research notes",
        titleSource: "user",
      },
    );
  });
});

describe("delete", () => {
  it("deletes a conversation and cascades to its messages", async () => {
    useModel(scriptedModel({ reply: "Hello!" }));
    const conversation = await service.start(alice, "claude");
    const reply = await service.send(alice, conversation.id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    await service.delete(alice, conversation.id);

    expect(await service.open(alice, conversation.id)).toBeNull();
    expect(db.select().from(messages).all()).toEqual([]);
  });
});

describe("send", () => {
  it("truncates attachment text over 50,000 characters before saving it", async () => {
    useModel(scriptedModel({ reply: "Done" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, {
      text: "Summarise this",
      attachments: [attachment("notes.txt", "a".repeat(50_001))],
    });
    await drain(reply.stream);
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages[0].parts).toContainEqual({
      type: "data-attachment",
      data: {
        filename: "notes.txt",
        size: 50_001,
        text: "a".repeat(50_000),
        truncated: true,
      },
    });
  });

  it("rejects a disallowed attachment before saving the user message", async () => {
    useModel(scriptedModel({ reply: "Should not run" }));
    const { id } = await service.start(alice, "claude");

    await expect(
      service.send(alice, id, {
        text: "Describe this",
        attachments: [attachment("photo.png", "not really an image", "image/png")],
      }),
    ).rejects.toMatchObject({
      reason: "rejected",
      message: "photo.png isn't a supported document type.",
    });

    expect(model.doStreamCalls).toHaveLength(0);
    expect((await service.open(alice, id))!.messages).toEqual([]);
  });

  it("rejects more than five attachments before saving the user message", async () => {
    useModel(scriptedModel({ reply: "Should not run" }));
    const { id } = await service.start(alice, "claude");

    await expect(
      service.send(alice, id, {
        text: "Compare these",
        attachments: Array.from({ length: 6 }, (_, index) =>
          attachment(`note-${index}.txt`, `Note ${index}`),
        ),
      }),
    ).rejects.toMatchObject({
      reason: "rejected",
      message: "You can attach up to 5 documents per message.",
    });

    expect(model.doStreamCalls).toHaveLength(0);
    expect((await service.open(alice, id))!.messages).toEqual([]);
  });

  it("rejects a PDF with no extractable text before saving", async () => {
    useModel(scriptedModel({ reply: "Should not run" }));
    const { id } = await service.start(alice, "claude");
    const blankPdf = [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj",
      "trailer << /Root 1 0 R >>",
      "%%EOF",
    ].join("\n");

    await expect(
      service.send(alice, id, {
        text: "Read this",
        attachments: [attachment("scan.pdf", blankPdf, "application/pdf")],
      }),
    ).rejects.toMatchObject({
      reason: "rejected",
      message: "No text found in scan.pdf. Scanned PDFs aren't supported.",
    });

    expect(model.doStreamCalls).toHaveLength(0);
    expect((await service.open(alice, id))!.messages).toEqual([]);
  });

  it("sends attachment text with a filename label now and on later turns", async () => {
    useModel(scriptedModel({ reply: "First answer" }, { reply: "Second answer" }));
    const { id } = await service.start(alice, "claude");

    const first = await service.send(alice, id, {
      text: "What does this say?",
      attachments: [attachment("brief.md", "Project North Star")],
    });
    await drain(first.stream);
    await first.done;
    const second = await service.send(alice, id, { text: "What was its name?" });
    await drain(second.stream);
    await second.done;

    const attachmentPart = {
      type: "text",
      text: "[Attached file: brief.md]\nProject North Star",
    };
    expect(model.doStreamCalls[0].prompt).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "What does this say?" },
          attachmentPart,
        ],
      },
    ]);
    expect(model.doStreamCalls[1].prompt).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "What does this say?" },
          attachmentPart,
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "First answer" }] },
      { role: "user", content: [{ type: "text", text: "What was its name?" }] },
    ]);
  });

  it("keeps only the newest turns that fit and reports dropped context", async () => {
    useModel(
      scriptedModel(
        { reply: "old answer" },
        { reply: "recent answer" },
        { reply: "new answer" },
      ),
      { contextTokenBudget: 12 },
    );
    const { id } = await service.start(alice, "claude");
    for (const text of ["old question", "recent question"]) {
      const reply = await service.send(alice, id, { text });
      await drain(reply.stream);
      await reply.done;
    }

    const reply = await service.send(alice, id, { text: "newest question" });
    await drain(reply.stream);
    await reply.done;

    expect(reply.droppedContext).toBe(true);
    expect(model.doStreamCalls[2].prompt).toEqual([
      { role: "user", content: [{ type: "text", text: "recent question" }] },
      { role: "assistant", content: [{ type: "text", text: "recent answer" }] },
      { role: "user", content: [{ type: "text", text: "newest question" }] },
    ]);
    const opened = await service.open(alice, id);
    expect(opened?.messages.at(-1)?.parts).toContainEqual({
      type: "data-context",
      data: { dropped: true },
    });
  });

  it("rejects an over-budget newest message before saving or calling the model", async () => {
    useModel(scriptedModel({ reply: "Should not run" }), {
      contextTokenBudget: 3,
    });
    const { id } = await service.start(alice, "claude");

    await expect(
      service.send(alice, id, {
        text: "Read this",
        attachments: [attachment("large.txt", "far too much attachment text")],
      }),
    ).rejects.toMatchObject({
      reason: "rejected",
      message:
        "These attachments are too large to send together. Try fewer files.",
    });

    expect(model.doStreamCalls).toHaveLength(0);
    expect((await service.open(alice, id))!.messages).toEqual([]);
  });

  it("saves the user message and the finished reply", async () => {
    useModel(scriptedModel({ reply: "Hello there!" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([
      ["user", "Hi"],
      ["assistant", "Hello there!"],
    ]);
  });

  it("saves a finished reply even if the browser disconnects mid-stream", async () => {
    useModel(scriptedModel({ reply: "Still here." }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    await reply.stream.cancel();
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages.map(textOf)).toEqual(["Hi", "Still here."]);
  });

  it("keeps the reply's reasoning with the saved message", async () => {
    useModel(scriptedModel({ reasoning: "They said hi.", reply: "Hello!" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages[1].parts).toContainEqual(
      expect.objectContaining({ type: "reasoning", text: "They said hi." }),
    );
    expect(messages[1].parts).toContainEqual({
      type: "data-reasoning",
      data: {
        durationMs: expect.any(Number),
        finished: true,
      },
    });
  });

  it("rejects an output-limited reasoning-only reply and records safe diagnostics", async () => {
    const errors: unknown[] = [];
    useModel(
      titledModel("Should not be generated", {
        reasoning: "Still working through the problem",
        finishReason: "length",
      }),
      { onReplyError: (error) => errors.push(error) },
    );
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Build it" });
    const chunks = await drain(reply.stream);
    await reply.done;

    expect(chunks).toContainEqual({
      type: "error",
      errorText:
        "Claude reached its response limit while reasoning and didn't produce an answer. Retrying unchanged may fail again. Try a concise answer or split the request into a smaller first step.",
    });
    expect(
      (await service.open(alice, id))?.messages.map((message) => message.role),
    ).toEqual(["user"]);
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ReplyTerminalError);
    expect((errors[0] as ReplyTerminalError).details).toEqual({
      modelId: "claude",
      finishReason: "length",
      hasAnswer: false,
      recovery: "standard",
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        textTokens: 1,
        reasoningTokens: 0,
        totalTokens: 2,
      },
    });
  });

  it("rejects another natural finish when the model produces no answer", async () => {
    useModel(
      scriptedModel({
        reasoning: "I considered the request",
        finishReason: "stop",
      }),
    );
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Answer me" });
    const chunks = await drain(reply.stream);
    await reply.done;

    expect(chunks).toContainEqual({
      type: "error",
      errorText: "Claude didn't answer. Please try again.",
    });
    expect(
      (await service.open(alice, id))?.messages.map((message) => message.role),
    ).toEqual(["user"]);
  });

  it("saves and reopens an output-limited answer as incomplete", async () => {
    const errors: unknown[] = [];
    useModel(
      titledModel("Partial Work", {
        reasoning: "I planned the response",
        reply: "A useful partial answer",
        finishReason: "length",
      }),
      { onReplyError: (error) => errors.push(error) },
    );
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Do the work" });
    await drain(reply.stream);
    await reply.done;

    const reopened = await service.open(alice, id);
    expect(textOf(reopened!.messages[1])).toBe("A useful partial answer");
    expect(reopened!.messages[1].parts).toContainEqual({
      type: "data-completion",
      data: { incomplete: true, finishReason: "length" },
    });
    expect(reopened!.messages[1].parts).toContainEqual(
      expect.objectContaining({
        type: "reasoning",
        text: "I planned the response",
      }),
    );
    expect(reopened?.conversation).toMatchObject({
      title: "Partial Work",
      titleSource: "auto",
    });
    expect((errors[0] as ReplyTerminalError).details).toMatchObject({
      modelId: "claude",
      finishReason: "length",
      hasAnswer: true,
    });
  });

  it("saves a normal completed answer without an incomplete marker", async () => {
    useModel(
      scriptedModel({ reply: "A complete answer", finishReason: "stop" }),
    );
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Do the work" });
    await drain(reply.stream);
    await reply.done;

    const savedReply = (await service.open(alice, id))!.messages[1];
    expect(savedReply.parts).not.toContainEqual(
      expect.objectContaining({ type: "data-completion" }),
    );
  });

  it("keeps the user message but saves nothing when the reply fails before the first token", async () => {
    useModel(scriptedModel({ failBeforeFirstToken: true }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([["user", "Hi"]]);
  });

  it("keeps the user message but saves nothing when the reply fails after the first token", async () => {
    useModel(scriptedModel({ failAfter: "Half an ans" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([["user", "Hi"]]);
  });

  it("tells the browser the reply failed", async () => {
    useModel(scriptedModel({ failBeforeFirstToken: true }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    const chunks = await drain(reply.stream);

    expect(chunks).toContainEqual({
      type: "error",
      errorText: "Claude didn't answer. Please try again.",
    });
  });

  it("fails a reply that stalls before the first token instead of hanging", async () => {
    useModel(scriptedModel({ stallAfter: "" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    const chunks = await drain(reply.stream);
    await reply.done;

    expect(chunks).toContainEqual({
      type: "error",
      errorText: "Claude didn't answer. Please try again.",
    });
    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([["user", "Hi"]]);
  });

  it("fails a reply that stalls mid-stream and saves nothing", async () => {
    useModel(scriptedModel({ stallAfter: "Half an ans" }));
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Hi" });
    const chunks = await drain(reply.stream);
    await reply.done;

    expect(chunks).toContainEqual({
      type: "error",
      errorText: "Claude didn't answer. Please try again.",
    });
    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([["user", "Hi"]]);
  });

  it("sends earlier turns back as text only, without their reasoning", async () => {
    useModel(
      scriptedModel(
        { reasoning: "Secret thoughts", reply: "First answer" },
        { reply: "Second answer" },
      ),
    );
    const { id } = await service.start(alice, "claude");
    for (const text of ["First question", "Second question"]) {
      const reply = await service.send(alice, id, { text });
      await drain(reply.stream);
      await reply.done;
    }

    const prompt = model.doStreamCalls[1].prompt;
    expect(prompt).toEqual([
      { role: "user", content: [{ type: "text", text: "First question" }] },
      { role: "assistant", content: [{ type: "text", text: "First answer" }] },
      { role: "user", content: [{ type: "text", text: "Second question" }] },
    ]);
  });

  it("uses the user's current system prompt on the next turn", async () => {
    useModel(scriptedModel({ reply: "First answer" }, { reply: "Bonjour" }));
    const { id } = await service.start(alice, "claude");
    const first = await service.send(alice, id, { text: "First question" });
    await drain(first.stream);
    await first.done;

    db.update(users)
      .set({ systemPrompt: "Always answer in French" })
      .where(eq(users.id, alice.id))
      .run();
    const second = await service.send(alice, id, { text: "Second question" });
    await drain(second.stream);
    await second.done;

    expect(model.doStreamCalls[1].prompt[0]).toEqual({
      role: "system",
      content: "Always answer in French",
    });
  });

  it("bumps the conversation's updated_at for every saved message", async () => {
    useModel(scriptedModel({ reply: "Hello!" }, { failBeforeFirstToken: true }));
    const { id, updatedAt: created } = await service.start(alice, "claude");

    const first = await service.send(alice, id, { text: "Hi" });
    const afterUserMessage = (await service.open(alice, id))!.conversation
      .updatedAt;
    await drain(first.stream);
    await first.done;
    const afterReply = (await service.open(alice, id))!.conversation.updatedAt;

    expect(afterUserMessage.getTime()).toBeGreaterThan(created.getTime());
    expect(afterReply.getTime()).toBeGreaterThan(afterUserMessage.getTime());

    const failed = await service.send(alice, id, { text: "Again?" });
    const afterSecondMessage = (await service.open(alice, id))!.conversation
      .updatedAt;
    await drain(failed.stream);
    await failed.done;
    const afterFailure = (await service.open(alice, id))!.conversation
      .updatedAt;

    expect(afterSecondMessage.getTime()).toBeGreaterThan(afterReply.getTime());
    expect(afterFailure).toEqual(afterSecondMessage);
  });
});

describe("regenerate", () => {
  it("reopens a response-budget failure and retries it once with a concise policy", async () => {
    useModel(
      scriptedModel(
        { reasoning: "Still planning", finishReason: "length" },
        { reply: "A short direct answer." },
        { reply: "The next answer." },
      ),
    );
    const { id } = await service.start(alice, "claude");
    const failed = await service.send(alice, id, {
      text: "Build a very large prototype",
    });
    await drain(failed.stream);
    await failed.done;

    const reopened = await service.open(alice, id);
    expect(reopened!.messages).toHaveLength(1);
    expect(reopened!.messages[0].parts).toContainEqual({
      type: "data-replyFailure",
      data: { reason: "response-budget", recovery: "concise" },
    });

    const retry = await service.regenerate(alice, id, {
      recovery: "concise",
    });
    await drain(retry.stream);
    await retry.done;

    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[1].prompt).toEqual([
      {
        role: "system",
        content:
          "For this retry, answer the user's request directly and concisely. Avoid extended reasoning. If the request is too large, provide the smallest useful first step and state what remains.",
      },
      {
        role: "user",
        content: [{ type: "text", text: "Build a very large prototype" }],
      },
    ]);
    expect(model.doStreamCalls[1].providerOptions).toEqual({
      anthropic: { effort: "low" },
    });
    expect((await service.open(alice, id))?.messages.map(textOf)).toEqual([
      "Build a very large prototype",
      "A short direct answer.",
    ]);

    const next = await service.send(alice, id, { text: "What remains?" });
    await drain(next.stream);
    await next.done;

    expect(model.doStreamCalls).toHaveLength(3);
    expect(model.doStreamCalls[2].prompt).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "Build a very large prototype" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "A short direct answer." }],
      },
      {
        role: "user",
        content: [{ type: "text", text: "What remains?" }],
      },
    ]);
  });

  it("keeps a failed concise retry actionable without retrying automatically", async () => {
    const errors: ReplyTerminalError[] = [];
    useModel(
      scriptedModel(
        { reasoning: "First long attempt", finishReason: "length" },
        { reasoning: "Second long attempt", finishReason: "length" },
        { reply: "An automatic third call must not happen." },
      ),
      {
        onReplyError: (error) => {
          if (error instanceof ReplyTerminalError) errors.push(error);
        },
      },
    );
    const { id } = await service.start(alice, "claude");
    const first = await service.send(alice, id, { text: "Build everything" });
    await drain(first.stream);
    await first.done;

    const retry = await service.regenerate(alice, id, {
      recovery: "concise",
    });
    await drain(retry.stream);
    await retry.done;

    expect(model.doStreamCalls).toHaveLength(2);
    expect((await service.open(alice, id))!.messages[0].parts).toContainEqual({
      type: "data-replyFailure",
      data: { reason: "response-budget", recovery: "concise" },
    });
    expect(errors).toHaveLength(2);
    expect(errors[1].details).toMatchObject({
      modelId: "claude",
      finishReason: "length",
      hasAnswer: false,
      recovery: "concise",
    });
  });

  it("retries an answerless completion once without duplicating the user message", async () => {
    useModel(
      scriptedModel(
        { reasoning: "No answer yet", finishReason: "length" },
        { reply: "Finished on retry." },
      ),
    );
    const { id } = await service.start(alice, "claude");
    const failed = await service.send(alice, id, { text: "Please finish" });
    await drain(failed.stream);
    await failed.done;

    const retry = await service.regenerate(alice, id);
    await drain(retry.stream);
    await retry.done;

    expect(model.doStreamCalls).toHaveLength(2);
    expect(model.doStreamCalls[1].prompt).toEqual([
      { role: "user", content: [{ type: "text", text: "Please finish" }] },
    ]);
    expect((await service.open(alice, id))?.messages.map(textOf)).toEqual([
      "Please finish",
      "Finished on retry.",
    ]);
  });

  it("replays the saved, unanswered user message and saves the new reply", async () => {
    useModel(
      scriptedModel({ failBeforeFirstToken: true }, { reply: "Got it now." }),
    );
    const { id } = await service.start(alice, "claude");
    const failed = await service.send(alice, id, { text: "Hi" });
    await drain(failed.stream);
    await failed.done;

    const reply = await service.regenerate(alice, id);
    await drain(reply.stream);
    await reply.done;

    expect(model.doStreamCalls[1].prompt).toEqual([
      { role: "user", content: [{ type: "text", text: "Hi" }] },
    ]);
    const { messages } = (await service.open(alice, id))!;
    expect(messages.map((m) => [m.role, textOf(m)])).toEqual([
      ["user", "Hi"],
      ["assistant", "Got it now."],
    ]);
  });

  it("is rejected when the last message already has an answer", async () => {
    useModel(scriptedModel({ reply: "Hello!" }));
    const { id } = await service.start(alice, "claude");
    const reply = await service.send(alice, id, { text: "Hi" });
    await drain(reply.stream);
    await reply.done;

    await expect(service.regenerate(alice, id)).rejects.toMatchObject({
      reason: "rejected",
    });
    expect(model.doStreamCalls).toHaveLength(1);
  });
});

describe("stop", () => {
  it("preserves reasoning when the user explicitly stops before an answer", async () => {
    const errors: unknown[] = [];
    useModel(scriptedModel({ stallReasoningAfter: "Still reasoning" }), {
      onReplyError: (error) => errors.push(error),
    });
    const { id } = await service.start(alice, "claude");

    const reply = await service.send(alice, id, { text: "Think about this" });
    const browserDrain = drain(reply.stream);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.stop(alice, id);
    await browserDrain;
    await reply.done;

    const savedReply = (await service.open(alice, id))!.messages[1];
    expect(savedReply.role).toBe("assistant");
    expect(savedReply.parts).toContainEqual(
      expect.objectContaining({ type: "reasoning", text: "Still reasoning" }),
    );
    expect(errors).toEqual([]);
  });

  it("saves the partial answer and allows the next message", async () => {
    useModel(
      scriptedModel({ stallAfter: "Partial answer" }, { reply: "Next answer" }),
    );
    const { id } = await service.start(alice, "claude");

    const first = await service.send(alice, id, { text: "First question" });
    const browserDrain = drain(first.stream);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await service.stop(alice, id);
    await browserDrain;
    await first.done;

    const afterStop = await service.open(alice, id);
    expect(afterStop?.messages.map((message) => [message.role, textOf(message)])).toEqual([
      ["user", "First question"],
      ["assistant", "Partial answer"],
    ]);

    const second = await service.send(alice, id, { text: "Second question" });
    await drain(second.stream);
    await second.done;
    expect((await service.open(alice, id))?.messages.map(textOf)).toEqual([
      "First question",
      "Partial answer",
      "Second question",
      "Next answer",
    ]);
  });

  it("does not start a second reply after reopening mid-stream", async () => {
    useModel(scriptedModel({ stallAfter: "Still working" }, { reply: "Duplicate" }));
    const { id } = await service.start(alice, "claude");

    const first = await service.send(alice, id, { text: "Question" });
    const browserDrain = drain(first.stream);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect((await service.open(alice, id))?.replyInProgress).toBe(true);
    await expect(service.regenerate(alice, id)).rejects.toMatchObject({
      reason: "rejected",
      message: "A reply is already in progress for this conversation.",
    });
    expect(model.doStreamCalls).toHaveLength(1);

    await service.stop(alice, id);
    await browserDrain;
    await first.done;
    expect((await service.open(alice, id))?.replyInProgress).toBe(false);
  });
});

describe("retired models", () => {
  it("opens a retired-model conversation read-only", async () => {
    const conversation = await service.start(alice, "claude");
    db.update(conversations)
      .set({ modelId: "retired-model" })
      .where(eq(conversations.id, conversation.id))
      .run();

    expect((await service.open(alice, conversation.id))?.conversation.modelId).toBe(
      "retired-model",
    );
    await expect(
      service.send(alice, conversation.id, { text: "Can you still answer?" }),
    ).rejects.toMatchObject({ reason: "rejected" });
    expect(model.doStreamCalls).toHaveLength(0);
  });
});

describe("titles", () => {
  it("sets a fallback title from the first message immediately", async () => {
    useModel(scriptedModel({ failBeforeFirstToken: true }));
    const conversation = await service.start(alice, "claude");

    const reply = await service.send(alice, conversation.id, {
      text: "123456789012345678901234567890123456789012345",
    });

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "123456789012345678901234567890123456789…",
        titleSource: "fallback",
      },
    );
    await drain(reply.stream);
    await reply.done;
  });

  it("replaces the fallback with an AI title after the first reply", async () => {
    useModel(titledModel("How Plants Make Energy", { reply: "With sunlight." }));
    const conversation = await service.start(alice, "claude");

    const reply = await service.send(alice, conversation.id, {
      text: "How does photosynthesis work?",
    });
    await drain(reply.stream);
    await reply.done;

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "How Plants Make Energy",
        titleSource: "auto",
      },
    );
    expect(model.doGenerateCalls[0].maxOutputTokens).toBeGreaterThanOrEqual(800);
  });

  it("keeps the fallback when the title call fails", async () => {
    useModel(scriptedModel({ reply: "Answer one." }));
    const conversation = await service.start(alice, "claude");
    const reply = await service.send(alice, conversation.id, {
      text: "Keep this fallback",
    });
    await drain(reply.stream);
    await reply.done;

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "Keep this fallback",
        titleSource: "fallback",
      },
    );
  });

  it("keeps the fallback when the title call returns empty", async () => {
    useModel(titledModel("   ", { reply: "Answer two." }));
    const conversation = await service.start(alice, "claude");
    const reply = await service.send(alice, conversation.id, {
      text: "Keep this fallback",
    });
    await drain(reply.stream);
    await reply.done;

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "Keep this fallback",
        titleSource: "fallback",
      },
    );
  });

  it("never replaces a user rename, including while a title is in flight", async () => {
    let titleStarted!: () => void;
    let finishTitle!: (value: ReturnType<typeof generatedText>) => void;
    const started = new Promise<void>((resolve) => {
      titleStarted = resolve;
    });
    const titleResult = new Promise<ReturnType<typeof generatedText>>(
      (resolve) => {
        finishTitle = resolve;
      },
    );
    const streaming = scriptedModel({ reply: "A finished answer." });
    useModel(
      new MockLanguageModelV3({
        doStream: (options) => streaming.doStream(options),
        doGenerate: async () => {
          titleStarted();
          return titleResult;
        },
      }),
    );
    const conversation = await service.start(alice, "claude");
    const reply = await service.send(alice, conversation.id, {
      text: "A title-worthy question",
    });
    await drain(reply.stream);
    await started;

    await service.rename(alice, conversation.id, "My chosen title");
    finishTitle(generatedText("Late automatic title"));
    await reply.done;

    expect((await service.open(alice, conversation.id))?.conversation).toMatchObject(
      {
        title: "My chosen title",
        titleSource: "user",
      },
    );
  });
});

describe("ownership", () => {
  it("does not open another user's conversation", async () => {
    const { id } = await service.start(alice, "claude");

    expect(await service.open(bob, id)).toBeNull();
  });

  it("does not send to another user's conversation", async () => {
    useModel(scriptedModel({ reply: "Hello!" }));
    const { id } = await service.start(alice, "claude");

    const attempt = service.send(bob, id, { text: "Let me in" });

    await expect(attempt).rejects.toBeInstanceOf(ConversationError);
    await expect(attempt).rejects.toMatchObject({ reason: "not-found" });
    expect(model.doStreamCalls).toHaveLength(0);
    expect((await service.open(alice, id))!.messages).toEqual([]);
  });

  it("does not regenerate another user's conversation", async () => {
    useModel(scriptedModel({ failBeforeFirstToken: true }, { reply: "Hi" }));
    const { id } = await service.start(alice, "claude");
    const failed = await service.send(alice, id, { text: "Hi" });
    await drain(failed.stream);
    await failed.done;

    await expect(service.regenerate(bob, id)).rejects.toMatchObject({
      reason: "not-found",
    });
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("does not rename or delete another user's conversation", async () => {
    const conversation = await service.start(alice, "claude");

    await expect(
      service.rename(bob, conversation.id, "Taken over"),
    ).rejects.toMatchObject({ reason: "not-found" });
    await expect(service.delete(bob, conversation.id)).rejects.toMatchObject({
      reason: "not-found",
    });

    expect((await service.open(alice, conversation.id))?.conversation.title).toBe(
      "New conversation",
    );
  });

  it("treats an unknown id as not found", async () => {
    expect(await service.open(alice, "no-such-id")).toBeNull();
    await expect(
      service.send(alice, "no-such-id", { text: "Hi" }),
    ).rejects.toMatchObject({ reason: "not-found" });
  });
});
