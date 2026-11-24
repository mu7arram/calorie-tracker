"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  getLocaleDirection,
  isValidLocale,
  TRANSLATIONS,
  type Locale,
  type LocalizedStrings,
} from "@/lib/i18n";

const LOCALE_STORAGE_KEY = "locale";

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  mounted: boolean;
  t: LocalizedStrings;
  setLocale: (nextLocale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isValidLocale(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors
  }
  return "en";
}

function applyDocumentLocale(nextLocale: Locale) {
  document.documentElement.lang = nextLocale;
  document.documentElement.dir = getLocaleDirection(nextLocale);
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getStoredLocale();
    setLocaleState(initial);
    applyDocumentLocale(initial);
    setMounted(true);

    function handleStorageChange(event: StorageEvent) {
      if (event.key === LOCALE_STORAGE_KEY || event.key === null) {
        const synced = getStoredLocale();
        setLocaleState(synced);
        applyDocumentLocale(synced);
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const commitLocale = useCallback((nextLocale: Locale, useFlushSync: boolean) => {
    applyDocumentLocale(nextLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Ignore storage access errors; active page still updates
    }

    if (useFlushSync) {
      flushSync(() => {
        setLocaleState(nextLocale);
      });
    } else {
      setLocaleState(nextLocale);
    }
  }, []);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === locale) {
        return;
      }

      const prevDir = getLocaleDirection(locale);
      const nextDir = getLocaleDirection(nextLocale);
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (
        typeof document.startViewTransition !== "function" ||
        prefersReducedMotion
      ) {
        commitLocale(nextLocale, false);
        return;
      }

      const root = document.documentElement;
      const dirClass =
        prevDir !== nextDir
          ? nextDir === "rtl"
            ? "lang-to-rtl"
            : "lang-to-ltr"
          : "lang-same-dir";

      root.classList.add("lang-transitioning", dirClass);

      const transition = document.startViewTransition(() => {
        commitLocale(nextLocale, true);
      });

      transition.finished.finally(() => {
        root.classList.remove(
          "lang-transitioning",
          "lang-to-rtl",
          "lang-to-ltr",
          "lang-same-dir"
        );
      });
    },
    [commitLocale, locale]
  );

  const dir = getLocaleDirection(locale);

  return (
    <LocaleContext.Provider
      value={{
        locale,
        dir,
        mounted,
        t: TRANSLATIONS[locale],
        setLocale,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return ctx;
}

