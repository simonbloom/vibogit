import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

function createModel(provider: AIProvider, apiKey: string) {
  switch (provider.id) {
    case "anthropic":
      return createAnthropic({ apiKey })(provider.model);
    case "openai":
      return createOpenAI({ apiKey })(provider.model);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(provider.model);
    default:
      throw new Error(`Unknown provider: ${provider.id}`);
  }
}

function buildCommitPrompt(diff: string): string {
  return `Write a git commit message for this diff.
Use conventional commit format (type: description).
Output ONLY the commit message - no markdown, no code blocks, no backticks, no quotes.
First line should be under 72 characters.
If the diff is summarized, rely on the stats and file list.

${diff.slice(0, 10000)}`;
}

function cleanCommitMessage(message: string): string {
  let cleaned = message.trim();

  // Remove markdown code blocks (```text, ```bash, ``` etc.)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```\w*\n?/g, "").replace(/```/g, "").trim();
  }

  // Remove surrounding quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Remove single backticks
  if (cleaned.startsWith("`") && cleaned.endsWith("`")) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

export async function generateCommitMessage(
  diff: string,
  provider: AIProvider,
  apiKey: string
): Promise<string> {
  const model = createModel(provider, apiKey);

  const { text } = await generateText({
    model,
    prompt: buildCommitPrompt(diff),
    maxTokens: 500,
  });

  return cleanCommitMessage(text);
}

export function getDefaultProvider(): AIProvider {
  return AI_PROVIDERS[0];
}

export function getProviderById(id: string): AIProvider | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}
