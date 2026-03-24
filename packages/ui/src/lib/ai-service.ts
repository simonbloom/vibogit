export interface AIModelOption {
  id: string;
  displayName: string;
}

export interface AIProvider {
  id: "anthropic" | "openai";
  displayName: string;
  model: string;
  models: AIModelOption[];
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "anthropic",
    displayName: "Anthropic",
    model: "claude-sonnet-4-6-20260217",
    models: [
      { id: "claude-sonnet-4-6-20260217", displayName: "Sonnet 4.6" },
    ],
    keyPlaceholder: "sk-ant-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    displayName: "OpenAI",
    model: "gpt-5.4",
    models: [
      { id: "gpt-5.4", displayName: "GPT-5.4" },
    ],
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
];

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

export function getModelForProvider(providerId: string, modelId?: string): string {
  const provider = getProviderById(providerId);
  if (!provider) return "gpt-5.4";
  if (modelId && provider.models.some((m) => m.id === modelId)) return modelId;
  return provider.model;
}
