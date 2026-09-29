# Model catalog

Source: `GET /api/chat-api/v2/models`, fetched 2026-09-29 while logged in. There are 17 models from 7 providers.

Legend: **MT** = supports multiple tool-use turns · **Img/Doc** = accepts image or document attachments · **In/Out** = `max_input_tokens` / `max_output_tokens` from metadata (`–` = not set). The API calls "thinking effort" `reasoning-efforts`.

| Provider | Model id | Display name | Tier | Thinking effort | MT | Img | Doc | Web search (¢/call) | In / Out |
|---|---|---|---|---|---|---|---|---|---|
| OpenAI | `openai/gpt-6-sol` | GPT-6 Sol | Premium | none/low/medium/high | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| OpenAI | `openai/gpt-6-luna` | GPT-6 Luna | Value | none/low/medium | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| OpenAI | `openai/gpt-5.6-sol` | GPT-5.6 Sol | Premium | none/low/medium/high | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| OpenAI | `openai/gpt-5.6-terra` | GPT-5.6 Terra | Standard | none/low/medium/high | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| OpenAI | `openai/gpt-5.6-luna` | GPT-5.6 Luna | Value | none/low/medium | ✓ | ✓ | ✓ | 2 | – / 128k |
| Anthropic | `anthropic/claude-opus-5` | Claude Opus 5 | Premium | none/low/medium | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| Anthropic | `anthropic/claude-sonnet-5` | Claude Sonnet 5 | Standard | none/low/medium | ✓ | ✓ | ✓ | 2 | 256k / 128k |
| Anthropic | `anthropic/claude-haiku-4.5` | Claude Haiku 4.5 | Value | – | | ✓ | ✓ | 2 | – / 64k |
| Moonshot AI | `moonshotai/kimi-k3` | Kimi K3 | Standard | low/high/extreme | | ✓ | ✓ | 1.4 | 256k / 1M |
| Moonshot AI | `moonshotai/kimi-k2.7-code` | Kimi K2.7 Code | Value | none/low/medium/high | | ✓ | ✓ | 1.4 | – / 262k |
| Moonshot AI | `moonshotai/kimi-k2.6` | Kimi K2.6 | Value | – | | ✓ | ✓ | 1.4 | – / 262k |
| Z.ai | `z-ai/glm-5.3` | GLM 5.3 | Value | low/medium/high/extreme | | | ✓ | 1.4 | – / 131k |
| Z.ai | `z-ai/glm-5.3-flash` | GLM 5.3 Flash | Value | low/medium/high/extreme | | ✓ | ✓ | 1.4 | – / 131k |
| Z.ai | `z-ai/glm-5.2` | GLM 5.2 | Value | none/low/medium/high | | | ✓ | 1.4 | – / 131k |
| Qwen | `qwen/qwen3.8-2.4t-a95b` | Qwen 3.8 | Standard | low/medium/high | | | ✓ | 1.4 | – / 262k |
| DeepSeek | `deepseek/deepseek-v4.1-flash` | DeepSeek V4.1 Flash | Value | none/low/high/extreme | | ✓ | ✓ | 1.4 | – / 393k |
| MiniMax | `minimax/minimax-m3` | MiniMax M3 | Value | none/low/medium/high | | ✓ | ✓ | **no web search** | – / 512k |

Display names for GPT-6 Sol, GLM 5.3 / 5.3 Flash and Qwen 3.8 are taken from the model ids, not read from the API. The rest were seen in the picker or the API.

Kimi K3's 1M output limit is what the API reports. It is bigger than the model's input limit, so it is probably a config error.

## Observations

- **Tiers stand in for prices.** The picker shows Value / Standard / Premium badges instead of per-token prices. Pricing CSS exists, so prices can be shown when needed. Value models are the majority (10 of 17).
- **Two ways models are served.**
  - OpenAI and Anthropic models use first-party APIs and first-party web search (`openai/web_search`, `anthropic/web_search`, 2¢).
  - Open-weight models go through **Fireworks** (`provider_model_name: accounts/fireworks/models/…`, `adapter-key: fireworks`) with Fireworks web search at 1.4¢.
- **The capability flags drive the UI.** Each model record contains everything the composer needs to show or hide controls:

  ```text
  model/reasoning-efforts, model/default-reasoning-effort
  model/supports-multiple-turns
  model/supports-image-attachments, model/supports-document-attachments
  model/compatible-tool-names
  model/metadata.tools.{web_search, generate_slides, *_rate_usd_cents}
  model/metadata.{max_input_tokens, max_output_tokens, output_limit_mode}
  model/agent-capability  + model/agent-enabled
  model/office-capability + model/office-enabled
  ```

- **Agent limits are set per model.** For example `{"max_tool_calls":2,"max_model_steps":5,"max_elapsed_seconds":120,"parallel-tool-calls":false,"max_spend_nano_unit":null}`. There is also a `certification-version`, which suggests each model is tested before agent mode is turned on for it.
- **Thinking effort levels differ between providers.** Some models add `extreme`, some have no `none`. The UI reads the list from each model rather than hard-coding it.
- **Multi-turn tool use** is only offered on OpenAI models and on Claude Sonnet 5 and Opus 5. Claude Haiku 4.5 and all Fireworks-hosted models don't have it.
- `output_limit_mode: "remaining_context"` on some models means the output cap is whatever context remains after the input.
