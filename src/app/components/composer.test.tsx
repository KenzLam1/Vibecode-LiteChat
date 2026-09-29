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

    expect(onSend).toHaveBeenCalledWith("hello", []);
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

  it("stages and removes a document chosen with the attachment button", () => {
    renderComposer();
    const document = new File(["hello"], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.change(screen.getByLabelText("Choose documents"), {
      target: { files: [document] },
    });

    expect(screen.getByText("notes.txt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove notes.txt" }));
    expect(screen.queryByText("notes.txt")).toBeNull();
  });

  it("stages documents dropped onto or pasted into the composer", () => {
    renderComposer();
    const box = screen.getByRole("textbox");
    const form = box.closest("form")!;

    fireEvent.drop(form, {
      dataTransfer: {
        files: [new File(["one"], "dropped.md", { type: "text/markdown" })],
      },
    });
    fireEvent.paste(box, {
      clipboardData: {
        files: [new File(["two"], "pasted.csv", { type: "text/csv" })],
      },
    });

    expect(screen.getByText("dropped.md")).toBeTruthy();
    expect(screen.getByText("pasted.csv")).toBeTruthy();
  });

  it("shows an inline error for an unsupported document", () => {
    renderComposer();

    fireEvent.change(screen.getByLabelText("Choose documents"), {
      target: {
        files: [new File(["image"], "photo.png", { type: "image/png" })],
      },
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "photo.png isn't a supported document type.",
    );
  });
});
