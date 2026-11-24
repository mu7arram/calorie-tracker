"use client";

import { useId, useState } from "react";
import {
  AiNutritionReview,
  formatFriendlyAiError,
  LoadingSpinner,
} from "@/components/AiNutritionReview";
import { useLocale } from "@/components/LocaleProvider";
import type {
  CustomFoodLogItem,
  MealCategory,
  NutritionLookupResponse,
} from "@/types/food";

interface AiTextLookupProps {
  isSaving: boolean;
  selectedMeal: MealCategory;
  onSaveAiItems: (items: CustomFoodLogItem[]) => Promise<boolean>;
}

const MAX_DESCRIPTION_LENGTH = 500;

export function AiTextLookup({
  isSaving,
  selectedMeal,
  onSaveAiItems,
}: AiTextLookupProps) {
  const { locale, t } = useLocale();
  const inputId = useId();
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionLookupResponse | null>(null);

  async function analyzeDescription() {
    const trimmed = description.trim();
    if (!trimmed) {
      setErrorMessage(t.aiText.emptyInputError);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch("/api/nutrition/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed, locale }),
      });

      const payload = (await res.json().catch(() => ({}))) as Partial<
        NutritionLookupResponse
      > & { error?: string };

      if (!res.ok) {
        setErrorMessage(
          formatFriendlyAiError(res.status, t.aiReview.errors, payload.error)
        );
        return;
      }

      if (!payload.items || payload.items.length === 0) {
        setErrorMessage(t.aiText.noFoodsError);
        return;
      }

      setResult(payload as NutritionLookupResponse);
    } catch {
      setErrorMessage(formatFriendlyAiError(null, t.aiReview.errors));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleConfirm(items: CustomFoodLogItem[]) {
    const saved = await onSaveAiItems(items);
    if (saved) {
      setResult(null);
      setDescription("");
      setErrorMessage(null);
    }
  }

  const isBusy = isAnalyzing || isSaving;

  return (
    <div>
      <p className="mb-3.5 text-sm text-ink-secondary">{t.aiText.intro}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void analyzeDescription();
        }}
        className="space-y-3"
      >
        <div>
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-xs font-medium text-ink-secondary"
          >
            {t.aiText.label}
          </label>
          <textarea
            id={inputId}
            rows={3}
            maxLength={MAX_DESCRIPTION_LENGTH}
            disabled={isBusy}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isBusy && description.trim()) {
                  void analyzeDescription();
                }
              }
            }}
            placeholder={t.aiText.placeholder}
            className="w-full rounded-xl border border-border-subtle bg-input px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted tabular-nums">
            <span>{t.aiText.shortcutTip}</span>
            <span>
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isBusy || !description.trim()}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnalyzing ? t.aiText.analyzing : t.aiText.analyze}
        </button>
      </form>

      {isAnalyzing ? (
        <div className="mt-4">
          <LoadingSpinner label={t.aiText.spinner} />
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-error-border bg-error-bg px-3.5 py-3 text-sm text-error-text"
        >
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <AiNutritionReview
          result={result}
          selectedMeal={selectedMeal}
          isSaving={isSaving}
          onConfirm={handleConfirm}
          onDiscard={() => setResult(null)}
        />
      ) : null}
    </div>
  );
}
