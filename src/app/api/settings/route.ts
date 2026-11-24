import { NextRequest, NextResponse } from "next/server";
import { getDailyCalorieGoal, setDailyCalorieGoal } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_GOAL = 500;
const MAX_GOAL = 10000;

export async function GET() {
  try {
    const dailyCalorieGoal = getDailyCalorieGoal();
    return NextResponse.json({ dailyCalorieGoal });
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return NextResponse.json(
      { error: "Failed to load daily calorie goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

  const { dailyCalorieGoal } = body as Record<string, unknown>;
  if (
    typeof dailyCalorieGoal !== "number" ||
    !Number.isInteger(dailyCalorieGoal) ||
    dailyCalorieGoal < MIN_GOAL ||
    dailyCalorieGoal > MAX_GOAL
  ) {
    return NextResponse.json(
      {
        error: `'dailyCalorieGoal' must be a whole number between ${MIN_GOAL} and ${MAX_GOAL}`,
      },
      { status: 400 }
    );
  }

  try {
    const saved = setDailyCalorieGoal(dailyCalorieGoal);
    return NextResponse.json({ dailyCalorieGoal: saved });
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return NextResponse.json(
      { error: "Failed to save daily calorie goal" },
      { status: 500 }
    );
  }
}

