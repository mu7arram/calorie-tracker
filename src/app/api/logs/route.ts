import { NextRequest, NextResponse } from "next/server";
import {
  addCustomFoodLogs,
  addFoodLog,
  getDailyLog,
  isValidDateString,
  isValidMealCategory,
} from "@/lib/db";
import type { CustomFoodLogItem, MealCategory } from "@/types/food";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "";

  if (!isValidDateString(date)) {
    return NextResponse.json(
      { error: "Query parameter 'date' must be a valid YYYY-MM-DD date" },
      { status: 400 }
    );
  }

  try {
    const dailyLog = getDailyLog(date);
    return NextResponse.json(dailyLog);
  } catch (error) {
    console.error("Failed to fetch daily log:", error);
    return NextResponse.json(
      { error: "Failed to load daily food log" },
      { status: 500 }
    );
  }
}

const MAX_CUSTOM_ITEMS = 30;
const MAX_MACRO_VALUE = 50000;

function isFiniteNonNegative(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_MACRO_VALUE
  );
}

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

  const record = body as Record<string, unknown>;
  const { loggedDate, mealCategory: rawMealCategory } = record;

  if (typeof loggedDate !== "string" || !isValidDateString(loggedDate)) {
    return NextResponse.json(
      { error: "'loggedDate' must be a valid YYYY-MM-DD date" },
      { status: 400 }
    );
  }

  let mealCategory: MealCategory = "Snack";
  if (rawMealCategory !== undefined) {
    if (!isValidMealCategory(rawMealCategory)) {
      return NextResponse.json(
        {
          error:
            "'mealCategory' must be one of: Breakfast, Lunch, Dinner, Snack",
        },
        { status: 400 }
      );
    }
    mealCategory = rawMealCategory;
  }

  if ("items" in record) {
    const rawItems = record.items;
    if (
      !Array.isArray(rawItems) ||
      rawItems.length === 0 ||
      rawItems.length > MAX_CUSTOM_ITEMS
    ) {
      return NextResponse.json(
        {
          error: `'items' must be a non-empty array of at most ${MAX_CUSTOM_ITEMS} food items`,
        },
        { status: 400 }
      );
    }

    const validatedItems: CustomFoodLogItem[] = [];
    for (let index = 0; index < rawItems.length; index++) {
      const rawItem = rawItems[index];
      if (!rawItem || typeof rawItem !== "object") {
        return NextResponse.json(
          { error: `Item at index ${index} must be an object` },
          { status: 400 }
        );
      }

      const item = rawItem as Record<string, unknown>;
      if (
        typeof item.name !== "string" ||
        item.name.trim().length === 0 ||
        item.name.trim().length > 200
      ) {
        return NextResponse.json(
          { error: `Item at index ${index} must have a valid 'name' (1-200 chars)` },
          { status: 400 }
        );
      }

      if (
        typeof item.servingSize !== "string" ||
        item.servingSize.trim().length === 0 ||
        item.servingSize.trim().length > 120
      ) {
        return NextResponse.json(
          {
            error: `Item at index ${index} must have a valid 'servingSize' (1-120 chars)`,
          },
          { status: 400 }
        );
      }

      const servings = item.servings === undefined ? 1 : item.servings;
      if (
        typeof servings !== "number" ||
        !Number.isFinite(servings) ||
        servings <= 0 ||
        servings > 100
      ) {
        return NextResponse.json(
          {
            error: `Item at index ${index} 'servings' must be a finite number between 0 and 100`,
          },
          { status: 400 }
        );
      }

      if (
        !isFiniteNonNegative(item.calories) ||
        !isFiniteNonNegative(item.protein) ||
        !isFiniteNonNegative(item.carbs) ||
        !isFiniteNonNegative(item.fat)
      ) {
        return NextResponse.json(
          {
            error: `Item at index ${index} macros (calories, protein, carbs, fat) must be non-negative numbers`,
          },
          { status: 400 }
        );
      }

      validatedItems.push({
        name: item.name.trim(),
        servingSize: item.servingSize.trim(),
        servings,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
      });
    }

    try {
      const updatedLog = addCustomFoodLogs({
        items: validatedItems,
        loggedDate,
        mealCategory,
      });
      return NextResponse.json(updatedLog, { status: 201 });
    } catch (error) {
      console.error("Failed to add custom food logs:", error);
      return NextResponse.json(
        { error: "Failed to save food log entries" },
        { status: 500 }
      );
    }
  }

  const { foodId, servings } = record;

  if (typeof foodId !== "number" || !Number.isInteger(foodId) || foodId <= 0) {
    return NextResponse.json(
      { error: "'foodId' must be a positive integer" },
      { status: 400 }
    );
  }

  if (
    typeof servings !== "number" ||
    !Number.isFinite(servings) ||
    servings <= 0 ||
    servings > 100
  ) {
    return NextResponse.json(
      { error: "'servings' must be a finite number between 0 and 100" },
      { status: 400 }
    );
  }

  try {
    const updatedLog = addFoodLog({
      foodId,
      servings,
      loggedDate,
      mealCategory,
    });
    if (!updatedLog) {
      return NextResponse.json(
        { error: "Food item not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(updatedLog, { status: 201 });
  } catch (error) {
    console.error("Failed to add food log:", error);
    return NextResponse.json(
      { error: "Failed to save food log entry" },
      { status: 500 }
    );
  }
}

