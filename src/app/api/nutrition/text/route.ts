import { NextRequest, NextResponse } from "next/server";
import {
  estimateNutritionFromText,
  GeminiConfigError,
  GeminiUpstreamError,
} from "@/lib/gemini";
import { isValidLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DESCRIPTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const { description, locale: rawLocale } = body as Record<string, unknown>;
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json(
      { error: "'description' must be a non-empty string" },
      { status: 400 }
    );
  }

  const trimmed = description.trim();
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `'description' must be at most ${MAX_DESCRIPTION_LENGTH} characters` },
      { status: 400 }
    );
  }

  let locale: Locale = "en";
  if (rawLocale !== undefined) {
    if (!isValidLocale(rawLocale)) {
      return NextResponse.json(
        { error: "'locale' must be one of: en, es, ar" },
        { status: 400 }
      );
    }
    locale = rawLocale;
  }

  try {
    const result = await estimateNutritionFromText(trimmed, locale);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof GeminiUpstreamError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Unexpected error in /api/nutrition/text:", error);
    return NextResponse.json(
      { error: "Failed to estimate nutrition from text" },
      { status: 500 }
    );
  }
}
