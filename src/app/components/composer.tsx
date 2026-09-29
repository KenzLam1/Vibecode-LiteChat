"use client";

import { useRef, useState, type ClipboardEvent, type DragEvent } from "react";

import type { CatalogModel } from "@/lib/models";

// The pill row and message box. Enter sends, Shift+Enter adds a new line, and
// nothing can be sent while a reply is in flight.
export function Composer({
  model,
  busy,
  error,
  onSend,
  onStop,
}: {
  model: CatalogModel;
  busy: boolean;
  error?: string;
  onSend: (text: string, attachments: File[]) => void | Promise<void>;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const canSend =
    !busy && (input.trim().length > 0 || attachments.length > 0);

  function stage(files: File[]) {
    if (files.length === 0) return;
    const allowed = [".pdf", ".txt", ".md", ".csv", ".json"];
    const unsupported = files.find(
      (file) =>
        !allowed.some((extension) => file.name.toLowerCase().endsWith(extension)),
    );
    if (unsupported) {
      setAttachmentError(
        `${unsupported.name} isn't a supported document type.`,
      );
      return;
    }
    if (attachments.length + files.length > 5) {
      setAttachmentError("You can attach up to 5 documents per message.");
      return;
    }
    setAttachmentError(undefined);
    setAttachments((current) => [...current, ...files]);
  }

  function send() {
    if (!canSend) return;
    void onSend(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    setAttachmentError(undefined);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Model</span>
        <span className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {model.displayName}
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Attached documents">
          {attachments.map((file, index) => (
            <span
              key={`${file.name}-${file.size}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-white px-2.5 py-1 text-sm text-gray-700"
            >
              {file.name}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="ml-1 text-gray-400 hover:text-gray-700"
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((_, attachmentIndex) => attachmentIndex !== index),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {(attachmentError || error) && (
        <p className="text-sm text-red-700" role="alert">
          {attachmentError ?? error}
        </p>
      )}

      <form
        className="flex items-end gap-2 rounded-xl border border-gray-300 bg-white p-2 shadow-sm focus-within:border-primary"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event: DragEvent<HTMLFormElement>) => {
          event.preventDefault();
          if (!busy) stage(Array.from(event.dataTransfer.files));
        }}
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
          onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length > 0 && !busy) {
              event.preventDefault();
              stage(files);
            }
          }}
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
        {model.capabilities.documents && (
          <>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              aria-label="Choose documents"
              accept=".pdf,.txt,.md,.csv,.json"
              multiple
              disabled={busy}
              onChange={(event) => stage(Array.from(event.target.files ?? []))}
            />
            <button
              type="button"
              aria-label="Attach documents"
              disabled={busy}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              onClick={() => fileInput.current?.click()}
            >
              📎
            </button>
          </>
        )}
        <button
          type={busy ? "button" : "submit"}
          aria-label={busy ? "Stop" : "Send"}
          disabled={!busy && !canSend}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
          onClick={busy ? onStop : undefined}
        >
          {busy ? (
            <span aria-hidden className="size-3 rounded-sm bg-current" />
          ) : (
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
            >
              <path d="M2.6 2.2a.75.75 0 0 1 .82-.1l14 7.25a.75.75 0 0 1 0 1.33l-14 7.25a.75.75 0 0 1-1.05-.9L4.6 10 2.37 3.07a.75.75 0 0 1 .23-.86ZM6 10.75l-1.6 4.9L14.9 10 4.4 4.35 6 9.25h4.25a.75.75 0 0 1 0 1.5H6Z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
