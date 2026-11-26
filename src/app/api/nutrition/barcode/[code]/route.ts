import { NextRequest, NextResponse } from "next/server";
import {
  BarcodeUpstreamError,
  checkBarcodeRateLimit,
  lookupBarcodeNutrition,
  normalizeBarcode,
} from "@/lib/barcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientKey(request: NextRequest): string {
  // Prefer Vercel's edge-populated IP header (cannot be spoofed by callers on Vercel);
  // fall back to x-real-ip / x-forwarded-for for local dev or other reverse proxies.
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const rate = checkBarcodeRateLimit(getClientKey(request));
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many barcode lookup requests. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const { code } = await context.params;
  const normalized = normalizeBarcode(code ?? "");

  if (!normalized) {
    return NextResponse.json(
      { error: "Barcode must be a valid 8 to 14 digit UPC/EAN/GTIN code" },
      { status: 400 }
    );
  }

  try {
    const result = await lookupBarcodeNutrition(normalized);
    if (!result) {
      return NextResponse.json(
        { error: "Product not found in Open Food Facts" },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof BarcodeUpstreamError) {
      console.error("Barcode upstream error:", error.message);
      return NextResponse.json(
        { error: "Barcode lookup service is temporarily unavailable" },
        { status: 502 }
      );
    }

    console.error("Unexpected barcode lookup error:", error);
    return NextResponse.json(
      { error: "Failed to look up barcode" },
      { status: 500 }
    );
  }
}
