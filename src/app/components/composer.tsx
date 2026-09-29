"use client";

import { useState } from "react";

import type { CatalogModel } from "@/lib/models";

// The pill row and message box. Enter sends, Shift+Enter adds a new line, and
// nothing can be sent while a reply is in flight.
export function Composer({
  model,
  busy,
  onSend,
}: {
  model: CatalogModel;
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const canSend = !busy && input.trim().length > 0;

  function send() {
    if (!canSend) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Model</span>
        <span className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {model.displayName}
        </span>
      </div>

      <form
        className="flex items-end gap-2 rounded-xl border border-gray-300 bg-white p-2 shadow-sm focus-within:border-primary"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          aria-label="Message"
          className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 outline-none [field-sizing:content] placeholder:text-gray-400"
          rows={1}
          placeholder={`Message ${model.displayName}…`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
          >
            <path d="M2.6 2.2a.75.75 0 0 1 .82-.1l14 7.25a.75.75 0 0 1 0 1.33l-14 7.25a.75.75 0 0 1-1.05-.9L4.6 10 2.37 3.07a.75.75 0 0 1 .23-.86ZM6 10.75l-1.6 4.9L14.9 10 4.4 4.35 6 9.25h4.25a.75.75 0 0 1 0 1.5H6Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
