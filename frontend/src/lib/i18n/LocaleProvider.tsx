"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALE_STORAGE, translate, type Locale } from "./translate";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <T>(value: T) => T;
};
const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (value) => value,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("zh-CN");
  useEffect(() => {
    try {
      if (localStorage.getItem(LOCALE_STORAGE) === "en") updateLocale("en");
    } catch {
      /* Language switching also works when browser storage is unavailable. */
    }
    const sync = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE)
        updateLocale(event.newValue === "en" ? "en" : "zh-CN");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title =
      locale === "en"
        ? "ATLAS · Supply Chain Decision Intelligence"
        : "ATLAS · 吉达单港供应保障 Agent";
  }, [locale]);
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        updateLocale(next);
        try {
          localStorage.setItem(LOCALE_STORAGE, next);
        } catch {
          /* Keep the in-memory preference. */
        }
      },
      t: (text) => translate(text, locale),
    }),
    [locale],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export const useI18n = () => useContext(LocaleContext);
