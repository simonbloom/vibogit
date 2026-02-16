export interface AIModelOption {
  id: string;
  displayName: string;
}

export interface AIProvider {
  id: "anthropic" | "openai" | "gemini";
  displayName: string;
  model: string;
  models: AIModelOption[];
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "anthropic",
    displayName: "Anthropic (Claude Haiku)",
    model: "claude-3-5-haiku-latest",
    models: [
      { id: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku" },
    ],
    keyPlaceholder: "sk-ant-...",
    keyHelpUrl: "https://console.anthropic.com",
  },
  {
    id: "openai",
    displayName: "OpenAI",
    model: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", displayName: "GPT-4o mini" },
      { id: "gpt-5.3-codex-spark", displayName: "GPT-5.3 Codex Spark" },
    ],
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    displayName: "Google (Gemini Flash)",
    model: "gemini-2.0-flash-exp",
    models: [
      { id: "gemini-2.0-flash-exp", displayName: "Gemini 2.0 Flash" },
    ],
    keyPlaceholder: "AIza...",
    keyHelpUrl: "https://aistudio.google.com/apikey",
  },
];

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export function getModelForProvider(providerId: string, modelId?: string): string {
  const provider = getProviderById(providerId);
  if (!provider) return "gpt-4o-mini";
  if (modelId && provider.models.some((m) => m.id === modelId)) return modelId;
  return provider.model;
}
