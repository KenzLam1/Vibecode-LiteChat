import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, streamText } from "ai";

import type { CatalogModel, ProviderRoute } from "@/lib/models";

// The only module that knows about the three BUILD LLM Proxy routes. Each
// route copies one provider's API, so each gets that provider's AI SDK client
// with the proxy base URL and key passed explicitly (never read implicitly).

// Every reply reasons before answering, and small budgets come back empty.
// This applies to every model call, including title calls.
export const MIN_OUTPUT_TOKENS = 800;
export const REPLY_MAX_OUTPUT_TOKENS = 8192;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

type ProviderOptions = Parameters<typeof streamText>[0]["providerOptions"];

type Route = {
  client: (upstreamModelId: string) => LanguageModel;
  // Anthropic and Google get options that switch reasoning on; none of them
  // sets a thinking effort. The OpenAI route streams reasoning as
  // `reasoning_text` events that @ai-sdk/openai does not surface.
  providerOptions?: ProviderOptions;
};

const routes: Record<ProviderRoute, Route> = {
  // Responses API, because the proxy rejects Chat Completions'
  // `max_completion_tokens`. The proxy keeps no state: earlier turns must be
  // sent without their provider metadata, or the SDK sends them as item
  // references ("unsupported message role"). `store: false` is no way out,
  // as it adds an `include` field the proxy also rejects.
  openai: {
    client: (upstreamModelId) =>
      createOpenAI({
        baseURL: env("OPENAI_BASE_URL"),
        apiKey: env("OPENAI_API_KEY"),
      }).responses(upstreamModelId),
  },
  anthropic: {
    client: (upstreamModelId) =>
      createAnthropic({
        baseURL: env("ANTHROPIC_BASE_URL"),
        apiKey: env("ANTHROPIC_API_KEY"),
      })(upstreamModelId),
    // The proxy rejects `budget_tokens`, so thinking must be adaptive.
    providerOptions: { anthropic: { thinking: { type: "adaptive" } } },
  },
  google: {
    client: (upstreamModelId) =>
      createGoogleGenerativeAI({
        baseURL: env("GOOGLE_GENERATIVE_AI_BASE_URL"),
        apiKey: env("GOOGLE_GENERATIVE_AI_API_KEY"),
      })(upstreamModelId),
    providerOptions: { google: { thinkingConfig: { includeThoughts: true } } },
  },
};

// Resolves a catalog model to the settings every call to it needs. Spread
// the result into `streamText` / `generateText`.
export function modelCall(model: CatalogModel): {
  model: LanguageModel;
  providerOptions?: ProviderOptions;
} {
  const route = routes[model.route];
  return {
    model: route.client(model.upstreamModelId),
    providerOptions: route.providerOptions,
  };
}

// The proxy answers bad requests with "upstream request failed" and an
// x-request-id header; that id is what to report when a route misbehaves.
export function proxyRequestId(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const headers = (error as { responseHeaders?: Record<string, string> })
    .responseHeaders;
  if (headers?.["x-request-id"]) return headers["x-request-id"];
  const cause = (error as { lastError?: unknown }).lastError;
  return cause ? proxyRequestId(cause) : undefined;
}
