// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
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
