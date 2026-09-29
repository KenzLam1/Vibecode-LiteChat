"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import type { CatalogModel } from "@/lib/models";

export function Chat({ model }: { model: CatalogModel }) {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-display text-2xl font-semibold text-primary">
          LiteChat
        </h1>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          {model.displayName}
        </span>
      </header>

      <main className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
        {messages.length === 0 && (
          <p className="m-auto text-center text-gray-500">
            Send a message to start chatting with {model.displayName}.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "max-w-[80%] self-end whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-white"
                : "whitespace-pre-wrap text-gray-900"
            }
          >
            {message.parts.map((part, index) =>
              part.type === "text" ? <span key={index}>{part.text}</span> : null,
            )}
          </div>
        ))}
        {status === "submitted" && (
          <p className="text-sm text-gray-500">Thinking…</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error.message}
          </p>
        )}
      </main>

      <form
        className="mb-4 flex items-end gap-2 rounded-2xl border border-gray-300 p-2 focus-within:border-primary"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          className="max-h-48 flex-1 resize-none bg-transparent px-2 py-1 outline-none"
          rows={1}
          placeholder={`Message ${model.displayName}`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-primary px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
