import { NextRequest, NextResponse } from "next/server";
import {
  BarcodeUpstreamError,
  lookupBarcodeNutrition,
  normalizeBarcode,
} from "@/lib/barcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const normalized = normalizeBarcode(code ?? "");

  if (!normalized) {
    return NextResponse.json(
      { error: "Barcode must contain 8 to 14 digits (UPC/EAN/GTIN)" },
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

    return NextResponse.json(result);
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
