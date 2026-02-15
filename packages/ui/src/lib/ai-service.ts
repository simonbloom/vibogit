export interface AIProvider {
  id: "anthropic" | "openai" | "gemini";
  displayName: string;
  model: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "anthropic",
    displayName: "Anthropic (Claude Haiku)",
    model: "claude-3-5-haiku-latest",
    keyPlaceholder: "sk-ant-...",
    keyHelpUrl: "https://console.anthropic.com",
  },
  {
    id: "openai",
    displayName: "OpenAI (GPT-4o mini)",
    model: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    displayName: "Google (Gemini Flash)",
    model: "gemini-2.0-flash-exp",
    keyPlaceholder: "AIza...",
    keyHelpUrl: "https://aistudio.google.com/apikey",
  },
];

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
