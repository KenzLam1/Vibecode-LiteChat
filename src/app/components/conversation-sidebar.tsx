"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";

import type { Conversation } from "@/server/conversations";

import {
  deleteConversation,
  renameConversation,
} from "../conversation-actions";
import { NewConversationButton } from "./new-conversation";
import { useToast } from "./toast";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function ConversationSidebar({
  initialConversations,
  accountControl,
}: {
  initialConversations: Conversation[];
  accountControl?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [renamingId, setRenamingId] = useState<string>();
  const [renameTitle, setRenameTitle] = useState("");
  const [deleting, setDeleting] = useState<Conversation>();
  const [pending, startTransition] = useTransition();

  function beginRename(conversation: Conversation) {
    setRenamingId(conversation.id);
    setRenameTitle(conversation.title);
  }

  function saveRename(event: FormEvent) {
    event.preventDefault();
    if (!renamingId || !renameTitle.trim()) return;
    const id = renamingId;
    const title = renameTitle.trim();
    startTransition(async () => {
      const result = await renameConversation(id, title);
      if (!result.ok) {
        toast(result.error);
        return;
      }
      setRenamingId(undefined);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const conversation = deleting;
    startTransition(async () => {
      const result = await deleteConversation(conversation.id);
      if (!result.ok) {
        toast(result.error);
        setDeleting(undefined);
        return;
      }
      setDeleting(undefined);
      if (pathname === `/c/${conversation.id}`) router.push("/");
      else router.refresh();
    });
  }

  return (
    <>
      <aside className="flex h-dvh w-72 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <Link
            href="/"
            className="font-display text-2xl font-semibold text-primary"
          >
            LiteChat
          </Link>
          <NewConversationButton
            ariaLabel="Start a new conversation"
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-2xl leading-none text-white hover:bg-primary/90 disabled:opacity-50"
          >
            +
          </NewConversationButton>
        </div>

        <nav aria-label="Conversations" className="flex-1 overflow-y-auto p-2">
          {initialConversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">
              No conversations yet
            </p>
          ) : (
            <ul className="space-y-1">
              {initialConversations.map((conversation) => {
                const active = pathname === `/c/${conversation.id}`;
                return (
                  <li
                    key={conversation.id}
                    className={`group rounded-lg ${
                      active ? "bg-primary/10" : "hover:bg-gray-100"
                    }`}
                  >
                    {renamingId === conversation.id ? (
                      <form onSubmit={saveRename} className="p-2">
                        <input
                          aria-label={`Rename ${conversation.title}`}
                          autoFocus
                          disabled={pending}
                          value={renameTitle}
                          onChange={(event) => setRenameTitle(event.target.value)}
                          onBlur={() => {
                            if (!pending) setRenamingId(undefined);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") setRenamingId(undefined);
                          }}
                          className="w-full rounded-md border border-primary bg-white px-2 py-1 text-sm outline-none"
                        />
                      </form>
                    ) : (
                      <div className="flex items-center gap-1 p-1.5">
                        <Link
                          href={`/c/${conversation.id}`}
                          className="min-w-0 flex-1 rounded-md px-2 py-1"
                        >
                          <span className="block truncate text-sm font-medium text-gray-800">
                            {conversation.title}
                          </span>
                          <time
                            className="block text-xs text-gray-500"
                            dateTime={conversation.updatedAt.toISOString()}
                          >
                            {dateFormatter.format(conversation.updatedAt)}
                          </time>
                        </Link>
                        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            aria-label={`Rename ${conversation.title}`}
                            onClick={() => beginRename(conversation)}
                            className="rounded p-1.5 text-gray-500 hover:bg-white hover:text-primary"
                          >
                            <span aria-hidden>✎</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${conversation.title}`}
                            onClick={() => setDeleting(conversation)}
                            className="rounded p-1.5 text-gray-500 hover:bg-white hover:text-red-600"
                          >
                            <span aria-hidden>×</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {accountControl && (
          <div className="border-t border-gray-100 p-3">{accountControl}</div>
        )}

      </aside>

      {deleting && (
        <div
          role="presentation"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setDeleting(undefined);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 id="delete-title" className="font-display text-xl font-semibold">
              Delete {deleting.title}?
            </h2>
            <p id="delete-description" className="mt-2 text-sm text-gray-600">
              This can&apos;t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDeleting(undefined)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
