"use client";

import { useId, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import {
  formatEnergy,
  formatMacroAmount,
  localizeFoodItem,
  matchesFoodSearch,
} from "@/lib/i18n";
import type {
  EnergyUnit,
  FoodItem,
  MacroUnit,
  MealCategory,
} from "@/types/food";

interface FoodSearchCatalogProps {
  foods: FoodItem[];
  isLoading: boolean;
  addingFoodId: number | null;
  selectedMeal?: MealCategory;
  energyUnit?: EnergyUnit;
  macroUnit?: MacroUnit;
  onAddFood: (foodId: number, servings: number) => Promise<void>;
  embedded?: boolean;
}

const SERVING_OPTIONS = [0.5, 1, 1.5, 2, 3];

export function FoodSearchCatalog({
  foods,
  isLoading,
  addingFoodId,
  selectedMeal,
  energyUnit = "kcal",
  macroUnit = "g",
  onAddFood,
  embedded = false,
}: FoodSearchCatalogProps) {
  const { locale, t } = useLocale();
  const searchInputId = useId();
  const [query, setQuery] = useState("");
  const [servingsByFood, setServingsByFood] = useState<Record<number, number>>(
    {}
  );

  const filteredFoods = foods.filter((food) =>
    matchesFoodSearch(food, query, locale)
  );

  function getServings(foodId: number): number {
    return servingsByFood[foodId] ?? 1;
  }

  const localizedMeal = selectedMeal ? t.meals[selectedMeal] : undefined;

  const content = (
    <>
      <div className="mb-3.5">
        <label
          htmlFor={searchInputId}
          className="mb-1.5 block text-xs font-medium text-ink-secondary"
        >
          {t.catalog.searchLabel}
        </label>
        <input
          id={searchInputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.catalog.searchPlaceholder}
          className="w-full rounded-xl border border-border-subtle bg-input px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2 py-2">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-16 animate-pulse rounded-xl bg-elevated"
            />
          ))}
        </div>
      ) : filteredFoods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-canvas px-4 py-8 text-center">
          <p className="text-sm text-ink-secondary">
            {t.catalog.noMatch(query)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {t.catalog.noMatchHint}
          </p>
        </div>
      ) : (
        <ul className="themed-scroll max-h-[430px] divide-y divide-border-subtle overflow-y-auto pe-1">
          {filteredFoods.map((food) => {
            const servings = getServings(food.id);
            const isAdding = addingFoodId === food.id;
            const localized = localizeFoodItem(food, locale);

            return (
              <li
                key={food.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-elevated"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {localized.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-secondary">
                    <span>{localized.servingSize}</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatEnergy(food.calories, locale, energyUnit)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2.5 text-[11px] text-ink-secondary tabular-nums">
                    <span>
                      <span className="font-medium text-macro-protein">
                        {t.macros.proteinShort}
                      </span>{" "}
                      {formatMacroAmount(food.protein, locale, macroUnit)}
                    </span>
                    <span>
                      <span className="font-medium text-macro-carbs">
                        {t.macros.carbsShort}
                      </span>{" "}
                      {formatMacroAmount(food.carbs, locale, macroUnit)}
                    </span>
                    <span>
                      <span className="font-medium text-macro-fat">
                        {t.macros.fatShort}
                      </span>{" "}
                      {formatMacroAmount(food.fat, locale, macroUnit)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    aria-label={t.catalog.servingsAria(localized.name)}
                    value={servings}
                    onChange={(e) =>
                      setServingsByFood((prev) => ({
                        ...prev,
                        [food.id]: Number(e.target.value),
                      }))
                    }
                    className="rounded-lg border border-border-strong bg-input px-2 py-1.5 text-xs font-medium text-ink tabular-nums focus:border-accent focus:outline-none"
                  >
                    {SERVING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}×
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={addingFoodId !== null}
                    aria-label={t.catalog.addAria(localized.name, localizedMeal)}
                    onClick={() => void onAddFood(food.id, servings)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAdding ? t.catalog.adding : t.catalog.add}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <section
      aria-label={t.catalog.sectionLabel}
      className="rounded-2xl border border-border-subtle bg-surface p-5"
    >
      {content}
    </section>
  );
}
