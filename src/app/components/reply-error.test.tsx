// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReplyError, ResponseBudgetRecovery } from "./reply-error";

afterEach(cleanup);

describe("response-budget recovery", () => {
  it("explains the failure and offers a concise retry", () => {
    const onConciseRetry = vi.fn();

    render(
      <ResponseBudgetRecovery
        modelName="Claude"
        onConciseRetry={onConciseRetry}
      />,
    );

    expect(
      screen.getByText(
        "Claude reached its response limit while reasoning and didn't produce an answer.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Retrying the same request may fail again/i),
    ).toBeTruthy();
    expect(screen.getByText(/smaller first step/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Try a concise answer" }),
    );
    expect(onConciseRetry).toHaveBeenCalledOnce();
  });

  it("keeps the generic retry for other failures", () => {
    const onRetry = vi.fn();

    render(
      <ReplyError
        error={new Error("Claude didn't answer. Please try again.")}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Try a concise answer" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
