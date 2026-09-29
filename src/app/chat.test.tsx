// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage } from "@/server/db/schema";

const mocks = vi.hoisted(() => ({
  regenerate: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: ({ messages }: { messages: ChatMessage[] }) => ({
    messages,
    sendMessage: vi.fn(),
    regenerate: mocks.regenerate,
    status: "ready",
    error: undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("./components/toast", () => ({
  useToast: () => vi.fn(),
}));

import { models } from "@/lib/models";

import { Chat } from "./chat";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Chat response-budget recovery", () => {
  it("offers the persisted concise recovery after reopening", () => {
    const messages: ChatMessage[] = [
      {
        id: "message-1",
        role: "user",
        parts: [
          { type: "text", text: "Build a large prototype" },
          {
            type: "data-replyFailure",
            data: { reason: "response-budget", recovery: "concise" },
          },
        ],
      },
    ];

    render(
      <Chat
        conversationId="conversation-1"
        model={models[1]}
        initialMessages={messages}
        initialReplyInProgress={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Try a concise answer" }),
    );

    expect(mocks.regenerate).toHaveBeenCalledOnce();
    expect(mocks.regenerate).toHaveBeenCalledWith({
      body: { recovery: "concise" },
    });
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
