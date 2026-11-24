import { NextRequest, NextResponse } from "next/server";
import {
  getUserSettings,
  isValidEnergyUnit,
  isValidMacroUnit,
  updateUserSettings,
} from "@/lib/db";
import type { UserSettingsPatch } from "@/types/food";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export async function GET() {
  try {
    const settings = await getUserSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch user settings:", error);
    return NextResponse.json(
      { error: "Failed to load user preferences" },
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

  const record = body as Record<string, unknown>;
  const patch: UserSettingsPatch = {};

  if ("dailyCalorieGoal" in record) {
    if (!isIntInRange(record.dailyCalorieGoal, 500, 10000)) {
      return NextResponse.json(
        {
          error: "'dailyCalorieGoal' must be a whole number between 500 and 10000",
        },
        { status: 400 }
      );
    }
    patch.dailyCalorieGoal = record.dailyCalorieGoal;
  }

  if ("proteinGoal" in record) {
    if (!isIntInRange(record.proteinGoal, 10, 800)) {
      return NextResponse.json(
        { error: "'proteinGoal' must be a whole number between 10 and 800" },
        { status: 400 }
      );
    }
    patch.proteinGoal = record.proteinGoal;
  }

  if ("carbsGoal" in record) {
    if (!isIntInRange(record.carbsGoal, 0, 1500)) {
      return NextResponse.json(
        { error: "'carbsGoal' must be a whole number between 0 and 1500" },
        { status: 400 }
      );
    }
    patch.carbsGoal = record.carbsGoal;
  }

  if ("fatGoal" in record) {
    if (!isIntInRange(record.fatGoal, 10, 400)) {
      return NextResponse.json(
        { error: "'fatGoal' must be a whole number between 10 and 400" },
        { status: 400 }
      );
    }
    patch.fatGoal = record.fatGoal;
  }

  if ("energyUnit" in record) {
    if (!isValidEnergyUnit(record.energyUnit)) {
      return NextResponse.json(
        { error: "'energyUnit' must be either 'kcal' or 'kj'" },
        { status: 400 }
      );
    }
    patch.energyUnit = record.energyUnit;
  }

  if ("macroUnit" in record) {
    if (!isValidMacroUnit(record.macroUnit)) {
      return NextResponse.json(
        { error: "'macroUnit' must be either 'g' or 'oz'" },
        { status: 400 }
      );
    }
    patch.macroUnit = record.macroUnit;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide at least one valid preference field to update" },
      { status: 400 }
    );
  }

  try {
    const saved = await updateUserSettings(patch);
    return NextResponse.json(saved);
  } catch (error) {
    console.error("Failed to update user settings:", error);
    return NextResponse.json(
      { error: "Failed to save user preferences" },
      { status: 500 }
    );
  }
}
