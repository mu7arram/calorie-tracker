import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InStatement, type Row } from "@libsql/client";
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
  var __calorieTrackerDb: Client | undefined;
  var __calorieTrackerDbInit: Promise<void> | undefined;
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

function normalizeDbUrl(dbPathOrUrl: string): string {
  if (dbPathOrUrl === ":memory:") {
    return ":memory:";
  }

  if (/^(libsql|https?|wss?):\/\//i.test(dbPathOrUrl)) {
    return dbPathOrUrl;
  }

  if (dbPathOrUrl.startsWith("file:")) {
    const filePath = dbPathOrUrl.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    return dbPathOrUrl;
  }

  fs.mkdirSync(path.dirname(dbPathOrUrl), { recursive: true });
  return `file:${dbPathOrUrl}`;
}

function mapFoodRow(row: Row): FoodItem {
  return {
    id: Number(row.id),
    name: String(row.name),
    servingSize: String(row.servingSize),
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
  };
}

function mapFoodLogRow(row: Row): FoodLogEntry {
  const rawCategory = String(row.mealCategory);
  return {
    id: Number(row.id),
    foodId: row.foodId === null || row.foodId === undefined ? null : Number(row.foodId),
    foodName: String(row.foodName),
    servingSize: String(row.servingSize),
    servings: Number(row.servings),
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    mealCategory: isValidMealCategory(rawCategory) ? rawCategory : "Snack",
    loggedDate: String(row.loggedDate),
    createdAt: String(row.createdAt),
  };
}

export async function initSchemaAndSeed(db: Client): Promise<void> {
  await db.execute("PRAGMA foreign_keys = ON;");

  await db.executeMultiple(`
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
  const columnsResult = await db.execute("PRAGMA table_info(food_logs)");
  const hasMealCategory = columnsResult.rows.some(
    (col) => String(col.name) === "meal_category"
  );
  if (!hasMealCategory) {
    await db.execute(
      "ALTER TABLE food_logs ADD COLUMN meal_category TEXT NOT NULL DEFAULT 'Snack';"
    );
  }

  await db.execute({
    sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
    args: [DAILY_CALORIE_GOAL_KEY, String(DEFAULT_DAILY_CALORIE_GOAL)],
  });

  const countResult = await db.execute("SELECT COUNT(*) AS count FROM foods");
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count === 0) {
    const statements: InStatement[] = SEED_FOODS.map((food) => ({
      sql: `INSERT OR IGNORE INTO foods (name, serving_size, calories, protein, carbs, fat)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        food.name,
        food.servingSize,
        food.calories,
        food.protein,
        food.carbs,
        food.fat,
      ],
    }));
    await db.batch(statements, "write");
  }
}

export async function createDatabase(
  dbPathOrUrl: string,
  authToken?: string
): Promise<Client> {
  const url = normalizeDbUrl(dbPathOrUrl);
  const client = createClient(authToken ? { url, authToken } : { url });
  await initSchemaAndSeed(client);
  return client;
}

export async function getDb(): Promise<Client> {
  if (!globalThis.__calorieTrackerDb) {
    const configuredUrl =
      process.env.TURSO_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim();
    const defaultLocalPath = path.join(process.cwd(), "data", "calorie-tracker.db");
    const url = normalizeDbUrl(configuredUrl || defaultLocalPath);
    const authToken =
      process.env.TURSO_AUTH_TOKEN?.trim() ||
      process.env.DATABASE_AUTH_TOKEN?.trim();

    globalThis.__calorieTrackerDb = createClient(
      authToken ? { url, authToken } : { url }
    );
  }

  if (!globalThis.__calorieTrackerDbInit) {
    const client = globalThis.__calorieTrackerDb;
    globalThis.__calorieTrackerDbInit = initSchemaAndSeed(client).catch(
      (error) => {
        globalThis.__calorieTrackerDbInit = undefined;
        throw error;
      }
    );
  }

  await globalThis.__calorieTrackerDbInit;
  return globalThis.__calorieTrackerDb;
}

export async function listFoods(db?: Client): Promise<FoodItem[]> {
  const client = db ?? (await getDb());
  const result = await client.execute(
    `SELECT id, name, serving_size AS servingSize, calories, protein, carbs, fat
     FROM foods
     ORDER BY id ASC`
  );

  return result.rows.map(mapFoodRow);
}

