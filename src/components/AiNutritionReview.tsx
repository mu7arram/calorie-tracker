"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import {
  formatGrams,
  formatLocaleNumber,
  type LocalizedStrings,
} from "@/lib/i18n";
import type {
  CustomFoodLogItem,
  MealCategory,
  NutritionLookupResponse,
} from "@/types/food";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatFriendlyAiError(
  status: number | null,
  errors: LocalizedStrings["aiReview"]["errors"],
  serverError?: string
): string {
  if (status === null) {
    return errors.network;
  }

  const normalized = serverError?.toLowerCase() ?? "";
  if (normalized.includes("gemini_api_key")) {
    return errors.missingKey;
  }

  if (status === 400) {
    return serverError || errors.badInput;
  }

  if (status === 502) {
    return errors.upstream;
  }

  return serverError || errors.generic;
}

export function LoadingSpinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl border border-accent-soft-border bg-accent-soft px-4 py-3 text-sm text-accent-soft-text"
    >
      <svg
        className="h-4 w-4 shrink-0 animate-spin text-accent motion-reduce:animate-none"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="font-medium">{label}</span>
    </div>
  );
}

interface AiNutritionReviewProps {
  result: NutritionLookupResponse;
  selectedMeal: MealCategory;
  isSaving: boolean;
  onConfirm: (items: CustomFoodLogItem[]) => Promise<void>;
  onDiscard: () => void;
}

export function AiNutritionReview({
  result,
  selectedMeal,
  isSaving,
  onConfirm,
  onDiscard,
}: AiNutritionReviewProps) {
  const { locale, t } = useLocale();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(result.items.map((_, index) => index))
  );

  useEffect(() => {
    setSelectedIndices(new Set(result.items.map((_, index) => index)));
  }, [result]);

  function toggleIndex(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const selectedItems: CustomFoodLogItem[] = result.items
    .filter((_, index) => selectedIndices.has(index))
    .map((item) => ({
      name: item.name,
      servingSize: item.servingSize,
      servings: 1,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    }));

  const subtotal = selectedItems.reduce(
    (acc, item) => ({
      calories: round1(acc.calories + item.calories),
      protein: round1(acc.protein + item.protein),
      carbs: round1(acc.carbs + item.carbs),
      fat: round1(acc.fat + item.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const mealLabel = t.meals[selectedMeal];
  const confirmLabel =
    selectedItems.length === 1
      ? t.aiReview.addSingle(mealLabel)
      : t.aiReview.addMultiple(selectedItems.length, mealLabel);

  return (
    <div className="mt-4 rounded-xl border border-accent-soft-border bg-elevated p-4">
      <div className="mb-3">
        <p className="text-xs font-medium text-accent-soft-text">
          {t.aiReview.eyebrow}
        </p>
        <p className="mt-1 text-sm font-medium text-ink">{result.summary}</p>
      </div>

      <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
        {result.items.map((item, index) => {
          const isChecked = selectedIndices.has(index);
          return (
            <li key={`${item.name}-${index}`} className="px-3 py-2.5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isSaving}
                  onChange={() => toggleIndex(index)}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong bg-input"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                      {formatLocaleNumber(item.calories)} {t.units.kcal}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-secondary tabular-nums">
                    <span>{item.servingSize}</span>
                    <span>
                      <span className="text-macro-protein">
                        {t.macros.proteinShort}
                      </span>{" "}
                      {formatGrams(item.protein, locale)}
                    </span>
                    <span>
                      <span className="text-macro-carbs">
                        {t.macros.carbsShort}
                      </span>{" "}
                      {formatGrams(item.carbs, locale)}
                    </span>
                    <span>
                      <span className="text-macro-fat">
                        {t.macros.fatShort}
                      </span>{" "}
                      {formatGrams(item.fat, locale)}
                    </span>
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs text-ink-secondary tabular-nums">
        <span>
          {t.aiReview.selectedSubtotal}{" "}
          <strong className="text-ink">
            {formatLocaleNumber(subtotal.calories)} {t.units.kcal}
          </strong>
        </span>
        <div className="flex items-center gap-3">
          <span>
            <span className="text-macro-protein">{t.macros.proteinShort}</span>{" "}
            {formatGrams(subtotal.protein, locale)}
          </span>
          <span>
            <span className="text-macro-carbs">{t.macros.carbsShort}</span>{" "}
            {formatGrams(subtotal.carbs, locale)}
          </span>
          <span>
            <span className="text-macro-fat">{t.macros.fatShort}</span>{" "}
            {formatGrams(subtotal.fat, locale)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={onDiscard}
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t.aiReview.discard}
        </button>
        <button
          type="button"
          disabled={isSaving || selectedItems.length === 0}
          onClick={() => void onConfirm(selectedItems)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <svg
                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{t.aiReview.saving}</span>
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </div>
  );
}
