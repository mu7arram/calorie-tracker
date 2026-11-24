"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useLocale } from "@/components/LocaleProvider";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "color-scheme";

function getStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Ignore storage access failures (private mode / blocked site data)
  }
  return "system";
}

function resolveEffectiveScheme(
  mode: ThemeMode,
  systemIsDark: boolean
): "light" | "dark" {
  if (mode === "system") {
    return systemIsDark ? "dark" : "light";
  }
  return mode;
}

function applyMetaColorScheme(mode: ThemeMode) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute("content", mode === "system" ? "light dark" : mode);
  }
}

export function ThemeToggle() {
  const { mounted: localeMounted, t } = useLocale();
  const [mode, setMode] = useState<ThemeMode>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const initialMode = getStoredMode();

    setSystemIsDark(mediaQuery.matches);
    setMode(initialMode);
    applyMetaColorScheme(initialMode);
    setMounted(true);

    function handleSystemChange(event: MediaQueryListEvent) {
      setSystemIsDark(event.matches);
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null) {
        const next = getStoredMode();
        setMode(next);
        applyMetaColorScheme(next);
      }
    }

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  function commitTheme(nextMode: ThemeMode, useFlushSync: boolean) {
    applyMetaColorScheme(nextMode);
    try {
      if (nextMode === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, nextMode);
      }
    } catch {
      // Theme still applies to current document even if persistence is blocked
    }

    if (useFlushSync) {
      flushSync(() => {
        setMode(nextMode);
      });
    } else {
      setMode(nextMode);
    }
  }

  function handleSelect(
    nextMode: ThemeMode,
    event: MouseEvent<HTMLButtonElement>
  ) {
    if (nextMode === mode) {
      return;
    }

    const prevEffective = resolveEffectiveScheme(mode, systemIsDark);
    const nextEffective = resolveEffectiveScheme(nextMode, systemIsDark);
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
      prevEffective === nextEffective ||
      typeof document.startViewTransition !== "function" ||
      prefersReducedMotion
    ) {
      commitTheme(nextMode, false);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const root = document.documentElement;
    root.classList.add("theme-transitioning");

    const transition = document.startViewTransition(() => {
      commitTheme(nextMode, true);
    });

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 1000,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Fallback if snapshot setup fails
      });

    transition.finished.finally(() => {
      root.classList.remove("theme-transitioning");
    });
  }

  const systemLabel =
    mounted && localeMounted
      ? t.theme.systemCurrent(systemIsDark ? "dark" : "light")
      : t.theme.systemFallback;

  const options: Array<{
    id: ThemeMode;
    label: string;
    title: string;
  }> = [
    { id: "light", label: t.theme.light, title: t.theme.light },
    { id: "dark", label: t.theme.dark, title: t.theme.dark },
    { id: "system", label: systemLabel, title: systemLabel },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={t.theme.groupLabel}
      className="inline-flex h-9 items-center gap-0.5 rounded-xl border border-border-subtle bg-surface p-1"
    >
      {options.map((option) => {
        const isSelected = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            title={option.title}
            data-theme-option={option.id}
            onClick={(e) => handleSelect(option.id, e)}
            className={`group relative flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              isSelected
                ? "bg-elevated text-ink ring-1 ring-border-strong"
                : "text-ink-secondary hover:bg-elevated/60 hover:text-ink"
            }`}
          >
            {option.id === "light" ? (
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
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : option.id === "dark" ? (
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
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
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
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-full left-1/2 z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2 py-0.5 text-[11px] font-medium text-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {option.id === "system" ? systemLabel : option.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
