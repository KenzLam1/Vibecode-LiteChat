// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { models } from "@/lib/models";

import { Composer } from "./composer";

afterEach(cleanup);

function renderComposer(busy = false) {
  const onSend = vi.fn();
  render(<Composer model={models[0]} busy={busy} onSend={onSend} />);
  const box = screen.getByRole("textbox", { name: "Message" });
  fireEvent.change(box, { target: { value: "hello" } });
  return { onSend, box };
}

describe("Composer", () => {
  it("sends on Enter and clears the box", () => {
    const { onSend, box } = renderComposer();

    fireEvent.keyDown(box, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("hello");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("does not send on Shift+Enter", () => {
    const { onSend } = renderComposer();

    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("can't send while a reply is in flight", () => {
    const { onSend, box } = renderComposer(true);

    fireEvent.keyDown(box, { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    // What was typed is kept for when the reply finishes.
    expect((box as HTMLTextAreaElement).value).toBe("hello");
  });
});
