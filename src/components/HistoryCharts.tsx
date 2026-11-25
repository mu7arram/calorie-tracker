"use client";

import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import {
  formatEnergy,
  formatMacroAmount,
  formatShortDate,
  formatWeekdayShort,
} from "@/lib/i18n";
import type {
  DailyHistoryPoint,
  DailyHistoryResponse,
  UserSettings,
} from "@/types/food";

export type HistoryRangeDays = 7 | 30;
type ChartMode = "calories" | "macros";

interface HistoryChartsProps {
  history: DailyHistoryResponse | null;
  rangeDays: HistoryRangeDays;
  isLoading: boolean;
  error: string | null;
  selectedDate: string;
  settings: UserSettings;
  onChangeRange: (days: HistoryRangeDays) => void;
  onSelectDate: (date: string) => void;
}

export function HistoryCharts({
  history,
  rangeDays,
  isLoading,
  error,
  selectedDate,
  settings,
  onChangeRange,
  onSelectDate,
}: HistoryChartsProps) {
  const { locale, t } = useLocale();
  const [chartMode, setChartMode] = useState<ChartMode>("calories");
  const [hoveredDay, setHoveredDay] = useState<DailyHistoryPoint | null>(null);

  const days = history?.days ?? [];
  const summary = history?.summary;
  const { dailyCalorieGoal, energyUnit, macroUnit } = settings;

  const activePoint =
    hoveredDay ?? days.find((d) => d.date === selectedDate) ?? null;

  // Derive chart scales dynamically from visible data; only apply a fallback floor when empty
  const peakCalories = Math.max(0, ...days.map((d) => d.calories));
  const maxCalorieValue =
    peakCalories > 0
      ? Math.max(peakCalories * 1.12, dailyCalorieGoal * 1.1)
      : dailyCalorieGoal > 0
        ? dailyCalorieGoal * 1.1
        : 500;
  const goalLineBottomPct = Math.min(
    96,
    Math.max(4, (dailyCalorieGoal / maxCalorieValue) * 100)
  );

  const peakMacroKcal = Math.max(
    0,
    ...days.map((d) => d.protein * 4 + d.carbs * 4 + d.fat * 9)
  );
  const maxMacroKcal =
    peakMacroKcal > 0
      ? peakMacroKcal * 1.12
      : dailyCalorieGoal > 0
        ? dailyCalorieGoal
        : 500;

  return (
    <section
      aria-label={t.history.sectionLabel}
      className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 sm:p-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
            {t.history.title}
          </h2>
          <p className="mt-0.5 text-xs text-ink-secondary sm:text-sm">
            {t.history.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Calories / Macros toggle */}
          <div
            role="group"
            aria-label={t.history.sectionLabel}
            className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
          >
            <button
              type="button"
              aria-pressed={chartMode === "calories"}
              onClick={() => setChartMode("calories")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                chartMode === "calories"
                  ? "bg-elevated font-semibold text-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {t.history.modeCalories}
            </button>
            <button
              type="button"
              aria-pressed={chartMode === "macros"}
              onClick={() => setChartMode("macros")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                chartMode === "macros"
                  ? "bg-elevated font-semibold text-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {t.history.modeMacros}
            </button>
          </div>

          {/* 7D / 30D range toggle */}
          <div
            role="group"
            aria-label={t.history.range7d}
            className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-canvas p-1"
          >
            <button
              type="button"
              aria-pressed={rangeDays === 7}
              onClick={() => onChangeRange(7)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeDays === 7
                  ? "bg-accent font-semibold text-accent-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {t.history.range7d}
            </button>
            <button
              type="button"
              aria-pressed={rangeDays === 30}
              onClick={() => onChangeRange(30)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeDays === 30
                  ? "bg-accent font-semibold text-accent-ink"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {t.history.range30d}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      {summary ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div className="rounded-xl border border-border-subtle bg-elevated px-3 py-2.5">
            <p className="text-[11px] font-medium text-ink-secondary">
              {t.history.avgDaily}
            </p>
            <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums sm:text-base">
              {formatEnergy(summary.averageCalories, locale, energyUnit)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-elevated px-3 py-2.5">
            <p className="text-[11px] font-medium text-ink-secondary">
              {t.history.daysLoggedLabel}
            </p>
            <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums sm:text-base">
              {t.history.daysLogged(summary.daysLogged, days.length || rangeDays)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-elevated px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-macro-protein"
              />
              <p className="text-[11px] font-medium text-ink-secondary">
                {t.macros.protein}
              </p>
            </div>
            <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums sm:text-base">
              {formatMacroAmount(summary.averageProtein, locale, macroUnit)}
            </p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-elevated px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-macro-carbs"
              />
              <p className="text-[11px] font-medium text-ink-secondary">
                {t.macros.carbs}
              </p>
            </div>
            <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums sm:text-base">
              {formatMacroAmount(summary.averageCarbs, locale, macroUnit)}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-border-subtle bg-elevated px-3 py-2.5 sm:col-span-1">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-macro-fat"
              />
              <p className="text-[11px] font-medium text-ink-secondary">
                {t.macros.fat}
              </p>
            </div>
            <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums sm:text-base">
              {formatMacroAmount(summary.averageFat, locale, macroUnit)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Chart Area */}
      <div className="mt-5">
        {isLoading ? (
          <div
            aria-label={t.history.loading}
            className="h-48 animate-pulse rounded-xl border border-border-subtle bg-canvas"
          />
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-error-border bg-error-bg px-4 py-3 text-sm text-error-text"
          >
            {error}
          </div>
        ) : days.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-canvas px-4 py-10 text-center text-sm text-ink-secondary">
            {t.history.noData}
          </div>
        ) : (
          <div className="rounded-xl border border-border-subtle bg-canvas p-3 sm:p-4">
            {/* Active / Hovered Day Readout */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              {activePoint ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                  <span className="font-semibold text-ink">
                    {formatShortDate(activePoint.date, locale)}
                  </span>
                  <span className="font-semibold text-accent">
                    {formatEnergy(activePoint.calories, locale, energyUnit)}
                  </span>
                  <span className="text-ink-secondary">
                    <span className="text-macro-protein">
                      {t.macros.proteinShort}
                    </span>{" "}
                    {formatMacroAmount(activePoint.protein, locale, macroUnit)}
                  </span>
                  <span className="text-ink-secondary">
                    <span className="text-macro-carbs">
                      {t.macros.carbsShort}
                    </span>{" "}
                    {formatMacroAmount(activePoint.carbs, locale, macroUnit)}
                  </span>
                  <span className="text-ink-secondary">
                    <span className="text-macro-fat">{t.macros.fatShort}</span>{" "}
                    {formatMacroAmount(activePoint.fat, locale, macroUnit)}
                  </span>
                  <span className="text-ink-muted">
                    ({t.history.entriesCount(activePoint.entryCount)})
                  </span>
                </div>
              ) : (
                <span className="text-ink-muted">{t.history.clickBarHint}</span>
              )}

              {chartMode === "calories" ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary tabular-nums">
                  <span
                    aria-hidden="true"
                    className="inline-block w-3 border-t-2 border-dashed border-accent"
                  />
                  {t.history.goalLine(
                    formatEnergy(dailyCalorieGoal, locale, energyUnit)
                  )}
                </span>
              ) : null}
            </div>

            {/* Bars Container (LTR chronological axis for clean scanning) */}
            <div dir="ltr" className="relative h-44 w-full pt-2">
              {chartMode === "calories" ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-accent/70"
                  style={{ bottom: `${goalLineBottomPct}%` }}
                />
              ) : null}

              <div
                className={`flex h-full items-end ${
                  rangeDays === 30 ? "gap-0.5 sm:gap-1" : "gap-1.5 sm:gap-3"
                }`}
              >
                {days.map((day) => {
                  const isSelected = day.date === selectedDate;
                  const pctOfGoal =
                    dailyCalorieGoal > 0
                      ? (day.calories / dailyCalorieGoal) * 100
                      : 0;

                  let barColor = "bg-status-green";
                  if (pctOfGoal > 100) {
                    barColor = "bg-status-red";
                  } else if (pctOfGoal > 85) {
                    barColor = "bg-status-yellow";
                  }

                  const calorieHeightPct =
                    day.calories > 0
                      ? Math.max(4, Math.min(100, (day.calories / maxCalorieValue) * 100))
                      : 0;

                  const pKcal = day.protein * 4;
                  const cKcal = day.carbs * 4;
                  const fKcal = day.fat * 9;
                  const macroTotalKcal = pKcal + cKcal + fKcal;
                  const macroHeightPct =
                    macroTotalKcal > 0
                      ? Math.max(4, Math.min(100, (macroTotalKcal / maxMacroKcal) * 100))
                      : 0;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onSelectDate(day.date)}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onFocus={() => setHoveredDay(day)}
                      onBlur={() => setHoveredDay(null)}
                      aria-label={`${formatShortDate(day.date, locale)}: ${formatEnergy(day.calories, locale, energyUnit)}`}
                      className={`group relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-md px-0.5 transition-colors ${
                        isSelected
                          ? "bg-accent/10 ring-1 ring-accent/50"
                          : "hover:bg-elevated/70"
                      }`}
                    >
                      {chartMode === "calories" ? (
                        <div
                          className={`w-full rounded-t-md transition-all duration-300 motion-reduce:transition-none ${
                            day.calories > 0 ? barColor : "bg-track/60"
                          }`}
                          style={{
                            height: day.calories > 0 ? `${calorieHeightPct}%` : "3px",
                          }}
                        />
                      ) : (
                        <div
                          className="flex w-full flex-col-reverse overflow-hidden rounded-t-md bg-track/60 transition-all duration-300 motion-reduce:transition-none"
                          style={{
                            height:
                              macroTotalKcal > 0 ? `${macroHeightPct}%` : "3px",
                          }}
                        >
                          {macroTotalKcal > 0 ? (
                            <>
                              <div
                                className="w-full bg-macro-protein"
                                style={{
                                  height: `${(pKcal / macroTotalKcal) * 100}%`,
                                }}
                              />
                              <div
                                className="w-full bg-macro-carbs"
                                style={{
                                  height: `${(cKcal / macroTotalKcal) * 100}%`,
                                }}
                              />
                              <div
                                className="w-full bg-macro-fat"
                                style={{
                                  height: `${(fKcal / macroTotalKcal) * 100}%`,
                                }}
                              />
                            </>
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div
              dir="ltr"
              className={`mt-2 flex ${
                rangeDays === 30 ? "gap-0.5 sm:gap-1" : "gap-1.5 sm:gap-3"
              }`}
            >
              {days.map((day, idx) => {
                const isSelected = day.date === selectedDate;
                const showLabel =
                  rangeDays === 7 ||
                  idx === 0 ||
                  idx === days.length - 1 ||
                  idx % 5 === 0;
                return (
                  <div
                    key={day.date}
                    className={`min-w-0 flex-1 truncate text-center text-[10px] tabular-nums sm:text-[11px] ${
                      isSelected
                        ? "font-semibold text-accent"
                        : "text-ink-muted"
                    }`}
                  >
                    {showLabel
                      ? rangeDays === 7
                        ? formatWeekdayShort(day.date, locale)
                        : formatShortDate(day.date, locale)
                      : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

