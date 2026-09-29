// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "@/server/db/schema";

import { MessageBubble } from "./message-bubble";

afterEach(cleanup);

describe("MessageBubble attachments", () => {
  it("shows a persisted attachment name and truncation note", () => {
    const message: ChatMessage = {
      id: "message-1",
      role: "user",
      parts: [
        { type: "text", text: "Summarise this" },
        {
          type: "data-attachment",
          data: {
            filename: "long-report.txt",
            size: 50_001,
            text: "a".repeat(50_000),
            truncated: true,
          },
        },
      ],
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText("long-report.txt")).toBeTruthy();
    expect(
      screen.getByText(
        "long-report.txt was truncated to its first 50,000 characters.",
      ),
    ).toBeTruthy();
  });
});

describe("MessageBubble context note", () => {
  it("shows when older messages were dropped from the model context", () => {
    const message: ChatMessage = {
      id: "message-2",
      role: "assistant",
      parts: [
        { type: "data-context", data: { dropped: true } },
        { type: "text", text: "Here is the answer." },
      ],
    };

    render(<MessageBubble message={message} />);

    expect(
      screen.getByText(
        "Older messages are no longer included in the model's context.",
      ),
    ).toBeTruthy();
  });
});

describe("MessageBubble reasoning", () => {
  it("shows live reasoning in an open block", () => {
    const message: ChatMessage = {
      id: "message-3",
      role: "assistant",
      parts: [{ type: "reasoning", text: "Working through it", state: "streaming" }],
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText("Working through it")).toBeTruthy();
    const summary = screen.getByText(/Thinking…/);
    expect((summary.closest("details") as HTMLDetailsElement).open).toBe(true);
  });

  it("collapses completed reasoning and keeps it expandable", () => {
    const message: ChatMessage = {
      id: "message-4",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "Worked through it", state: "done" },
        {
          type: "data-reasoning",
          data: { durationMs: 1_240, finished: true },
        },
        { type: "text", text: "The answer." },
      ],
    };

    render(<MessageBubble message={message} />);

    const summary = screen.getByText("Thought for 1.2s");
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
  });
});

describe("MessageBubble completion state", () => {
  it("warns when a persisted answer reached the output limit", () => {
    const message: ChatMessage = {
      id: "message-5",
      role: "assistant",
      parts: [
        {
          type: "data-completion",
          data: { incomplete: true, finishReason: "length" },
        },
        { type: "text", text: "A useful partial answer." },
      ],
    };

    render(<MessageBubble message={message} />);

    expect(screen.getByText("A useful partial answer.")).toBeTruthy();
    expect(
      screen.getByText(
        "This response may be incomplete because the model reached its output limit.",
      ),
    ).toBeTruthy();
  });

  it("does not warn for a normal completed answer", () => {
    const message: ChatMessage = {
      id: "message-6",
      role: "assistant",
      parts: [{ type: "text", text: "A complete answer." }],
    };

    render(<MessageBubble message={message} />);

    expect(screen.queryByText(/may be incomplete/i)).toBeNull();
  });
});
