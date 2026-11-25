"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AddFoodPanel } from "@/components/AddFoodPanel";
import { CalorieSummary } from "@/components/CalorieSummary";
import { DailyFoodLog } from "@/components/DailyFoodLog";
import { DateNavigator } from "@/components/DateNavigator";
import {
  HistoryCharts,
  type HistoryRangeDays,
} from "@/components/HistoryCharts";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLocale } from "@/components/LocaleProvider";
import { PreferencesModal } from "@/components/PreferencesModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  formatEnergyValue,
  formatHeaderDate,
  getEnergyUnitLabel,
} from "@/lib/i18n";
import { scaleMacrosToCalorieGoal } from "@/lib/macro-sync";
import type {
  CustomFoodLogItem,
  DailyHistoryResponse,
  DailyLogResponse,
  FoodItem,
  MealCategory,
  UserSettings,
  UserSettingsPatch,
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

const DEFAULT_SETTINGS: UserSettings = {
  dailyCalorieGoal: 2000,
  proteinGoal: 150,
  carbsGoal: 200,
  fatGoal: 65,
  energyUnit: "kcal",
  macroUnit: "g",
};

export default function HomePage() {
  const { locale, t } = useLocale();
  const [todayDate, setTodayDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMeal, setSelectedMeal] = useState<MealCategory>("Lunch");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLogResponse>(EMPTY_LOG);
  const [history, setHistory] = useState<DailyHistoryResponse | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRangeDays>(7);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [addingFoodId, setAddingFoodId] = useState<number | null>(null);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const logRequestSeqRef = useRef(0);
  const historyRequestSeqRef = useRef(0);

  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  const fetchHistory = useCallback(
    async (endDate: string, days: HistoryRangeDays) => {
      if (!endDate) return;
      const reqId = ++historyRequestSeqRef.current;
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const res = await fetch(
          `/api/logs/history?endDate=${encodeURIComponent(endDate)}&days=${days}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(t.history.loadFailed);
        }
        const data = (await res.json()) as DailyHistoryResponse;
        if (reqId !== historyRequestSeqRef.current) return;
        setHistory(data);
      } catch (error) {
        if (reqId !== historyRequestSeqRef.current) return;
        setHistoryError(
          error instanceof Error ? error.message : t.history.loadFailed
        );
      } finally {
        if (reqId === historyRequestSeqRef.current) {
          setIsLoadingHistory(false);
        }
      }
    },
    [t.history.loadFailed]
  );

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
        setSettings({ ...DEFAULT_SETTINGS, ...settingsData });
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
    setSelectedDate(localDate);
    setSelectedMeal(getDefaultMealForHour(now.getHours()));
    void loadInitialData(localDate);
    void fetchHistory(localDate, 7);
  }, [loadInitialData, fetchHistory]);

  async function handleSelectDate(nextDate: string) {
    if (!nextDate || nextDate === selectedDate) return;
    const reqId = ++logRequestSeqRef.current;
    setSelectedDate(nextDate);
    setIsLoadingLog(true);
    setErrorMessage(null);

    try {
      const logRes = await fetch(
        `/api/logs?date=${encodeURIComponent(nextDate)}`,
        { cache: "no-store" }
      );
      if (!logRes.ok) {
        throw new Error(t.errors.loadFailed);
      }
      const logData = (await logRes.json()) as DailyLogResponse;
      if (reqId !== logRequestSeqRef.current) return;
      setDailyLog(logData);
    } catch (error) {
      if (reqId !== logRequestSeqRef.current) return;
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.loadFailed
      );
    } finally {
      if (reqId === logRequestSeqRef.current) {
        setIsLoadingLog(false);
      }
    }
  }

  function handleChangeHistoryRange(days: HistoryRangeDays) {
    setHistoryRange(days);
    if (todayDate) {
      void fetchHistory(todayDate, days);
    }
  }

  async function handleAddFood(foodId: number, servings: number) {
    if (!selectedDate) return;
    setAddingFoodId(foodId);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodId,
          servings,
          loggedDate: selectedDate,
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
      if (todayDate) {
        void fetchHistory(todayDate, historyRange);
      }
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
    if (!selectedDate || items.length === 0) return false;
    setIsSavingAi(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          loggedDate: selectedDate,
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
      if (todayDate) {
        void fetchHistory(todayDate, historyRange);
      }
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
    if (!selectedDate) return;
    setDeletingId(id);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/logs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? t.errors.deleteFailed);
      }

      const logRes = await fetch(
        `/api/logs?date=${encodeURIComponent(selectedDate)}`,
        { cache: "no-store" }
      );
      if (!logRes.ok) {
        throw new Error(t.errors.refreshAfterDeleteFailed);
      }
      const updatedLog = (await logRes.json()) as DailyLogResponse;
      setDailyLog(updatedLog);
      if (todayDate) {
        void fetchHistory(todayDate, historyRange);
      }
      showStatus(t.toasts.removedEntry);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t.errors.deleteFailed
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpdateSettings(
    patch: UserSettingsPatch,
    toastKind: "goal" | "preferences" | "sync" = "preferences"
  ): Promise<boolean> {
    setIsSavingSettings(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const payload = (await res.json()) as Partial<UserSettings> & {
        error?: string;
      };
      if (!res.ok || typeof payload.dailyCalorieGoal !== "number") {
        throw new Error(
          payload.error ??
            (toastKind === "goal" ? t.errors.goalFailed : t.errors.preferencesFailed)
        );
      }

      const nextSettings: UserSettings = { ...DEFAULT_SETTINGS, ...payload };
      setSettings(nextSettings);
      if (toastKind === "goal") {
        showStatus(
          t.toasts.goalUpdated(
            formatEnergyValue(nextSettings.dailyCalorieGoal, nextSettings.energyUnit),
            getEnergyUnitLabel(locale, nextSettings.energyUnit)
          )
        );
      } else if (toastKind === "sync") {
        showStatus(t.toasts.macrosSynced);
      } else {
        showStatus(t.toasts.preferencesUpdated);
      }
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : toastKind === "goal"
            ? t.errors.goalFailed
            : t.errors.preferencesFailed
      );
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleUpdateGoal(nextGoal: number): Promise<boolean> {
    return handleUpdateSettings({ dailyCalorieGoal: nextGoal }, "goal");
  }

  async function handleSyncMacros(): Promise<boolean> {
    const scaled = scaleMacrosToCalorieGoal(settings.dailyCalorieGoal, {
      proteinGoal: settings.proteinGoal,
      carbsGoal: settings.carbsGoal,
      fatGoal: settings.fatGoal,
    });
    return handleUpdateSettings(scaled, "sync");
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
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(true)}
                aria-label={t.preferences.buttonLabel}
                title={t.preferences.buttonLabel}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-2.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" x2="4" y1="21" y2="14" />
                  <line x1="4" x2="4" y1="10" y2="3" />
                  <line x1="12" x2="12" y1="21" y2="12" />
                  <line x1="12" x2="12" y1="8" y2="3" />
                  <line x1="20" x2="20" y1="21" y2="16" />
                  <line x1="20" x2="20" y1="12" y2="3" />
                  <line x1="2" x2="6" y1="14" y2="14" />
                  <line x1="10" x2="14" y1="8" y2="8" />
                  <line x1="18" x2="22" y1="16" y2="16" />
                </svg>
                <span className="hidden md:inline">
                  {t.preferences.buttonLabel}
                </span>
              </button>
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
          <DateNavigator
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelectDate={(date) => void handleSelectDate(date)}
          />

          <CalorieSummary
            totals={dailyLog.totals}
            entryCount={dailyLog.entries.length}
            settings={settings}
            isSavingGoal={isSavingSettings}
            onUpdateGoal={handleUpdateGoal}
            onSyncMacros={handleSyncMacros}
            onOpenPreferences={() => setIsPreferencesOpen(true)}
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
                energyUnit={settings.energyUnit}
                macroUnit={settings.macroUnit}
                onSelectMeal={setSelectedMeal}
                onAddFood={handleAddFood}
                onSaveAiItems={handleSaveAiItems}
              />
            </div>

            <div data-vt="food-log" className="min-w-0 lg:col-span-7">
              <DailyFoodLog
                entries={dailyLog.entries}
                isLoading={isLoading || isLoadingLog}
                deletingId={deletingId}
                activeMealCategory={selectedMeal}
                selectedDate={selectedDate}
                todayDate={todayDate}
                energyUnit={settings.energyUnit}
                macroUnit={settings.macroUnit}
                onSelectMealCategory={setSelectedMeal}
                onDeleteEntry={handleDeleteEntry}
              />
            </div>
          </div>

          <HistoryCharts
            history={history}
            rangeDays={historyRange}
            isLoading={isLoadingHistory}
            error={historyError}
            selectedDate={selectedDate}
            settings={settings}
            onChangeRange={handleChangeHistoryRange}
            onSelectDate={(date) => void handleSelectDate(date)}
          />
        </div>
      </main>

      <PreferencesModal
        open={isPreferencesOpen}
        settings={settings}
        isSaving={isSavingSettings}
        onClose={() => setIsPreferencesOpen(false)}
        onSave={(patch) => handleUpdateSettings(patch, "preferences")}
      />
    </div>
  );
}
