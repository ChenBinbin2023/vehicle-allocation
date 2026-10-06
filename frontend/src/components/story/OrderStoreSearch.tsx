"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, Store } from "lucide-react";
import type { OrderStore } from "@/lib/story/vessel-orders";
import { matchesOrderStore } from "@/lib/story/vessel-store-search";

type Suggestion = {
  key: string;
  label: string;
  detail: string;
  storeId?: string;
};

export default function OrderStoreSearch({
  stores,
  value,
  onChange,
  onSelectStore,
}: {
  stores: OrderStore[];
  value: string;
  onChange: (value: string) => void;
  onSelectStore: (id: string) => void;
}) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState({ above: false, maxHeight: 360 });
  const keyword = value.trim().toLowerCase();
  const matches = keyword
    ? stores.filter((store) => matchesOrderStore(store, value))
    : [];
  const cities = [...new Set(stores.map((store) => store.city))].filter(
    (city) => keyword && city.toLowerCase().includes(keyword),
  );
  const suggestions: Suggestion[] = [
    ...cities.slice(0, 3).map((city) => ({
      key: `city-${city}`,
      label: city,
      detail: `${stores.filter((store) => store.city === city).length} 家门店`,
    })),
    ...matches.slice(0, 7).map((store) => ({
      key: store.id,
      label: store.name,
      detail: `${store.city} · ${store.channel} · ${store.shortName} / ${store.id}`,
      storeId: store.id,
    })),
  ];
  const shown = open && !!keyword;
  const expanded = shown && suggestions.length > 0;
  const active = activeIndex < suggestions.length ? activeIndex : -1;
  useEffect(() => {
    if (!shown) return;
    const viewport = window.visualViewport;
    function positionPopup() {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportTop + (viewport?.height ?? window.innerHeight);
      const spaceAbove = rect.top - viewportTop - 12;
      const spaceBelow = viewportBottom - rect.bottom - 12;
      const above = spaceBelow < 360 && spaceAbove > spaceBelow;
      const maxHeight = Math.floor(
        Math.min(360, Math.max(0, (above ? spaceAbove : spaceBelow) - 6)),
      );
      setPlacement((previous) =>
        previous.above === above && previous.maxHeight === maxHeight
          ? previous
          : { above, maxHeight },
      );
    }
    positionPopup();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    viewport?.addEventListener("resize", positionPopup);
    viewport?.addEventListener("scroll", positionPopup);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
      viewport?.removeEventListener("resize", positionPopup);
      viewport?.removeEventListener("scroll", positionPopup);
    };
  }, [shown]);
  useEffect(() => {
    if (expanded && active >= 0)
      listRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [active, expanded]);

  function choose(suggestion: Suggestion) {
    onChange(suggestion.label);
    if (suggestion.storeId) onSelectStore(suggestion.storeId);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div
      ref={wrapperRef}
      className="voa-search-wrap"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <label className="voa-search">
        <Search size={14} aria-hidden="true" />
        <input
          role="combobox"
          aria-label="搜索订单门店"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && active >= 0 ? `${listId}-${active}` : undefined
          }
          autoComplete="off"
          placeholder="搜索门店名称、城市或编码"
          value={value}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
            } else if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              suggestions.length
            ) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(
                event.key === "ArrowDown"
                  ? (active + 1) % suggestions.length
                  : active <= 0
                    ? suggestions.length - 1
                    : active - 1,
              );
            } else if (event.key === "Enter" && expanded && active >= 0) {
              event.preventDefault();
              choose(suggestions[active]);
            }
          }}
        />
      </label>
      {shown && (
        <div
          className={`voa-search-popup${placement.above ? " above" : ""}`}
          style={{ maxHeight: placement.maxHeight }}
        >
          {suggestions.length ? (
            <>
              <div
                id={listId}
                ref={listRef}
                role="listbox"
                aria-label="门店搜索联想"
                className="voa-search-options"
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    type="button"
                    role="option"
                    tabIndex={-1}
                    key={suggestion.key}
                    id={`${listId}-${index}`}
                    aria-selected={active === index}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(suggestion)}
                  >
                    {suggestion.storeId ? (
                      <Store size={15} aria-hidden="true" />
                    ) : (
                      <MapPin size={15} aria-hidden="true" />
                    )}
                    <span>
                      <span>
                        <small>{suggestion.storeId ? "门店" : "城市"}</small>
                        <strong>{suggestion.label}</strong>
                      </span>
                      <span className="voa-suggestion-detail">
                        {suggestion.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <footer>
                ↑ ↓ 选择 · Enter 确认 · Esc 收起
                {matches.length > 7
                  ? ` · 已显示前 7 家，共 ${matches.length} 家匹配门店`
                  : ""}
              </footer>
            </>
          ) : (
            <p role="status">没有匹配的城市或门店，试试名称或编码。</p>
          )}
        </div>
      )}
    </div>
  );
}
