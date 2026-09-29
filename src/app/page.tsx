import { NewConversationButton } from "./components/new-conversation";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <NewConversationButton className="flex min-h-52 w-full max-w-lg flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/40 bg-white px-12 py-10 text-primary shadow-sm transition hover:border-primary hover:bg-primary/5">
        <span aria-hidden className="text-5xl leading-none">+</span>
        <span className="font-display text-2xl font-semibold">
          Start a new conversation
        </span>
      </NewConversationButton>
    </main>
  );
}
