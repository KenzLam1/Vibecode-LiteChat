"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { conversationService, ConversationError } from "@/server/conversations";
import { requireUser } from "@/server/current-user";

export type ConversationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function startConversation(modelId: string): Promise<never> {
  const user = await requireUser();
  const conversation = await conversationService().start(user, modelId);
  revalidatePath("/", "layout");
  redirect(`/c/${conversation.id}`);
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationActionResult> {
  const user = await requireUser();
  try {
    await conversationService().rename(user, id, title);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof ConversationError) {
      return { ok: false, error: error.message };
    }
    console.error("[conversations] rename failed:", error);
    return { ok: false, error: "Couldn't rename the conversation." };
  }
}

export async function deleteConversation(
  id: string,
): Promise<ConversationActionResult> {
  const user = await requireUser();
  try {
    await conversationService().delete(user, id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof ConversationError) {
      return { ok: false, error: error.message };
    }
    console.error("[conversations] delete failed:", error);
    return { ok: false, error: "Couldn't delete the conversation." };
  }
}
