import { notFound } from "next/navigation";

import { findModel } from "@/lib/models";
import { conversationService } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

import { Chat } from "../../chat";

export default async function ConversationPage({
  params,
}: PageProps<"/c/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const opened = await conversationService().open(user, id);
  // Someone else's conversation is indistinguishable from a missing one.
  if (!opened) notFound();

  // TODO(ticket 05): a retired model's conversation opens read-only with a
  // banner. Until then it isn't shown.
  const model = findModel(opened.conversation.modelId);
  if (!model) notFound();

  return (
    <Chat
      key={id}
      conversationId={id}
      model={model}
      initialMessages={opened.messages}
    />
  );
}
