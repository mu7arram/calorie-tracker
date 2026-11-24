"use client";

import { useCallback, useEffect, useState } from "react";
import { AddFoodPanel } from "@/components/AddFoodPanel";
import { CalorieSummary } from "@/components/CalorieSummary";
import { DailyFoodLog } from "@/components/DailyFoodLog";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatHeaderDate, formatLocaleNumber } from "@/lib/i18n";
import type {
  CustomFoodLogItem,
  DailyLogResponse,
  FoodItem,
  MealCategory,
  UserSettings,
} from "@/types/food";

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultMealForHour(hour: number): MealCategory {
  if (hour >= 5 && hour <= 10) return "Breakfast";
  if (hour >= 11 && hour <= 15) return "Lunch";
  if (hour >= 16 && hour <= 20) return "Dinner";
  return "Snack";
}

const EMPTY_LOG: DailyLogResponse = {
  date: "",
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  entries: [],
};

export default function HomePage() {
  const { locale, t } = useLocale();
  const [todayDate, setTodayDate] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealCategory>("Lunch");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLogResponse>(EMPTY_LOG);
  const [dailyGoal, setDailyGoal] = useState<number>(2000);
  const [isLoading, setIsLoading] = useState(true);
  const [addingFoodId, setAddingFoodId] = useState<number | null>(null);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const loadInitialData = useCallback(
    async (localDate: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [foodsRes, logRes, settingsRes] = await Promise.all([
          fetch("/api/foods", { cache: "no-store" }),
          fetch(`/api/logs?date=${encodeURIComponent(localDate)}`, {
            cache: "no-store",
          }),
          fetch("/api/settings", { cache: "no-store" }),
        ]);

        if (!foodsRes.ok || !logRes.ok || !settingsRes.ok) {
          throw new Error(t.errors.loadFailed);
        }

        const foodsData = (await foodsRes.json()) as { foods: FoodItem[] };
        const logData = (await logRes.json()) as DailyLogResponse;
        const settingsData = (await settingsRes.json()) as UserSettings;

        setFoods(foodsData.foods);
        setDailyLog(logData);
        setDailyGoal(settingsData.dailyCalorieGoal);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : t.errors.loadFailed
        );
      } finally {
        setIsLoading(false);
      }
    },
    [t.errors.loadFailed]
  );

  useEffect(() => {
    const now = new Date();
    const localDate = getLocalDateString();
    setTodayDate(localDate);
    setSelectedMeal(getDefaultMealForHour(now.getHours()));
    void loadInitialData(localDate);
  }, [loadInitialData]);

  async function handleAddFood(foodId: number, servings: number) {
    if (!todayDate) return;
    setAddingFoodId(foodId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodId,
          servings,
          loggedDate: todayDate,
          mealCategory: selectedMeal,
        }),
      });

      const payload = (await res.json()) as DailyLogResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? t.errors.addFailed);
      }

      setDailyLog(payload);
      showStatus(t.toasts.addedSingle(t.meals[selectedMeal]));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.addFailed
      );
    } finally {
      setAddingFoodId(null);
    }
  }

  async function handleSaveAiItems(
    items: CustomFoodLogItem[]
  ): Promise<boolean> {
    if (!todayDate || items.length === 0) return false;
    setIsSavingAi(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          loggedDate: todayDate,
          mealCategory: selectedMeal,
        }),
      });

      const payload = (await res.json()) as DailyLogResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? t.errors.saveAiFailed);
      }

      setDailyLog(payload);
      const mealName = t.meals[selectedMeal];
      showStatus(
        items.length === 1
          ? t.toasts.addedSingle(mealName)
          : t.toasts.addedMultiple(items.length, mealName)
      );
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.saveAiFailed
      );
      return false;
    } finally {
      setIsSavingAi(false);
    }
  }

  async function handleDeleteEntry(id: number) {
    if (!todayDate) return;
    setDeletingId(id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/logs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? t.errors.deleteFailed);
      }

      const logRes = await fetch(
        `/api/logs?date=${encodeURIComponent(todayDate)}`,
        { cache: "no-store" }
      );
      if (!logRes.ok) {
        throw new Error(t.errors.refreshAfterDeleteFailed);
      }
      const updatedLog = (await logRes.json()) as DailyLogResponse;
      setDailyLog(updatedLog);
      showStatus(t.toasts.removedEntry);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.deleteFailed
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateGoal(nextGoal: number): Promise<boolean> {
    setIsSavingGoal(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyCalorieGoal: nextGoal }),
      });

      const payload = (await res.json()) as Partial<UserSettings> & {
        error?: string;
      };
      if (!res.ok || typeof payload.dailyCalorieGoal !== "number") {
        throw new Error(payload.error ?? t.errors.goalFailed);
      }

      setDailyGoal(payload.dailyCalorieGoal);
      showStatus(
        t.toasts.goalUpdated(formatLocaleNumber(payload.dailyCalorieGoal))
      );
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.goalFailed
      );
      return false;
    } finally {
      setIsSavingGoal(false);
    }
  }

  const formattedDate = formatHeaderDate(todayDate, locale);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="relative z-20 border-b border-border-subtle bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 3a9 9 0 1 0 9 9"
                    className="stroke-accent"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 7v5l3.5 2"
                    className="stroke-ink"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
                {t.appName}
              </h1>
            </div>

            {formattedDate ? (
              <time
                dateTime={todayDate}
                className="text-xs font-medium text-ink-secondary sm:hidden"
              >
                {formattedDate}
              </time>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            {statusMessage ? (
              <span
                role="status"
                aria-live="polite"
                className="rounded-lg border border-accent-soft-border bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-text"
              >
                {statusMessage}
              </span>
            ) : null}
            {formattedDate ? (
              <time
                dateTime={todayDate}
                className="hidden text-sm font-medium text-ink-secondary sm:block"
              >
                {formattedDate}
              </time>
            ) : null}
            <div className="ms-auto flex items-center gap-2 sm:ms-0">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {errorMessage ? (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-text"
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 text-xs font-medium text-error-text underline-offset-2 hover:underline"
            >
              {t.errors.dismiss}
            </button>
          </div>
        ) : null}

        <div className="space-y-8">
          <CalorieSummary
            totals={dailyLog.totals}
            entryCount={dailyLog.entries.length}
            dailyGoal={dailyGoal}
            isSavingGoal={isSavingGoal}
            onUpdateGoal={handleUpdateGoal}
          />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div
              data-vt="add-panel"
              className="min-w-0 lg:sticky lg:top-6 lg:col-span-5"
            >
              <AddFoodPanel
                foods={foods}
                isLoadingFoods={isLoading}
                addingFoodId={addingFoodId}
                isSavingAi={isSavingAi}
                selectedMeal={selectedMeal}
                onSelectMeal={setSelectedMeal}
                onAddFood={handleAddFood}
                onSaveAiItems={handleSaveAiItems}
              />
            </div>

            <div data-vt="food-log" className="min-w-0 lg:col-span-7">
              <DailyFoodLog
                entries={dailyLog.entries}
                isLoading={isLoading}
                deletingId={deletingId}
                activeMealCategory={selectedMeal}
                onSelectMealCategory={setSelectedMeal}
                onDeleteEntry={handleDeleteEntry}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
