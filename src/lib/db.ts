import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InStatement, type Row } from "@libsql/client";
import { SEED_FOODS } from "@/lib/seed-foods";
import {
  ENERGY_UNITS,
  MACRO_UNITS,
  MEAL_CATEGORIES,
  type CustomFoodLogItem,
  type DailyHistoryPoint,
  type DailyHistoryResponse,
  type DailyLogResponse,
  type EnergyUnit,
  type FoodItem,
  type FoodLogEntry,
  type MacroUnit,
  type MealCategory,
  type UserSettings,
  type UserSettingsPatch,
} from "@/types/food";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_DAILY_CALORIE_GOAL = 2000;
export const DEFAULT_PROTEIN_GOAL = 150;
export const DEFAULT_CARBS_GOAL = 200;
export const DEFAULT_FAT_GOAL = 65;
export const DEFAULT_ENERGY_UNIT: EnergyUnit = "kcal";
export const DEFAULT_MACRO_UNIT: MacroUnit = "g";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  dailyCalorieGoal: DEFAULT_DAILY_CALORIE_GOAL,
  proteinGoal: DEFAULT_PROTEIN_GOAL,
  carbsGoal: DEFAULT_CARBS_GOAL,
  fatGoal: DEFAULT_FAT_GOAL,
  energyUnit: DEFAULT_ENERGY_UNIT,
  macroUnit: DEFAULT_MACRO_UNIT,
};

const DAILY_CALORIE_GOAL_KEY = "daily_calorie_goal";
const PROTEIN_GOAL_KEY = "protein_goal_g";
const CARBS_GOAL_KEY = "carbs_goal_g";
const FAT_GOAL_KEY = "fat_goal_g";
const ENERGY_UNIT_KEY = "energy_unit";
const MACRO_UNIT_KEY = "macro_unit";

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

export function isValidEnergyUnit(value: unknown): value is EnergyUnit {
  return (
    typeof value === "string" &&
    (ENERGY_UNITS as readonly string[]).includes(value)
  );
}

export function isValidMacroUnit(value: unknown): value is MacroUnit {
  return (
    typeof value === "string" &&
    (MACRO_UNITS as readonly string[]).includes(value)
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

  await db.batch(
    [
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [DAILY_CALORIE_GOAL_KEY, String(DEFAULT_DAILY_CALORIE_GOAL)],
      },
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [PROTEIN_GOAL_KEY, String(DEFAULT_PROTEIN_GOAL)],
      },
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [CARBS_GOAL_KEY, String(DEFAULT_CARBS_GOAL)],
      },
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [FAT_GOAL_KEY, String(DEFAULT_FAT_GOAL)],
      },
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [ENERGY_UNIT_KEY, DEFAULT_ENERGY_UNIT],
      },
      {
        sql: "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
        args: [MACRO_UNIT_KEY, DEFAULT_MACRO_UNIT],
      },
    ],
    "write"
  );

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

function parseBoundedInt(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

export async function getUserSettings(db?: Client): Promise<UserSettings> {
  const client = db ?? (await getDb());
  const result = await client.execute(
    "SELECT key, value FROM settings"
  );

  const map = new Map<string, string>();
  for (const row of result.rows) {
    map.set(String(row.key), String(row.value));
  }

  const rawEnergyUnit = map.get(ENERGY_UNIT_KEY);
  const rawMacroUnit = map.get(MACRO_UNIT_KEY);

  return {
    dailyCalorieGoal: parseBoundedInt(
      map.get(DAILY_CALORIE_GOAL_KEY),
      500,
      10000,
      DEFAULT_DAILY_CALORIE_GOAL
    ),
    proteinGoal: parseBoundedInt(
      map.get(PROTEIN_GOAL_KEY),
      10,
      800,
      DEFAULT_PROTEIN_GOAL
    ),
    carbsGoal: parseBoundedInt(
      map.get(CARBS_GOAL_KEY),
      0,
      1500,
      DEFAULT_CARBS_GOAL
    ),
    fatGoal: parseBoundedInt(
      map.get(FAT_GOAL_KEY),
      10,
      400,
      DEFAULT_FAT_GOAL
    ),
    energyUnit: isValidEnergyUnit(rawEnergyUnit)
      ? rawEnergyUnit
      : DEFAULT_ENERGY_UNIT,
    macroUnit: isValidMacroUnit(rawMacroUnit)
      ? rawMacroUnit
      : DEFAULT_MACRO_UNIT,
  };
}

export async function updateUserSettings(
  patch: UserSettingsPatch,
  db?: Client
): Promise<UserSettings> {
  const client = db ?? (await getDb());
  const statements: InStatement[] = [];

  const upsertSql = `INSERT INTO settings (key, value) VALUES (?, ?)
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value`;

  if (patch.dailyCalorieGoal !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [DAILY_CALORIE_GOAL_KEY, String(patch.dailyCalorieGoal)],
    });
  }
  if (patch.proteinGoal !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [PROTEIN_GOAL_KEY, String(patch.proteinGoal)],
    });
  }
  if (patch.carbsGoal !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [CARBS_GOAL_KEY, String(patch.carbsGoal)],
    });
  }
  if (patch.fatGoal !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [FAT_GOAL_KEY, String(patch.fatGoal)],
    });
  }
  if (patch.energyUnit !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [ENERGY_UNIT_KEY, patch.energyUnit],
    });
  }
  if (patch.macroUnit !== undefined) {
    statements.push({
      sql: upsertSql,
      args: [MACRO_UNIT_KEY, patch.macroUnit],
    });
  }

  if (statements.length > 0) {
    await client.batch(statements, "write");
  }

  return getUserSettings(client);
}

