import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOOD_TRANSLATIONS,
  formatGrams,
  formatHeaderDate,
  getLocaleDirection,
  localizeFoodItem,
  matchesFoodSearch,
} from "../i18n";
import { SEED_FOODS } from "../seed-foods";

describe("Internationalization helpers & catalog translations", () => {
  it("provides complete Spanish and Arabic translations for all 24 seeded foods", () => {
    for (const food of SEED_FOODS) {
      const entry = FOOD_TRANSLATIONS[food.name];
      assert.ok(entry, `Missing FOOD_TRANSLATIONS entry for ${food.name}`);
      assert.ok(entry.es.name.trim().length > 0);
      assert.ok(entry.es.servingSize.trim().length > 0);
      assert.ok(entry.ar.name.trim().length > 0);
      assert.ok(entry.ar.servingSize.trim().length > 0);

      const arFood = localizeFoodItem(food, "ar");
      assert.equal(arFood.name, entry.ar.name);
      const esFood = localizeFoodItem(food, "es");
      assert.equal(esFood.name, entry.es.name);
    }
  });

  it("matches catalog search queries in both English and localized languages", () => {
    const chicken = SEED_FOODS[0];
    assert.equal(matchesFoodSearch(chicken, "chicken", "ar"), true);
    assert.equal(matchesFoodSearch(chicken, "دجاج", "ar"), true);
    assert.equal(matchesFoodSearch(chicken, "pollo", "es"), true);
    assert.equal(matchesFoodSearch(chicken, "salmon", "es"), false);
  });

  it("maps reading directions and formats Arabic dates with Western numerals", () => {
    assert.equal(getLocaleDirection("en"), "ltr");
    assert.equal(getLocaleDirection("es"), "ltr");
    assert.equal(getLocaleDirection("ar"), "rtl");

    const arDate = formatHeaderDate("2026-11-21", "ar");
    assert.ok(arDate.includes("2026"));
    assert.ok(arDate.includes("21"));
    assert.equal(formatGrams(99.1, "en"), "99.1g");
    assert.equal(formatGrams(99.1, "ar"), "99.1 غ");
  });
});
