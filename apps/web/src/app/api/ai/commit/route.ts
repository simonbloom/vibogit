import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

interface RequestBody {
  diff: string;
  provider: "anthropic" | "openai" | "gemini";
  apiKey: string;
}

const MODELS = {
  anthropic: "claude-3-5-haiku-latest",
  openai: "gpt-4o-mini",
  gemini: "gemini-2.0-flash-exp",
};

function createModel(provider: string, apiKey: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(MODELS.anthropic);
    case "openai":
      return createOpenAI({ apiKey })(MODELS.openai);
    case "gemini":
      return createGoogleGenerativeAI({ apiKey })(MODELS.gemini);
    default:
      throw new Error(`Unknown provider: ${provider}`);
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

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/```\w*\n?/g, "").replace(/```/g, "").trim();
  }

  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (cleaned.startsWith("`") && cleaned.endsWith("`")) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { diff, provider, apiKey } = body;

    if (!diff || !provider || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields: diff, provider, apiKey" },
        { status: 400 }
      );
    }

    const model = createModel(provider, apiKey);

    const { text } = await generateText({
      model,
      prompt: buildCommitPrompt(diff),
      maxTokens: 500,
    });

    const message = cleanCommitMessage(text);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("AI commit generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate commit message" },
      { status: 500 }
    );
  }
}
