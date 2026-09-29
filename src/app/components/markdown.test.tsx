// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Markdown } from "./markdown";

afterEach(cleanup);

describe("Markdown", () => {
  it("shows raw HTML in model output as text instead of rendering it", () => {
    const reply = [
      "<script>window.pwned = true</script>",
      "",
      'Look: <img src="x" onerror="window.pwned = true"> and <b>bold</b>',
    ].join("\n");

    const { container } = render(<Markdown>{reply}</Markdown>);

    expect(container.querySelector("script, img, b")).toBeNull();
    expect(container.textContent).toContain(
      "<script>window.pwned = true</script>",
    );
    expect(container.textContent).toContain(
      '<img src="x" onerror="window.pwned = true">',
    );
  });

  it("drops javascript: link targets", () => {
    const { container } = render(
      <Markdown>{"[click me](javascript:alert(1))"}</Markdown>,
    );

    const link = container.querySelector("a");
    expect(link?.getAttribute("href") ?? "").not.toContain("javascript");
  });

  it("renders headings, lists, links and tables", () => {
    const reply = [
      "# Title",
      "",
      "- one",
      "- two",
      "",
      "[LiteChat](https://example.com)",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n");

    const { container } = render(<Markdown>{reply}</Markdown>);

    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    const link = screen.getByRole("link", { name: "LiteChat" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    // Tables sit in a wrapper that scrolls sideways inside the bubble.
    expect(container.querySelector(".markdown-table > table")).not.toBeNull();
  });

  it("highlights code and copies exactly the code", async () => {
    const code = [
      'const html = "<a href=\\"x\\">&amp;</a>";',
      "",
      "  if (a < b && b > c) {",
      "\treturn `${html}`;",
      "  }",
    ].join("\n");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { container } = render(
      <Markdown>{"Here:\n\n```ts\n" + code + "\n```\n"}</Markdown>,
    );

    expect(container.querySelector(".hljs-keyword")).not.toBeNull();
    expect(screen.getByText("ts")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(code);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy(),
    );
  });
});
