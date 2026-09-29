import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/server/current-user";
import { createDb, type Db } from "@/server/db";
import { users } from "@/server/db/schema";

import {
  ConversationError,
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

type Script =
  | { reply: string; reasoning?: string }
  | { failBeforeFirstToken: true }
  | { failAfter: string }
  | { stallAfter: string };

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

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
  if (!("reply" in script)) return [];
  const reasoning: LanguageModelV3StreamPart[] = script.reasoning
    ? [
        { type: "reasoning-start", id: "r" },
        { type: "reasoning-delta", id: "r", delta: script.reasoning },
        { type: "reasoning-end", id: "r" },
      ]
    : [];
  return [
    ...reasoning,
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: script.reply },
    { type: "text-end", id: "t" },
    { type: "finish", usage, finishReason: { unified: "stop", raw: "stop" } },
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
      if ("stallAfter" in script) {
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
function useModel(next: MockLanguageModelV3) {
  model = next;
  service = createConversationService({
    db,
    modelFor: () => ({ model }),
    now: () => new Date((clock += 1000)),
    replyIdleTimeoutMs: 50,
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

  it("treats an unknown id as not found", async () => {
    expect(await service.open(alice, "no-such-id")).toBeNull();
    await expect(
      service.send(alice, "no-such-id", { text: "Hi" }),
    ).rejects.toMatchObject({ reason: "not-found" });
  });
});
