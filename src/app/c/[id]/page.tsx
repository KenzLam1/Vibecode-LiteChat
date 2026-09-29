import { notFound } from "next/navigation";

import { findModel } from "@/lib/models";
import { conversationService } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

import { Chat } from "../../chat";
import { RetiredConversation } from "../../components/retired-conversation";

export default async function ConversationPage({
  params,
}: PageProps<"/c/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const opened = await conversationService().open(user, id);
  // Someone else's conversation is indistinguishable from a missing one.
  if (!opened) notFound();

  const model = findModel(opened.conversation.modelId);
  if (!model) {
    return (
      <RetiredConversation
        modelId={opened.conversation.modelId}
        messages={opened.messages}
      />
    );
  }

  return (
    <Chat
      key={id}
      conversationId={id}
      model={model}
      initialMessages={opened.messages}
      initialReplyInProgress={opened.replyInProgress}
    />
  );
}