export async function getDailyCalorieGoal(db?: Client): Promise<number> {
  const client = db ?? (await getDb());
  const result = await client.execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: [DAILY_CALORIE_GOAL_KEY],
  });

  const row = result.rows[0];
  if (!row) {
    return DEFAULT_DAILY_CALORIE_GOAL;
  }

  const parsed = Number(row.value);
  return Number.isInteger(parsed) && parsed >= 500 && parsed <= 10000
    ? parsed
    : DEFAULT_DAILY_CALORIE_GOAL;
}

export async function setDailyCalorieGoal(
  goal: number,
  db?: Client
): Promise<number> {
  const client = db ?? (await getDb());
  await client.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [DAILY_CALORIE_GOAL_KEY, String(goal)],
  });

  return goal;
}

export async function getDailyLog(
  loggedDate: string,
  db?: Client
): Promise<DailyLogResponse> {
  const client = db ?? (await getDb());

  const [entriesResult, totalsResult] = await Promise.all([
    client.execute({
      sql: `SELECT
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
            ORDER BY id DESC`,
      args: [loggedDate],
    }),
    client.execute({
      sql: `SELECT
              ROUND(COALESCE(SUM(calories), 0), 1) AS calories,
              ROUND(COALESCE(SUM(protein), 0), 1) AS protein,
              ROUND(COALESCE(SUM(carbs), 0), 1) AS carbs,
              ROUND(COALESCE(SUM(fat), 0), 1) AS fat
            FROM food_logs
            WHERE logged_date = ?`,
      args: [loggedDate],
    }),
  ]);

  const totalsRow = totalsResult.rows[0];
  const totals = {
    calories: Number(totalsRow?.calories ?? 0),
    protein: Number(totalsRow?.protein ?? 0),
    carbs: Number(totalsRow?.carbs ?? 0),
    fat: Number(totalsRow?.fat ?? 0),
  };

  return {
    date: loggedDate,
    totals,
    entries: entriesResult.rows.map(mapFoodLogRow),
  };
}

export async function addFoodLog(
  params: {
    foodId: number;
    servings: number;
    loggedDate: string;
    mealCategory?: MealCategory;
  },
  db?: Client
): Promise<DailyLogResponse | null> {
  const client = db ?? (await getDb());
  const foodResult = await client.execute({
    sql: `SELECT id, name, serving_size AS servingSize, calories, protein, carbs, fat
          FROM foods
          WHERE id = ?`,
    args: [params.foodId],
  });

  const foodRow = foodResult.rows[0];
  if (!foodRow) {
    return null;
  }

  const food = mapFoodRow(foodRow);
  const mealCategory: MealCategory = params.mealCategory ?? "Snack";
  const scaledCalories = round1(food.calories * params.servings);
  const scaledProtein = round1(food.protein * params.servings);
  const scaledCarbs = round1(food.carbs * params.servings);
  const scaledFat = round1(food.fat * params.servings);
  const createdAt = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO food_logs
            (food_id, food_name, serving_size, servings, calories, protein, carbs, fat, meal_category, logged_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
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
      createdAt,
    ],
  });

  return getDailyLog(params.loggedDate, client);
}

export async function addCustomFoodLogs(
  params: {
    items: CustomFoodLogItem[];
    loggedDate: string;
    mealCategory?: MealCategory;
  },
  db?: Client
): Promise<DailyLogResponse> {
  const client = db ?? (await getDb());
  const mealCategory: MealCategory = params.mealCategory ?? "Snack";
  const createdAt = new Date().toISOString();

  const statements: InStatement[] = params.items.map((item) => {
    const servings = item.servings ?? 1;
    return {
      sql: `INSERT INTO food_logs
              (food_id, food_name, serving_size, servings, calories, protein, carbs, fat, meal_category, logged_date, created_at)
            VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.name.trim(),
        item.servingSize.trim(),
        servings,
        round1(item.calories * servings),
        round1(item.protein * servings),
        round1(item.carbs * servings),
        round1(item.fat * servings),
        mealCategory,
        params.loggedDate,
        createdAt,
      ],
    };
  });

  await client.batch(statements, "write");

  return getDailyLog(params.loggedDate, client);
}

export async function deleteFoodLog(
  id: number,
  db?: Client
): Promise<boolean> {
  const client = db ?? (await getDb());
  const result = await client.execute({
    sql: "DELETE FROM food_logs WHERE id = ?",
    args: [id],
  });
  return result.rowsAffected > 0;
}
