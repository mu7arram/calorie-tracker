import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClient } from "@libsql/client";
import {
  addCustomFoodLogs,
  addFoodLog,
  createDatabase,
  DEFAULT_DAILY_CALORIE_GOAL,
  DEFAULT_USER_SETTINGS,
  deleteFoodLog,
  enumerateDateRange,
  getDailyCalorieGoal,
  getDailyHistory,
  getDailyLog,
  getUserSettings,
  initSchemaAndSeed,
  isValidDateString,
  listFoods,
  setDailyCalorieGoal,
  updateUserSettings,
} from "../db";

describe("Calorie Tracker libSQL data layer", () => {
  it("idempotently seeds at least 20 common foods", async () => {
    const db = await createDatabase(":memory:");
    const initialFoods = await listFoods(db);
    assert.ok(initialFoods.length >= 20);

    // Calling initSchemaAndSeed again must not duplicate rows.
    await initSchemaAndSeed(db);
    const foodsAfter = await listFoods(db);
    assert.equal(foodsAfter.length, initialFoods.length);
  });

  it("scales servings without floating-point noise and computes SQL totals", async () => {
    const db = await createDatabase(":memory:");
    const foods = await listFoods(db);
    const chicken = foods.find((f) => f.name.includes("Chicken Breast"));
    const rice = foods.find((f) => f.name.includes("White Rice"));
    assert.ok(chicken);
    assert.ok(rice);

    const log1 = await addFoodLog(
      { foodId: chicken.id, servings: 1.5, loggedDate: "2026-11-17" },
      db
    );
    assert.ok(log1);
    assert.equal(log1.entries.length, 1);
    assert.equal(log1.entries[0].calories, 247.5);
    assert.equal(log1.entries[0].protein, 46.5);
    assert.equal(log1.entries[0].fat, 5.4);

    const log2 = await addFoodLog(
      { foodId: rice.id, servings: 0.5, loggedDate: "2026-11-17" },
      db
    );
    assert.ok(log2);
    assert.equal(log2.entries.length, 2);
    assert.equal(log2.totals.calories, 350);
    assert.equal(log2.totals.protein, 48.7);
    assert.equal(log2.totals.carbs, 22.3);
    assert.equal(log2.totals.fat, 5.6);

    // Different date should remain isolated.
    const otherDay = await getDailyLog("2026-11-18", db);
    assert.equal(otherDay.entries.length, 0);
    assert.equal(otherDay.totals.calories, 0);
  });

  it("deletes existing entries and returns false for missing IDs", async () => {
    const db = await createDatabase(":memory:");
    const foods = await listFoods(db);
    const log = await addFoodLog(
      { foodId: foods[0].id, servings: 1, loggedDate: "2026-11-17" },
      db
    );
    assert.ok(log);
    const entryId = log.entries[0].id;

    assert.equal(await deleteFoodLog(entryId, db), true);
    assert.equal(await deleteFoodLog(entryId, db), false);

    const emptyLog = await getDailyLog("2026-11-17", db);
    assert.equal(emptyLog.entries.length, 0);
    assert.equal(emptyLog.totals.calories, 0);
  });

  it("validates YYYY-MM-DD date strings strictly", () => {
    assert.equal(isValidDateString("2026-11-17"), true);
    assert.equal(isValidDateString("2026-02-30"), false);
    assert.equal(isValidDateString("17-11-2026"), false);
    assert.equal(isValidDateString(""), false);
  });

  it("atomically inserts custom/AI food items with foodId=null and computes rounded totals", async () => {
    const db = await createDatabase(":memory:");
    const log = await addCustomFoodLogs(
      {
        loggedDate: "2026-11-20",
        items: [
          {
            name: "Grilled Chicken Breast",
            servingSize: "150g",
            calories: 231.24,
            protein: 43.55,
            carbs: 0,
            fat: 5.04,
          },
          {
            name: "Garden Salad",
            servingSize: "1.5 cups",
            servings: 1.5,
            calories: 65,
            protein: 2,
            carbs: 8,
            fat: 3,
          },
        ],
      },
      db
    );

    assert.equal(log.entries.length, 2);
    assert.equal(log.entries[0].foodId, null);
    assert.equal(log.entries[1].foodId, null);
    assert.deepEqual(log.totals, {
      calories: 328.7,
      protein: 46.6,
      carbs: 12,
      fat: 9.5,
    });

    const otherDay = await getDailyLog("2026-11-21", db);
    assert.equal(otherDay.entries.length, 0);
  });

  it("persists meal categories and migrates legacy food_logs tables safely", async () => {
    const db = await createDatabase(":memory:");
    const foods = await listFoods(db);
    const breakfastLog = await addFoodLog(
      {
        foodId: foods[0].id,
        servings: 1,
        loggedDate: "2026-11-20",
        mealCategory: "Breakfast",
      },
      db
    );
    assert.ok(breakfastLog);
    assert.equal(breakfastLog.entries[0].mealCategory, "Breakfast");

    const dinnerLog = await addCustomFoodLogs(
      {
        loggedDate: "2026-11-20",
        mealCategory: "Dinner",
        items: [
          {
            name: "Grilled Salmon",
            servingSize: "150g",
            calories: 309,
            protein: 33,
            carbs: 0,
            fat: 18.6,
          },
        ],
      },
      db
    );
    assert.equal(dinnerLog.entries[0].mealCategory, "Dinner");

    // Simulate legacy DB created without meal_category column or settings table
    const legacyDb = createClient({ url: ":memory:" });
    await legacyDb.executeMultiple(`
      CREATE TABLE foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        serving_size TEXT NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL
      );
      CREATE TABLE food_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
        food_name TEXT NOT NULL,
        serving_size TEXT NOT NULL,
        servings REAL NOT NULL,
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL,
        logged_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO food_logs (food_id, food_name, serving_size, servings, calories, protein, carbs, fat, logged_date, created_at)
      VALUES (NULL, 'Legacy Oatmeal', '1 cup', 1, 150, 5, 27, 2.5, '2026-11-19', '2026-11-19T08:00:00Z');
    `);

    await initSchemaAndSeed(legacyDb);
    const migrated = await getDailyLog("2026-11-19", legacyDb);
    assert.equal(migrated.entries.length, 1);
    assert.equal(migrated.entries[0].mealCategory, "Snack");
    assert.equal(await getDailyCalorieGoal(legacyDb), DEFAULT_DAILY_CALORIE_GOAL);
  });

  it("reads default daily calorie goal and persists updates", async () => {
    const db = await createDatabase(":memory:");
    assert.equal(await getDailyCalorieGoal(db), DEFAULT_DAILY_CALORIE_GOAL);

    const saved = await setDailyCalorieGoal(2350, db);
    assert.equal(saved, 2350);
    assert.equal(await getDailyCalorieGoal(db), 2350);
  });

  it("reads default user preferences and persists partial macro and unit updates", async () => {
    const db = await createDatabase(":memory:");
    assert.deepEqual(await getUserSettings(db), DEFAULT_USER_SETTINGS);

    const updated = await updateUserSettings(
      {
        dailyCalorieGoal: 2400,
        proteinGoal: 180,
        carbsGoal: 240,
        fatGoal: 75,
        energyUnit: "kj",
        macroUnit: "oz",
      },
      db
    );
    assert.deepEqual(updated, {
      dailyCalorieGoal: 2400,
      proteinGoal: 180,
      carbsGoal: 240,
      fatGoal: 75,
      energyUnit: "kj",
      macroUnit: "oz",
    });

    // Partial update must preserve untouched preferences
    const partial = await updateUserSettings({ energyUnit: "kcal" }, db);
    assert.equal(partial.energyUnit, "kcal");
    assert.equal(partial.macroUnit, "oz");
    assert.equal(partial.proteinGoal, 180);

    // 10,000 kcal 30/40/30 auto-split values (750g / 1000g / 333g) must persist cleanly
    const highGoal = await updateUserSettings(
      {
        dailyCalorieGoal: 10000,
        proteinGoal: 750,
        carbsGoal: 1000,
        fatGoal: 333,
      },
      db
    );
    assert.equal(highGoal.dailyCalorieGoal, 10000);
    assert.equal(highGoal.proteinGoal, 750);
    assert.equal(highGoal.carbsGoal, 1000);
    assert.equal(highGoal.fatGoal, 333);
  });

  it("aggregates multi-day history with zero-filled gaps and averages over logged days", async () => {
    const db = await createDatabase(":memory:");
    await addCustomFoodLogs(
      {
        loggedDate: "2026-11-20",
        mealCategory: "Lunch",
        items: [
          {
            name: "Chicken Bowl",
            servingSize: "1 bowl",
            calories: 600,
            protein: 45,
            carbs: 60,
            fat: 18,
          },
        ],
      },
      db
    );
    await addCustomFoodLogs(
      {
        loggedDate: "2026-11-22",
        mealCategory: "Dinner",
        items: [
          {
            name: "Salmon Plate",
            servingSize: "1 plate",
            calories: 800,
            protein: 55,
            carbs: 50,
            fat: 30,
          },
        ],
      },
      db
    );

    const history = await getDailyHistory("2026-11-20", "2026-11-22", db);
    assert.equal(history.days.length, 3);
    assert.equal(history.days[0].calories, 600);
    assert.equal(history.days[1].calories, 0);
    assert.equal(history.days[1].entryCount, 0);
    assert.equal(history.days[2].calories, 800);
    assert.equal(history.summary.daysLogged, 2);
    assert.equal(history.summary.averageCalories, 700);
    assert.equal(history.summary.averageProtein, 50);
    assert.equal(history.summary.totalEntries, 2);

    // Strict date validation rejects impossible calendar dates and reversed ranges
    assert.throws(() => enumerateDateRange("2026-02-30", "2026-03-02"), RangeError);
    assert.deepEqual(enumerateDateRange("2026-11-22", "2026-11-20"), []);
    await assert.rejects(
      () => getDailyHistory("2026-11-22", "2026-11-20", db),
      RangeError
    );
  });
});
