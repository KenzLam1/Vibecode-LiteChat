"use client";

import { type ReactNode, useState, useTransition } from "react";

import { models } from "@/lib/models";

import { startConversation } from "../conversation-actions";

export function NewConversationButton({
  children,
  className,
  ariaLabel = "Start a new conversation",
}: {
  children: ReactNode;
  className: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>

      {open && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-picker-title"
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="model-picker-title"
                  className="font-display text-2xl font-semibold text-gray-900"
                >
                  Select a Model
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Your choice stays fixed for this conversation.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close model picker"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-2xl leading-none text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(() => startConversation(model.id))
                  }
                  className="rounded-2xl border border-gray-200 p-4 text-left transition hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                >
                  <span className="font-display text-lg font-semibold text-gray-900">
                    {model.displayName}
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-gray-600">
                    {model.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
