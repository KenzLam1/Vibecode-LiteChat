import "server-only";

import type { ActiveReplyRegistry } from "./service";

const key = Symbol.for("litechat.active-replies");
const globals = globalThis as typeof globalThis & {
  [key]?: ActiveReplyRegistry;
};

export const activeReplyRegistry = (globals[key] ??= new Map());
