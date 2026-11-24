export const MEAL_CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export interface UserSettings {
  dailyCalorieGoal: number;
}

export interface FoodItem {
  id: number;
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodLogEntry {
  id: number;
  foodId: number | null;
  foodName: string;
  servingSize: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCategory: MealCategory;
  loggedDate: string; // YYYY-MM-DD (client local date)
  createdAt: string;
}

export interface DailyTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyLogResponse {
  date: string;
  totals: DailyTotals;
  entries: FoodLogEntry[];
}

export interface CreateLogInput {
  foodId: number;
  servings: number;
  loggedDate: string;
  mealCategory?: MealCategory;
}

export interface NutritionEstimateItem {
  name: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionLookupResponse {
  summary: string;
  totals: DailyTotals;
  items: NutritionEstimateItem[];
  model: string;
}

export interface CustomFoodLogItem {
  name: string;
  servingSize: string;
  servings?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CreateCustomLogsInput {
  items: CustomFoodLogItem[];
  loggedDate: string;
  mealCategory?: MealCategory;
}
