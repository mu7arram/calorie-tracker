import { NextRequest, NextResponse } from "next/server";
import { deleteFoodLog } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json(
      { error: "Invalid log entry ID" },
      { status: 400 }
    );
  }

  try {
    const deleted = deleteFoodLog(numericId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Food log entry not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ deletedId: numericId });
  } catch (error) {
    console.error("Failed to delete food log:", error);
    return NextResponse.json(
      { error: "Failed to delete food log entry" },
      { status: 500 }
    );
  }
}

