"use client";

import { useLocale } from "@/components/LocaleProvider";
import {
  formatEnergy,
  formatMacroAmount,
  localizeLoggedFood,
} from "@/lib/i18n";
import {
  MEAL_CATEGORIES,
  type EnergyUnit,
  type FoodLogEntry,
  type MacroUnit,
  type MealCategory,
} from "@/types/food";

interface DailyFoodLogProps {
  entries: FoodLogEntry[];
  isLoading: boolean;
  deletingId: number | null;
  activeMealCategory: MealCategory;
  energyUnit?: EnergyUnit;
  macroUnit?: MacroUnit;
  onSelectMealCategory: (category: MealCategory) => void;
  onDeleteEntry: (id: number) => Promise<void>;
}

function formatServing(
  servings: number,
  servingSize: string
): string {
  if (servings === 1) {
    return servingSize;
  }
  return `${servings} × ${servingSize}`;
}

export function DailyFoodLog({
  entries,
  isLoading,
  deletingId,
  activeMealCategory,
  energyUnit = "kcal",
  macroUnit = "g",
  onSelectMealCategory,
  onDeleteEntry,
}: DailyFoodLogProps) {
  const { locale, t } = useLocale();

  const grouped = new Map<MealCategory, FoodLogEntry[]>();
  for (const category of MEAL_CATEGORIES) {
    grouped.set(category, []);
  }
  for (const entry of entries) {
    const bucket = grouped.get(entry.mealCategory) ?? grouped.get("Snack")!;
    bucket.push(entry);
  }

  return (
    <section aria-label={t.foodLog.sectionLabel} className="min-w-0 space-y-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            {t.foodLog.title}
          </h2>
          <p className="text-sm text-ink-secondary">{t.foodLog.subtitle}</p>
        </div>
        {!isLoading && entries.length > 0 ? (
          <span className="text-xs font-medium text-ink-secondary tabular-nums">
            {t.foodLog.entryCount(entries.length)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-label={t.foodLog.loadingLabel}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-xl border border-border-subtle bg-surface"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center sm:p-8">
          <h3 className="font-display text-lg font-semibold text-ink">
            {t.foodLog.emptyTitle}
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-secondary">
            {t.foodLog.emptySubtitle}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {MEAL_CATEGORIES.map((category) => {
              const isSelected = activeMealCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onSelectMealCategory(category)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "border-accent-soft-border bg-accent-soft text-accent-soft-text"
                      : "border-border-subtle bg-elevated text-ink-secondary hover:border-border-strong hover:text-ink"
                  }`}
                >
                  {t.foodLog.logMeal(t.meals[category])}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {MEAL_CATEGORIES.map((category) => {
            const mealEntries = grouped.get(category) ?? [];
            const mealCalories =
              Math.round(
                mealEntries.reduce((sum, item) => sum + item.calories, 0) * 10
              ) / 10;
            const isSelectedMeal = activeMealCategory === category;
            const mealLabel = t.meals[category];

            return (
              <div key={category} className="space-y-2.5">
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-ink">
                      {mealLabel}
                    </h3>
                    {mealEntries.length > 0 ? (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs font-medium text-ink-secondary tabular-nums">
                        {mealEntries.length}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium text-ink-secondary tabular-nums">
                    {formatEnergy(mealCalories, locale, energyUnit)}
                  </span>
                </div>

                {mealEntries.length === 0 ? (
                  <div className="flex items-center justify-between rounded-xl border border-dashed border-border-subtle bg-surface px-4 py-3">
                    <span className="text-xs text-ink-muted">
                      {t.foodLog.emptyMealRow(mealLabel)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectMealCategory(category)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelectedMeal
                          ? "bg-accent-soft text-accent-soft-text"
                          : "text-ink-secondary hover:bg-elevated hover:text-ink"
                      }`}
                    >
                      {isSelectedMeal
                        ? t.foodLog.selectedMeal
                        : t.foodLog.addToMeal(mealLabel)}
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {mealEntries.map((entry) => {
                      const isDeleting = deletingId === entry.id;
                      const localized = localizeLoggedFood(
                        entry.foodName,
                        entry.servingSize,
                        entry.foodId,
                        locale
                      );

                      return (
                        <li
                          key={entry.id}
                          className="rounded-xl border border-border-subtle bg-surface p-4 transition-colors hover:border-border-strong"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">
                                  {localized.name}
                                </p>
                                {entry.foodId === null ? (
                                  <span className="rounded-md border border-accent-soft-border bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-soft-text">
                                    {t.foodLog.aiEstimate}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-ink-secondary">
                                {formatServing(
                                  entry.servings,
                                  localized.servingSize
                                )}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                              <span className="font-display text-base font-semibold text-ink tabular-nums">
                                {formatEnergy(entry.calories, locale, energyUnit)}
                              </span>
                              <button
                                type="button"
                                aria-label={t.foodLog.removeAria(localized.name)}
                                disabled={deletingId !== null}
                                onClick={() => void onDeleteEntry(entry.id)}
                                className="rounded-lg border border-border-subtle bg-elevated px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-error-border hover:bg-error-bg hover:text-error-text disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isDeleting
                                  ? t.foodLog.removing
                                  : t.foodLog.remove}
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-ink-secondary tabular-nums">
                              <span className="font-medium text-macro-protein">
                                {t.macros.proteinShort}
                              </span>{" "}
                              {formatMacroAmount(entry.protein, locale, macroUnit)}
                            </span>
                            <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-ink-secondary tabular-nums">
                              <span className="font-medium text-macro-carbs">
                                {t.macros.carbsShort}
                              </span>{" "}
                              {formatMacroAmount(entry.carbs, locale, macroUnit)}
                            </span>
                            <span className="rounded-md bg-elevated px-2 py-0.5 text-xs text-ink-secondary tabular-nums">
                              <span className="font-medium text-macro-fat">
                                {t.macros.fatShort}
                              </span>{" "}
                              {formatMacroAmount(entry.fat, locale, macroUnit)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
