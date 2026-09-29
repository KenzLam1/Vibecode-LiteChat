// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_PROMPT_MAX_CHARS } from "@/lib/limits";

import { SystemPromptForm } from "./system-prompt-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SystemPromptForm", () => {
  it("shows the current count and caps the field at 4,000 characters", () => {
    render(<SystemPromptForm initialValue="Be concise" />);

    const field = screen.getByRole("textbox", { name: "System prompt" });
    expect(field.getAttribute("maxlength")).toBe(String(SYSTEM_PROMPT_MAX_CHARS));
    expect(screen.getByText("10 / 4,000")).toBeTruthy();
  });

  it("saves the edited system prompt", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    render(<SystemPromptForm initialValue="" />);

    fireEvent.change(screen.getByRole("textbox", { name: "System prompt" }), {
      target: { value: "Always answer in French" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith("/api/profile/system-prompt", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemPrompt: "Always answer in French" }),
    });
    expect(await screen.findByText("System prompt saved.")).toBeTruthy();
  });
});
