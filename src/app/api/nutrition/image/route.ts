import { NextRequest, NextResponse } from "next/server";
import {
  estimateNutritionFromImage,
  GeminiConfigError,
  GeminiUpstreamError,
} from "@/lib/gemini";
import { isValidLocale, type Locale } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request must be multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'image' file field in form data" },
      { status: 400 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { error: "Uploaded image file is empty" },
      { status: 400 }
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image file must be 10 MB or smaller" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported image type '${file.type || "unknown"}'. Allowed: JPEG, PNG, WebP, GIF, HEIC, HEIF`,
      },
      { status: 400 }
    );
  }

  const rawLocale = formData.get("locale");
  let locale: Locale = "en";
  if (rawLocale !== null) {
    if (!isValidLocale(rawLocale)) {
      return NextResponse.json(
        { error: "'locale' must be one of: en, es, ar" },
        { status: 400 }
      );
    }
    locale = rawLocale;
  }

  const rawNotes = formData.get("notes");
  const notes =
    typeof rawNotes === "string" && rawNotes.trim()
      ? rawNotes.trim().slice(0, 300)
      : undefined;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString("base64");

    const result = await estimateNutritionFromImage({
      base64Data,
      mimeType: file.type,
      notes,
      locale,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GeminiConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof GeminiUpstreamError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("Unexpected error in /api/nutrition/image:", error);
    return NextResponse.json(
      { error: "Failed to analyze meal image" },
      { status: 500 }
    );
  }
}
