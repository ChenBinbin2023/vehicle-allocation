"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Languages,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/translate";

export default function AccountMenu() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [languages, setLanguages] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setLanguages(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open)
      menu.current
        ?.querySelector<HTMLButtonElement>(
          languages
            ? '[aria-checked="true"]'
            : '[data-testid="language-menu-toggle"]',
        )
        ?.focus();
  }, [open, languages]);

  function close() {
    setOpen(false);
    setLanguages(false);
    trigger.current?.focus();
  }
  function keyboard(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab") {
      setOpen(false);
      setLanguages(false);
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      ) ?? [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
            items.length;
    items[next]?.focus();
  }
  function choose(next: Locale) {
    setLocale(next);
    close();
  }

  return (
    <div
      className="workspace-account-control"
      ref={container}
      onKeyDown={keyboard}
    >
      {open && (
        <div
          className="workspace-account-menu"
          data-testid="account-menu"
          role="menu"
          aria-label={t("用户菜单")}
          ref={menu}
        >
          <div className="workspace-account-identity">
            <span className="workspace-account-avatar">OM</span>
            <div>
              <strong>Omar</strong>
              <small>{t("全国供应链负责人")}</small>
            </div>
          </div>
          {languages ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="workspace-language-back"
                onClick={() => setLanguages(false)}
              >
                <ChevronLeft size={15} />
                {t("界面语言")}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === "zh-CN"}
                onClick={() => choose("zh-CN")}
                lang="zh-CN"
              >
                <span>简体中文</span>
                {locale === "zh-CN" && <Check size={16} />}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={locale === "en"}
                onClick={() => choose("en")}
                lang="en"
              >
                <span>English</span>
                {locale === "en" && <Check size={16} />}
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              data-testid="language-menu-toggle"
              aria-haspopup="menu"
              onClick={() => setLanguages(true)}
            >
              <Languages size={17} />
              <span>{t("界面语言")}</span>
              <b className="workspace-language-badge">
                {locale === "en" ? "EN" : "中"}
              </b>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        className="workspace-account"
        data-testid="account-menu-toggle"
        aria-label={t("用户菜单")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setLanguages(false);
        }}
      >
        <span className="workspace-account-avatar">OM</span>
        <div>
          <strong>Omar</strong>
          <small>{t("全国供应链负责人")}</small>
        </div>
        <ChevronDown size={13} className={open ? "account-chevron-open" : ""} />
      </button>
    </div>
  );
}
