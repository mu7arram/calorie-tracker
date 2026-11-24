export interface MacroTargets {
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
}

export interface MacroGoalMismatch {
  macroKcal: number;
  diffKcal: number;
  absDiff: number;
  isMismatched: boolean;
}

export const MACRO_BOUNDS = {
  protein: { min: 10, max: 800 },
  carbs: { min: 0, max: 1500 },
  fat: { min: 10, max: 400 },
} as const;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function calculateMacroKcal(targets: MacroTargets): number {
  return Math.round(
    targets.proteinGoal * 4 + targets.carbsGoal * 4 + targets.fatGoal * 9
  );
}

/**
 * Flags a soft mismatch when macro target calories diverge from the daily
 * calorie goal by more than 5% (minimum 50 kcal tolerance so rounding on the
 * default 2,000 kcal / 1,985 kcal split stays quiet).
 */
export function getMacroGoalMismatch(
  dailyCalorieGoal: number,
  targets: MacroTargets
): MacroGoalMismatch {
  const macroKcal = calculateMacroKcal(targets);
  const diffKcal = macroKcal - dailyCalorieGoal;
  const absDiff = Math.abs(diffKcal);
  const tolerance = Math.max(50, Math.round(dailyCalorieGoal * 0.05));

  return {
    macroKcal,
    diffKcal,
    absDiff,
    isMismatched: dailyCalorieGoal > 0 && absDiff > tolerance,
  };
}

/**
 * Scales existing macro targets proportionally to match a new calorie goal,
 * preserving the user's custom P/C/F ratio (falling back to 30/40/30 if
 * current targets sum to 0).
 */
export function scaleMacrosToCalorieGoal(
  targetKcal: number,
  current?: MacroTargets
): MacroTargets {
  const currentKcal = current ? calculateMacroKcal(current) : 0;

  if (current && currentKcal > 0) {
    const ratio = targetKcal / currentKcal;
    return {
      proteinGoal: clampInt(
        current.proteinGoal * ratio,
        MACRO_BOUNDS.protein.min,
        MACRO_BOUNDS.protein.max
      ),
      carbsGoal: clampInt(
        current.carbsGoal * ratio,
        MACRO_BOUNDS.carbs.min,
        MACRO_BOUNDS.carbs.max
      ),
      fatGoal: clampInt(
        current.fatGoal * ratio,
        MACRO_BOUNDS.fat.min,
        MACRO_BOUNDS.fat.max
      ),
    };
  }

  return {
    proteinGoal: clampInt(
      (targetKcal * 0.3) / 4,
      MACRO_BOUNDS.protein.min,
      MACRO_BOUNDS.protein.max
    ),
    carbsGoal: clampInt(
      (targetKcal * 0.4) / 4,
      MACRO_BOUNDS.carbs.min,
      MACRO_BOUNDS.carbs.max
    ),
    fatGoal: clampInt(
      (targetKcal * 0.3) / 9,
      MACRO_BOUNDS.fat.min,
      MACRO_BOUNDS.fat.max
    ),
  };
}
