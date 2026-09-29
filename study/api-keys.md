# Course API keys (BUILD LLM Proxy)

Tested on 2026-09-29 by sending real requests to every route. The keys themselves live only in `.env.local` (git-ignored).

## What they are

Three `lp_…` keys for **BUILD LLM Proxy** at `https://proxy.litechat.ai` (same server as litechat.ai, `145.239.154.51`). All three run **DeepSeek Flash**, but each one copies a different provider's API, so the official SDKs work with only the base URL changed.

| UI label | Env vars | Base URL | API format | Only model |
|---|---|---|---|---|
| ChatGPT | `OPENAI_*` | `https://proxy.litechat.ai/openai/v1` | OpenAI Chat Completions **and** Responses | `gpt-5.6-luna` |
| Claude | `ANTHROPIC_*` | `https://proxy.litechat.ai/anthropic/v1` | Anthropic Messages | `claude-haiku-4-5-20251001` |
| Gemini | `GOOGLE_GENERATIVE_AI_*` | `https://proxy.litechat.ai/google/v1beta` | Gemini `generateContent` / `streamGenerateContent` | `gemini-3.8-flash` |

- A key only works on its own route. On another route it returns `401 invalid or inactive provider key`.
- Auth headers follow each provider: `Authorization: Bearer` (OpenAI), `x-api-key` + `anthropic-version` (Anthropic), `x-goog-api-key` (Google).
- `GET …/models` on each route lists its single model.
- Each response has an `x-request-id` header. Invalid parameters come back as `upstream request failed; consult operator request status`, so save the request id when you report a problem.

## What works (tested)

| Capability | OpenAI route | Anthropic route | Google route | Notes |
|---|---|---|---|---|
| Plain chat | ✅ | ✅ | ✅ | |
| Streaming | ✅ chat + Responses | ✅ | ✅ `?alt=sse` | |
| System prompt | ✅ | – | ✅ `systemInstruction` | "Always answer in French" was obeyed |
| Reasoning / thinking | ✅ `reasoning_content` | ✅ `thinking` blocks | ✅ `thought: true` parts | Every reply thinks first |
| Reasoning effort | ⚠️ accepted, no effect | – | ⚠️ `thinkingLevel` accepted | low vs high used 45 vs 46 reasoning tokens |
| Function (custom) tools | ✅ `tool_calls` | – | – | The model called our `get_weather` tool |
| Images | ⚠️ unreliable | ⚠️ unreliable | ⚠️ unreliable | Solid colours: red ✓ yellow ✓ blue → "Navy", green → **"White"**, blue → "Maroon" (Google) |
| PDFs | ❌ `unsupported image type` | ❌ `unsupported content block` | ❌ `unsupported image type` | |
| Built-in web search | – | ❌ `web_search` tool: `schema must be an object` | ❌ `googleSearch`: `functionDeclarations required` | Treats them as broken custom tools |

"–" = not tested on that route. The backend is the same model on every route, so results should carry over.

## Gotchas

- **Budget for thinking.** With `max_tokens: 60` the whole budget went on reasoning and every answer was **empty**. Use at least 800, and more for long answers. This includes auto-title calls.
- **The connection is flaky.** Several requests during testing got no response at all (connection timeout), then worked on retry. Retry on connection errors.
- **Hidden persona prompt (~200 input tokens on every request).** The Responses stream echoes it in `instructions`:

  > Adopt the GPT assistant persona for this conversation through BUILD LLM Proxy. For ordinary questions about your conversational identity, use the name GPT. Keep ordinary introductions short, without service names, backend details, or explanations about personas or simulation unless the user asks for actual provenance. […] If asked directly about the actual backend or service provenance, explain that BUILD LLM Proxy uses DeepSeek Flash to provide this persona. […]

  In practice: "Who are you?" → *"I'm GPT, an AI assistant."*; "What model actually runs behind this API?" → *"BUILD LLM Proxy uses DeepSeek Flash to provide this Claude persona."* The persona and the honest-provenance answer come from the proxy, so the app doesn't need its own persona prompt. Don't add system prompts that tell it to deny being DeepSeek.
- **Unknown:** rate limits and spend caps. Ask the instructor.
