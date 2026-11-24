import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateMacroKcal,
  getMacroGoalMismatch,
  scaleMacrosToCalorieGoal,
} from "../macro-sync";

describe("Macro-to-calorie sync helpers", () => {
  it("does not flag default 2,000 kcal / 1,985 kcal targets as mismatched", () => {
    const result = getMacroGoalMismatch(2000, {
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
    });
    assert.equal(result.macroKcal, 1985);
    assert.equal(result.isMismatched, false);
  });

  it("flags a mismatch when calorie goal diverges by more than 5%", () => {
    const below = getMacroGoalMismatch(2600, {
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
    });
    assert.equal(below.isMismatched, true);
    assert.equal(below.diffKcal, -615);

    const above = getMacroGoalMismatch(1500, {
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
    });
    assert.equal(above.isMismatched, true);
    assert.equal(above.diffKcal, 485);
  });

  it("scales existing custom macro ratios proportionally and respects bounds", () => {
    const scaled = scaleMacrosToCalorieGoal(2600, {
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
    });
    const scaledKcal = calculateMacroKcal(scaled);
    assert.ok(Math.abs(scaledKcal - 2600) <= 15);
    assert.equal(getMacroGoalMismatch(2600, scaled).isMismatched, false);

    // Extreme 10,000 kcal goal stays clamped within valid DB bounds
    const maxScaled = scaleMacrosToCalorieGoal(10000, {
      proteinGoal: 150,
      carbsGoal: 200,
      fatGoal: 65,
    });
    assert.ok(maxScaled.proteinGoal >= 10 && maxScaled.proteinGoal <= 800);
    assert.ok(maxScaled.carbsGoal >= 0 && maxScaled.carbsGoal <= 1500);
    assert.ok(maxScaled.fatGoal >= 10 && maxScaled.fatGoal <= 400);
  });
});

