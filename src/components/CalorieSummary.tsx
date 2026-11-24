"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { formatGrams, formatLocaleNumber } from "@/lib/i18n";
import type { DailyTotals } from "@/types/food";

interface CalorieSummaryProps {
  totals: DailyTotals;
  entryCount: number;
  dailyGoal: number;
  isSavingGoal: boolean;
  onUpdateGoal: (nextGoal: number) => Promise<boolean>;
}

export function CalorieSummary({
  totals,
  entryCount,
  dailyGoal,
  isSavingGoal,
  onUpdateGoal,
}: CalorieSummaryProps) {
  const { locale, t } = useLocale();
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(dailyGoal));
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingGoal) {
      setGoalInput(String(dailyGoal));
    }
  }, [dailyGoal, isEditingGoal]);

  const rawPct = dailyGoal > 0 ? (totals.calories / dailyGoal) * 100 : 0;
  const clampedPct = Math.min(Math.max(rawPct, 0), 100);
  const roundedPct = Math.round(rawPct);

  let barColorClass = "bg-status-green";
  let statusTextClass = "text-status-green";
  if (rawPct > 100) {
    barColorClass = "bg-status-red";
    statusTextClass = "text-status-red";
  } else if (rawPct > 85) {
    barColorClass = "bg-status-yellow";
    statusTextClass = "text-status-yellow";
  }

  const diff = Math.round((dailyGoal - totals.calories) * 10) / 10;
  let remainingLabel = t.summary.remaining(formatLocaleNumber(diff));
  if (diff === 0) {
    remainingLabel = t.summary.goalReached;
  } else if (diff < 0) {
    remainingLabel = t.summary.overGoal(formatLocaleNumber(Math.abs(diff)));
  }

  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;

  const proteinPct =
    totalMacroKcal > 0 ? Math.round((proteinKcal / totalMacroKcal) * 100) : 0;
  const carbsPct =
    totalMacroKcal > 0 ? Math.round((carbsKcal / totalMacroKcal) * 100) : 0;
  const fatPct =
    totalMacroKcal > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0;

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(goalInput);
    if (!Number.isInteger(parsed) || parsed < 500 || parsed > 10000) {
      setGoalError(t.summary.goalValidationError);
      return;
    }

    setGoalError(null);
    const saved = await onUpdateGoal(parsed);
    if (saved) {
      setIsEditingGoal(false);
    }
  }

  return (
    <section
      data-vt="summary"
      aria-label={t.summary.sectionLabel}
      className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
        {/* Calorie Progress Column */}
        <div className="min-w-0 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-secondary">
                {t.summary.dailyCalorieIntake}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span
                  data-testid="total-calories"
                  className="font-display text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-5xl"
                >
                  {formatLocaleNumber(totals.calories)}
                </span>
                <span className="text-sm font-medium text-ink-secondary tabular-nums sm:text-lg">
                  / {formatLocaleNumber(dailyGoal)} {t.units.kcal}
                </span>
              </div>
            </div>

            {!isEditingGoal ? (
              <button
                type="button"
                onClick={() => {
                  setGoalInput(String(dailyGoal));
                  setGoalError(null);
                  setIsEditingGoal(true);
                }}
                className="rounded-lg border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
              >
                {t.summary.editGoal}
              </button>
            ) : (
              <form
                onSubmit={(e) => void handleSaveGoal(e)}
                className="flex flex-wrap items-center gap-2"
              >
                <label htmlFor="daily-goal-input" className="sr-only">
                  {t.summary.dailyGoalInputLabel}
                </label>
                <input
                  id="daily-goal-input"
                  type="number"
                  min={500}
                  max={10000}
                  step={50}
                  disabled={isSavingGoal}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-24 rounded-lg border border-border-strong bg-input px-2.5 py-1.5 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSavingGoal}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {isSavingGoal ? t.summary.saving : t.summary.saveGoal}
                </button>
                <button
                  type="button"
                  disabled={isSavingGoal}
                  onClick={() => {
                    setIsEditingGoal(false);
                    setGoalError(null);
                  }}
                  className="rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                >
                  {t.summary.cancel}
                </button>
              </form>
            )}
          </div>

          {goalError ? (
            <p role="alert" className="mt-2 text-xs text-status-red">
              {goalError}
            </p>
          ) : null}

          <div className="mt-4">
            <div
              role="progressbar"
              aria-label={t.summary.progressLabel}
              aria-valuenow={Math.round(totals.calories)}
              aria-valuemin={0}
              aria-valuemax={dailyGoal}
              className="h-3 w-full overflow-hidden rounded-full bg-track"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${barColorClass}`}
                style={{ width: `${clampedPct}%` }}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className={`font-medium tabular-nums ${statusTextClass}`}>
                {remainingLabel}
              </span>
              <span className="text-ink-secondary tabular-nums">
                {t.summary.percentOfGoal(roundedPct, entryCount)}
              </span>
            </div>
          </div>
        </div>

        {/* Macro Breakdown Visual Column */}
        <div className="min-w-0 border-t border-border-subtle pt-5 lg:col-span-5 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-secondary">
              {t.summary.macroBreakdown}
            </p>
            <span className="text-xs text-ink-muted tabular-nums">
              {totalMacroKcal > 0
                ? t.summary.shareOfCalories
                : t.summary.noMacrosLogged}
            </span>
          </div>

          <div
            aria-label={t.summary.macroDistributionLabel}
            className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-track"
          >
            {totalMacroKcal > 0 ? (
              <>
                {proteinKcal > 0 ? (
                  <div
                    className="h-full bg-macro-protein transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${(proteinKcal / totalMacroKcal) * 100}%`,
                    }}
                    title={`${t.macros.protein} ${proteinPct}%`}
                  />
                ) : null}
                {carbsKcal > 0 ? (
                  <div
                    className="h-full bg-macro-carbs transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${(carbsKcal / totalMacroKcal) * 100}%`,
                    }}
                    title={`${t.macros.carbs} ${carbsPct}%`}
                  />
                ) : null}
                {fatKcal > 0 ? (
                  <div
                    className="h-full bg-macro-fat transition-all duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${(fatKcal / totalMacroKcal) * 100}%`,
                    }}
                    title={`${t.macros.fat} ${fatPct}%`}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-2.5">
            <div className="min-w-0 rounded-xl border border-border-subtle bg-elevated px-2.5 py-2 sm:px-3 sm:py-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-macro-protein"
                />
                <span className="truncate text-xs font-medium text-ink-secondary">
                  {t.macros.protein}
                </span>
              </div>
              <p
                data-testid="total-protein"
                className="mt-1.5 font-display text-base font-bold text-ink tabular-nums sm:text-lg"
              >
                {formatGrams(totals.protein, locale)}
              </p>
              <p className="text-xs text-ink-muted tabular-nums">
                {proteinPct}%
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-border-subtle bg-elevated px-2.5 py-2 sm:px-3 sm:py-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-macro-carbs"
                />
                <span className="truncate text-xs font-medium text-ink-secondary">
                  {t.macros.carbs}
                </span>
              </div>
              <p
                data-testid="total-carbs"
                className="mt-1.5 font-display text-base font-bold text-ink tabular-nums sm:text-lg"
              >
                {formatGrams(totals.carbs, locale)}
              </p>
              <p className="text-xs text-ink-muted tabular-nums">
                {carbsPct}%
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-border-subtle bg-elevated px-2.5 py-2 sm:px-3 sm:py-2.5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-macro-fat"
                />
                <span className="truncate text-xs font-medium text-ink-secondary">
                  {t.macros.fat}
                </span>
              </div>
              <p
                data-testid="total-fat"
                className="mt-1.5 font-display text-base font-bold text-ink tabular-nums sm:text-lg"
              >
                {formatGrams(totals.fat, locale)}
              </p>
              <p className="text-xs text-ink-muted tabular-nums">
                {fatPct}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
