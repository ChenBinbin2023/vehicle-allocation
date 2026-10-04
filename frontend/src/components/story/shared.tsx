"use client";

import type { ReactNode } from "react";

export function MetricGrid({
  items,
  testId,
}: {
  items: Array<{ label: string; value: string; note?: string; tone?: "green" | "amber" | "red" }>;
  testId?: string;
}) {
  return (
    <div className="story-metric-grid" data-testid={testId}>
      {items.map((item) => (
        <div className={item.tone ? `tone-${item.tone}` : ""} key={item.label}>
          <small>{item.label}</small><strong>{item.value}</strong>{item.note && <span>{item.note}</span>}
        </div>
      ))}
    </div>
  );
}

export function MiniBar({ label, value, total, color = "green" }: { label: string; value: number; total: number; color?: "green" | "amber" | "slate" }) {
  const width = Math.max(2, Math.round((value / total) * 100));
  return <div className="story-mini-bar"><div><span>{label}</span><strong>{value.toLocaleString()}</strong></div><i><b className={color} style={{ width: `${width}%` }} /></i></div>;
}

export function SectionGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 | 4 | 5 }) {
  return <div className={`story-section-grid cols-${columns}`}>{children}</div>;
}

export function FactCard({ eyebrow, title, children, tone }: { eyebrow: string; title: string; children: ReactNode; tone?: "green" | "amber" | "red" }) {
  return <article className={`story-fact-card ${tone ? `tone-${tone}` : ""}`}><span>{eyebrow}</span><strong>{title}</strong><div>{children}</div></article>;
}

export function StatusPill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "slate" }) {
  return <span className={`story-status-pill ${tone}`}><i />{children}</span>;
}
