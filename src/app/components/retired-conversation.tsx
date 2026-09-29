import type { ChatMessage } from "@/server/db/schema";

import { MessageBubble } from "./message-bubble";
import { NewConversationButton } from "./new-conversation";

export function RetiredConversation({
  modelId,
  messages,
}: {
  modelId: string;
  messages: ChatMessage[];
}) {
  return (
    <div className="flex h-dvh w-full flex-col">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
          <p className="text-sm">
            This conversation uses a retired model and can&apos;t be continued.
          </p>
          <NewConversationButton
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Start a new conversation
          </NewConversationButton>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">Model</span>
          <span className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
            {modelId} (retired)
          </span>
        </div>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-100 p-3 text-center text-sm text-gray-500">
          This conversation is read-only.
        </div>
      </footer>
    </div>
  );
}
