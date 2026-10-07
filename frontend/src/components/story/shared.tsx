"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import type { ReactNode } from "react";

export function MetricGrid({
  items,
  testId,
}: {
  items: Array<{
    label: string;
    value: string;
    note?: string;
    tone?: "green" | "amber" | "red";
  }>;
  testId?: string;
}) {
  const { t: translateText } = useI18n();

  return (
    <div className="story-metric-grid" data-testid={testId}>
      {items.map((item) => (
        <div className={item.tone ? `tone-${item.tone}` : ""} key={item.label}>
          <small>{translateText(item.label)}</small>
          <strong>{translateText(item.value)}</strong>
          {translateText(item.note && <span>{translateText(item.note)}</span>)}
        </div>
      ))}
    </div>
  );
}

export function MiniBar({
  label,
  value,
  total,
  color = "green",
}: {
  label: string;
  value: number;
  total: number;
  color?: "green" | "amber" | "slate";
}) {
  const { t: translateText } = useI18n();

  const width = Math.max(2, Math.round((value / total) * 100));
  return (
    <div className="story-mini-bar">
      <div>
        <span>{translateText(label)}</span>
        <strong>{translateText(value.toLocaleString())}</strong>
      </div>
      <i>
        <b className={color} style={{ width: `${width}%` }} />
      </i>
    </div>
  );
}

export function SectionGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
}) {
  const { t: translateText } = useI18n();

  return (
    <div className={`story-section-grid cols-${columns}`}>
      {translateText(children)}
    </div>
  );
}

export function FactCard({
  eyebrow,
  title,
  children,
  tone,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: "green" | "amber" | "red";
}) {
  const { t: translateText } = useI18n();

  return (
    <article className={`story-fact-card ${tone ? `tone-${tone}` : ""}`}>
      <span>{translateText(eyebrow)}</span>
      <strong>{translateText(title)}</strong>
      <div>{translateText(children)}</div>
    </article>
  );
}

export function StatusPill({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "slate";
}) {
  const { t: translateText } = useI18n();

  return (
    <span className={`story-status-pill ${tone}`}>
      <i />
      {translateText(children)}
    </span>
  );
}
