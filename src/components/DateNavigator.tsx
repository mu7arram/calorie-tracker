"use client";

import { useLocale } from "@/components/LocaleProvider";
import { formatHeaderDate } from "@/lib/i18n";

interface DateNavigatorProps {
  selectedDate: string;
  todayDate: string;
  onSelectDate: (nextDate: string) => void;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateNavigator({
  selectedDate,
  todayDate,
  onSelectDate,
}: DateNavigatorProps) {
  const { locale, t } = useLocale();
  if (!selectedDate) return null;

  const isToday = selectedDate === todayDate;
  const formattedLabel = formatHeaderDate(selectedDate, locale);

  return (
    <div
      role="group"
      aria-label={t.dateNav.groupLabel}
      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface px-3 py-2.5 sm:px-4"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSelectDate(shiftDate(selectedDate, -1))}
          aria-label={t.dateNav.previousDay}
          title={t.dateNav.previousDay}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink-secondary transition-colors hover:border-border-strong hover:text-ink"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="rtl:rotate-180"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          disabled={isToday}
          onClick={() => onSelectDate(shiftDate(selectedDate, 1))}
          aria-label={t.dateNav.nextDay}
          title={t.dateNav.nextDay}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-ink-secondary transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="rtl:rotate-180"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>

        <div className="ms-1 flex items-center gap-2">
          <time
            dateTime={selectedDate}
            className="font-display text-sm font-semibold text-ink sm:text-base"
          >
            {formattedLabel}
          </time>
          {isToday ? (
            <span className="rounded-md border border-accent-soft-border bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-text">
              {t.dateNav.today}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isToday ? (
          <button
            type="button"
            onClick={() => onSelectDate(todayDate)}
            className="rounded-lg border border-accent-soft-border bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent-soft-text transition-colors hover:border-accent"
          >
            {t.dateNav.today}
          </button>
        ) : null}

        <label className="relative flex items-center">
          <span className="sr-only">{t.dateNav.pickDate}</span>
          <input
            type="date"
            aria-label={t.dateNav.pickDate}
            max={todayDate || undefined}
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                onSelectDate(e.target.value);
              }
            }}
            className="rounded-lg border border-border-subtle bg-input px-2.5 py-1 text-xs font-medium text-ink tabular-nums focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}
