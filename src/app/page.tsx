import { redirect } from "next/navigation";

import { models } from "@/lib/models";
import { conversationService } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

// TODO(ticket 05): the Select a Model dialog picks the model; until then new
// conversations use the first catalog model.
async function startConversation() {
  "use server";
  const user = await requireUser();
  const conversation = await conversationService().start(user, models[0].id);
  redirect(`/c/${conversation.id}`);
}

export default async function Home() {
  await requireUser();
  return (
    <main className="m-auto flex flex-col items-center gap-6 p-4">
      <h1 className="font-display text-3xl font-semibold text-primary">
        LiteChat
      </h1>
      <form action={startConversation}>
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-3 font-medium text-white"
        >
          Start a new conversation
        </button>
      </form>
    </main>
  );
}
