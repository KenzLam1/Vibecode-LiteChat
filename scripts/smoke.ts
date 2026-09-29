// Proxy health check. Run before a demo with `npm run smoke`.
//
// 1. Streams "hi" from every catalog model and reports whether the route
//    surfaces reasoning parts.
// 2. Probes the largest prompt the proxy accepts, doubling the prompt size
//    until a request fails or PROBE_MAX_TOKENS (default 256k) is reached,
//    then bisecting between the largest accepted and smallest rejected size.
//    PROBE_MODEL picks the catalog model to probe (default: the first).

import { generateText, streamText } from "ai";

import { models } from "@/lib/models";
import {
  MIN_OUTPUT_TOKENS,
  modelCall,
  proxyRequestId,
} from "@/server/providers";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to whatever is already in the environment.
}

const TIMEOUT_MS = 180_000;
// Matches the context builder's estimate: tokens ≈ characters ÷ 4.
const CHARS_PER_TOKEN = 4;

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const requestId = proxyRequestId(error);
  return requestId ? `${message} (x-request-id ${requestId})` : message;
}

function seconds(start: number): string {
  return `${((performance.now() - start) / 1000).toFixed(1)}s`;
}

async function streamHi() {
  console.log('Streaming "hi" from each route\n');
  let failures = 0;

  for (const model of models) {
    const start = performance.now();
    let text = "";
    let reasoning = "";
    let streamError: unknown;

    try {
      const result = streamText({
        ...modelCall(model),
        prompt: "hi",
        maxOutputTokens: MIN_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        onError: ({ error }) => {
          streamError = error;
        },
      });
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") text += part.text;
        if (part.type === "reasoning-delta") reasoning += part.text;
      }
    } catch (error) {
      streamError = error;
    }

    const label = `${model.displayName} (${model.route})`.padEnd(22);
    if (streamError || !text.trim()) {
      failures++;
      const why = streamError ? describe(streamError) : "empty answer";
      console.log(`  ✗ ${label} ${seconds(start)}  ${why}`);
      continue;
    }
    const reasoningNote = reasoning
      ? `reasoning: yes (${reasoning.length} chars)`
      : "reasoning: NO";
    const preview = text.trim().replace(/\s+/g, " ").slice(0, 60);
    console.log(`  ✓ ${label} ${seconds(start)}  ${reasoningNote}  "${preview}"`);
  }

  return failures;
}

async function probeContext() {
  const maxTokens = Number(process.env.PROBE_MAX_TOKENS ?? 256_000);
  const model =
    models.find((entry) => entry.id === process.env.PROBE_MODEL) ?? models[0];
  console.log(
    `\nProbing prompt size on ${model.displayName} (up to ~${maxTokens.toLocaleString()} tokens)\n`,
  );

  const filler = "The quick brown fox jumps over the lazy dog. ";
  let largestAccepted: { estimated: number; reported?: number } | undefined;
  let smallestRejected: number | undefined;

  async function accepts(tokens: number): Promise<boolean> {
    const chars = tokens * CHARS_PER_TOKEN;
    const prompt =
      filler.repeat(Math.ceil(chars / filler.length)).slice(0, chars) +
      "\n\nIgnore the text above. Reply with the single word OK.";
    const size = `~${tokens.toLocaleString()} tokens (${Math.round(chars / 1024)} KiB)`;
    const start = performance.now();
    try {
      const result = await generateText({
        ...modelCall(model),
        prompt,
        maxOutputTokens: MIN_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const reported = result.usage.inputTokens;
      if (!largestAccepted || tokens > largestAccepted.estimated) {
        largestAccepted = { estimated: tokens, reported };
      }
      console.log(
        `  ✓ ${size}  ${seconds(start)}  provider counted ${reported?.toLocaleString() ?? "?"} input tokens`,
      );
      return true;
    } catch (error) {
      smallestRejected = Math.min(smallestRejected ?? Infinity, tokens);
      console.log(`  ✗ ${size}  ${seconds(start)}  ${describe(error)}`);
      return false;
    }
  }

  // Double until a size is rejected, then bisect to within 4k tokens.
  let tokens = 8_000;
  while (tokens <= maxTokens && (await accepts(tokens))) tokens *= 2;
  while (
    largestAccepted &&
    smallestRejected &&
    smallestRejected - largestAccepted.estimated > 4_000
  ) {
    const middle = (largestAccepted.estimated + smallestRejected) / 2;
    await accepts(Math.round(middle / 1_000) * 1_000);
  }

  if (!largestAccepted) {
    console.log("\n  Largest prompt accepted: none");
    return 1;
  }
  const reported = largestAccepted.reported
    ? ` (${largestAccepted.reported.toLocaleString()} counted by the provider)`
    : "";
  console.log(
    `\n  Largest prompt accepted: ~${largestAccepted.estimated.toLocaleString()} estimated tokens${reported}`,
  );
  return 0;
}

async function main() {
  const failures = (await streamHi()) + (await probeContext());
  process.exit(failures ? 1 : 0);
}

main();
