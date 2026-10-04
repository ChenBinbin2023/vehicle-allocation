import { ArrowUpRight, Info } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Card({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  unit = "台",
  note,
  accent,
  onClick,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note: ReactNode;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`metric ${accent ?? ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="metric-label">
        {label}
        {onClick && <ArrowUpRight size={14} />}
      </div>
      <div className="metric-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="metric-note">{note}</div>
    </button>
  );
}
export function Note({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`note ${tone}`}>
      <Info size={14} />
      <span>{children}</span>
    </div>
  );
}
export function Progress({
  value,
  tone = "",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div className={`progress ${tone}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
