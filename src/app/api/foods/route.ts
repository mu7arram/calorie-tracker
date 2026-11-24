import { NextRequest, NextResponse } from "next/server";
import { listFoods } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const foods = listFoods();
    const filtered = query
      ? foods.filter((food) => food.name.toLowerCase().includes(query))
      : foods;

    return NextResponse.json({ foods: filtered });
  } catch (error) {
    console.error("Failed to fetch foods:", error);
    return NextResponse.json(
      { error: "Failed to load food catalog" },
      { status: 500 }
    );
  }
}

