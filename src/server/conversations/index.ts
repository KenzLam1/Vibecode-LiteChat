import "server-only";

import { getDb } from "@/server/db";
import {
  REPLY_MAX_OUTPUT_TOKENS,
  modelCall,
  proxyRequestId,
} from "@/server/providers";

import {
  createConversationService,
  ReplyTerminalError,
  type ConversationService,
} from "./service";
import { activeReplyRegistry } from "./active-replies";

export {
  ConversationError,
  type Conversation,
  type ConversationService,
  type OpenConversation,
  type Reply,
} from "./service";

// The app's Conversation service: the real database and the proxy models.
let service: ConversationService | undefined;

export function conversationService(): ConversationService {
  service ??= createConversationService({
    db: getDb(),
    activeReplies: activeReplyRegistry,
    modelFor: (model) => ({
      ...modelCall(model),
      maxOutputTokens: REPLY_MAX_OUTPUT_TOKENS,
    }),
    onReplyError: (error, model) => {
      if (error instanceof ReplyTerminalError) {
        console.error("[chat] abnormal reply terminal:", error.details);
        return;
      }
      const requestId = proxyRequestId(error);
      console.error(
        `[chat] ${model.id} reply failed${requestId ? ` (x-request-id ${requestId})` : ""}:`,
        error,
      );
    },
  });
  return service;
}