export async function getDailyCalorieGoal(db?: Client): Promise<number> {
  const settings = await getUserSettings(db);
  return settings.dailyCalorieGoal;
}

export async function setDailyCalorieGoal(
  goal: number,
  db?: Client
): Promise<number> {
  const updated = await updateUserSettings({ dailyCalorieGoal: goal }, db);
  return updated.dailyCalorieGoal;
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

export function enumerateDateRange(fromDate: string, toDate: string): string[] {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const startMs = Date.UTC(fy, fm - 1, fd);
  const endMs = Date.UTC(ty, tm - 1, td);
  if (startMs > endMs) return [];

  const dates: string[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  for (let ms = startMs; ms <= endMs; ms += dayMs) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export async function getDailyHistory(
  fromDate: string,
  toDate: string,
  db?: Client
): Promise<DailyHistoryResponse> {
  const client = db ?? (await getDb());
  const result = await client.execute({
    sql: `SELECT
            logged_date AS loggedDate,
            ROUND(COALESCE(SUM(calories), 0), 1) AS calories,
            ROUND(COALESCE(SUM(protein), 0), 1) AS protein,
            ROUND(COALESCE(SUM(carbs), 0), 1) AS carbs,
            ROUND(COALESCE(SUM(fat), 0), 1) AS fat,
            COUNT(*) AS entryCount
          FROM food_logs
          WHERE logged_date >= ? AND logged_date <= ?
          GROUP BY logged_date
          ORDER BY logged_date ASC`,
    args: [fromDate, toDate],
  });

  const byDate = new Map<string, DailyHistoryPoint>();
  for (const row of result.rows) {
    const date = String(row.loggedDate);
    byDate.set(date, {
      date,
      calories: Number(row.calories ?? 0),
      protein: Number(row.protein ?? 0),
      carbs: Number(row.carbs ?? 0),
      fat: Number(row.fat ?? 0),
      entryCount: Number(row.entryCount ?? 0),
    });
  }

  const allDates = enumerateDateRange(fromDate, toDate);
  const days: DailyHistoryPoint[] = allDates.map(
    (date) =>
      byDate.get(date) ?? {
        date,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        entryCount: 0,
      }
  );

  let daysLogged = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalEntries = 0;

  for (const day of days) {
    if (day.entryCount > 0) {
      daysLogged += 1;
      totalCalories += day.calories;
      totalProtein += day.protein;
      totalCarbs += day.carbs;
      totalFat += day.fat;
      totalEntries += day.entryCount;
    }
  }

  return {
    from: fromDate,
    to: toDate,
    days,
    summary: {
      daysLogged,
      averageCalories: daysLogged > 0 ? round1(totalCalories / daysLogged) : 0,
      averageProtein: daysLogged > 0 ? round1(totalProtein / daysLogged) : 0,
      averageCarbs: daysLogged > 0 ? round1(totalCarbs / daysLogged) : 0,
      averageFat: daysLogged > 0 ? round1(totalFat / daysLogged) : 0,
      totalEntries,
    },
  };
}
