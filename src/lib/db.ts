import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SEED_FOODS } from "@/lib/seed-foods";
import {
  MEAL_CATEGORIES,
  type CustomFoodLogItem,
  type DailyLogResponse,
  type FoodItem,
  type FoodLogEntry,
  type MealCategory,
} from "@/types/food";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_DAILY_CALORIE_GOAL = 2000;
const DAILY_CALORIE_GOAL_KEY = "daily_calorie_goal";

declare global {
  var __calorieTrackerDb: DatabaseSync | undefined;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isValidMealCategory(value: unknown): value is MealCategory {
  return (
    typeof value === "string" &&
    (MEAL_CATEGORIES as readonly string[]).includes(value)
  );
}

export function initSchemaAndSeed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      serving_size TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
      food_name TEXT NOT NULL,
      serving_size TEXT NOT NULL,
      servings REAL NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      meal_category TEXT NOT NULL DEFAULT 'Snack',
      logged_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_food_logs_date ON food_logs (logged_date);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe migration for pre-existing food_logs tables missing meal_category
  const columns = db
    .prepare("PRAGMA table_info(food_logs)")
    .all() as Array<{ name: string }>;
  const hasMealCategory = columns.some((col) => col.name === "meal_category");
  if (!hasMealCategory) {
    db.exec(
      "ALTER TABLE food_logs ADD COLUMN meal_category TEXT NOT NULL DEFAULT 'Snack';"
    );
  }

  db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  ).run(DAILY_CALORIE_GOAL_KEY, String(DEFAULT_DAILY_CALORIE_GOAL));

  const countRow = db.prepare("SELECT COUNT(*) AS count FROM foods").get() as {
    count: number;
  };

  if (countRow.count === 0) {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO foods (name, serving_size, calories, protein, carbs, fat)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN IMMEDIATE");
    try {
      for (const food of SEED_FOODS) {
        insertStmt.run(
          food.name,
          food.servingSize,
          food.calories,
          food.protein,
          food.carbs,
          food.fat
        );
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

export function createDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");
  initSchemaAndSeed(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__calorieTrackerDb) {
    const dbPath = path.join(process.cwd(), "data", "calorie-tracker.db");
    globalThis.__calorieTrackerDb = createDatabase(dbPath);
  }
  return globalThis.__calorieTrackerDb;
}

export function listFoods(db: DatabaseSync = getDb()): FoodItem[] {
  const rows = db
    .prepare(
      `SELECT id, name, serving_size AS servingSize, calories, protein, carbs, fat
       FROM foods
       ORDER BY id ASC`
    )
    .all();

  return rows as unknown as FoodItem[];
}

export function getDailyCalorieGoal(db: DatabaseSync = getDb()): number {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(DAILY_CALORIE_GOAL_KEY) as { value: string } | undefined;

  if (!row) {
    return DEFAULT_DAILY_CALORIE_GOAL;
  }

  const parsed = Number(row.value);
  return Number.isInteger(parsed) && parsed >= 500 && parsed <= 10000
    ? parsed
    : DEFAULT_DAILY_CALORIE_GOAL;
}

export function setDailyCalorieGoal(
  goal: number,
  db: DatabaseSync = getDb()
): number {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(DAILY_CALORIE_GOAL_KEY, String(goal));

  return goal;
}

export function getDailyLog(
  loggedDate: string,
  db: DatabaseSync = getDb()
): DailyLogResponse {
  const entries = db
    .prepare(
      `SELECT
         id,
         food_id AS foodId,
         food_name AS foodName,
         serving_size AS servingSize,
         servings,
         calories,
         protein,
         carbs,
         fat,
         meal_category AS mealCategory,
         logged_date AS loggedDate,
         created_at AS createdAt
       FROM food_logs
       WHERE logged_date = ?
       ORDER BY id DESC`
    )
    .all(loggedDate) as unknown as FoodLogEntry[];

  const totals = db
    .prepare(
      `SELECT
         ROUND(COALESCE(SUM(calories), 0), 1) AS calories,
         ROUND(COALESCE(SUM(protein), 0), 1) AS protein,
         ROUND(COALESCE(SUM(carbs), 0), 1) AS carbs,
         ROUND(COALESCE(SUM(fat), 0), 1) AS fat
       FROM food_logs
       WHERE logged_date = ?`
    )
    .get(loggedDate) as {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  return {
    date: loggedDate,
    totals,
    entries,
  };
}

export function addFoodLog(
  params: {
    foodId: number;
    servings: number;
    loggedDate: string;
    mealCategory?: MealCategory;
  },
  db: DatabaseSync = getDb()
): DailyLogResponse | null {
  const food = db
    .prepare(
      `SELECT id, name, serving_size AS servingSize, calories, protein, carbs, fat
       FROM foods
       WHERE id = ?`
    )
    .get(params.foodId) as FoodItem | undefined;

  if (!food) {
    return null;
  }

  const mealCategory: MealCategory = params.mealCategory ?? "Snack";
  const scaledCalories = round1(food.calories * params.servings);
  const scaledProtein = round1(food.protein * params.servings);
  const scaledCarbs = round1(food.carbs * params.servings);
  const scaledFat = round1(food.fat * params.servings);
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO food_logs
       (food_id, food_name, serving_size, servings, calories, protein, carbs, fat, meal_category, logged_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    food.id,
    food.name,
    food.servingSize,
    params.servings,
    scaledCalories,
    scaledProtein,
    scaledCarbs,
    scaledFat,
    mealCategory,
    params.loggedDate,
    createdAt
  );

  return getDailyLog(params.loggedDate, db);
}

export function addCustomFoodLogs(
  params: {
    items: CustomFoodLogItem[];
    loggedDate: string;
    mealCategory?: MealCategory;
  },
  db: DatabaseSync = getDb()
): DailyLogResponse {
  const mealCategory: MealCategory = params.mealCategory ?? "Snack";
  const insertStmt = db.prepare(
    `INSERT INTO food_logs
       (food_id, food_name, serving_size, servings, calories, protein, carbs, fat, meal_category, logged_date, created_at)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const createdAt = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const item of params.items) {
      const servings = item.servings ?? 1;
      insertStmt.run(
        item.name.trim(),
        item.servingSize.trim(),
        servings,
        round1(item.calories * servings),
        round1(item.protein * servings),
        round1(item.carbs * servings),
        round1(item.fat * servings),
        mealCategory,
        params.loggedDate,
        createdAt
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return getDailyLog(params.loggedDate, db);
}

export function deleteFoodLog(
  id: number,
  db: DatabaseSync = getDb()
): boolean {
  const result = db.prepare("DELETE FROM food_logs WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}
