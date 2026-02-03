import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

interface RequestBody {
  commits: string[];
  diff: string;
  baseBranch: string;
  headBranch: string;
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

function buildPRPrompt(
  commits: string[],
  diff: string,
  baseBranch: string,
  headBranch: string
): string {
  return `Generate a pull request title and description for the following changes.

Branch: ${headBranch} → ${baseBranch}

Commits:
${commits.join("\n")}

Diff summary (truncated):
${diff.slice(0, 5000)}

Output format (JSON):
{
  "title": "Short descriptive title (max 72 chars)",
  "description": "Markdown description with ## Summary and ## Changes sections"
}

Output ONLY valid JSON, no markdown code blocks.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { commits, diff, baseBranch, headBranch, provider, apiKey } = body;

    if (!commits || !provider || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const model = createModel(provider, apiKey);

    const { text } = await generateText({
      model,
      prompt: buildPRPrompt(commits, diff, baseBranch, headBranch),
      maxTokens: 1000,
    });

    // Parse JSON response
    let parsed;
    try {
      // Remove any markdown code blocks if present
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback if parsing fails
      parsed = {
        title: `Merge ${headBranch} into ${baseBranch}`,
        description: text,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("AI PR generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate PR" },
      { status: 500 }
    );
  }
}
