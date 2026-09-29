// The model catalog: the only list of models that exist. Safe to import from
// the browser; it holds no keys or URLs. A conversation whose model id is not
// in this list belongs to a retired model.

export type ProviderRoute = "openai" | "anthropic" | "google";

export type ModelCapabilities = {
  documents: boolean;
  images: boolean;
  webSearch: boolean;
  multiTurn: boolean;
};

export type CatalogModel = {
  id: string;
  displayName: string;
  description: string;
  route: ProviderRoute;
  // The one model the proxy serves on this route.
  upstreamModelId: string;
  capabilities: ModelCapabilities;
};

const capabilities: ModelCapabilities = {
  documents: true,
  images: false,
  webSearch: false,
  multiTurn: false,
};

export const models: readonly CatalogModel[] = [
  {
    id: "chatgpt",
    displayName: "ChatGPT",
    description: "OpenAI's assistant, good all-rounder for everyday questions.",
    route: "openai",
    upstreamModelId: "gpt-5.6-luna",
    capabilities,
  },
  {
    id: "claude",
    displayName: "Claude",
    description: "Anthropic's assistant, careful with writing and long documents.",
    route: "anthropic",
    upstreamModelId: "claude-haiku-4-5-20251001",
    capabilities,
  },
  {
    id: "gemini",
    displayName: "Gemini",
    description: "Google's assistant, quick answers and broad knowledge.",
    route: "google",
    upstreamModelId: "gemini-3.8-flash",
    capabilities,
  },
];

export function findModel(id: string): CatalogModel | undefined {
  return models.find((model) => model.id === id);
}
