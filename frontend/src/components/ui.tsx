import { useI18n } from "@/lib/i18n/LocaleProvider";
import { ArrowUpRight, Info } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  const { t: translateText } = useI18n();

  return <span className={`badge ${tone}`}>{translateText(children)}</span>;
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
  const { t: translateText } = useI18n();

  return (
    <section className={`card ${className}`}>
      {translateText(
        title && (
          <header className="card-head">
            <div>
              {translateText(
                eyebrow && (
                  <span className="eyebrow">{translateText(eyebrow)}</span>
                ),
              )}
              <h3>{translateText(title)}</h3>
            </div>
            {translateText(action)}
          </header>
        ),
      )}
      {translateText(children)}
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
  const { t: translateText } = useI18n();

  return (
    <button
      className={`metric ${accent ?? ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="metric-label">
        {translateText(label)}
        {onClick && <ArrowUpRight size={14} />}
      </div>
      <div className="metric-value">
        {translateText(value)}
        <small>{translateText(unit)}</small>
      </div>
      <div className="metric-note">{translateText(note)}</div>
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
  const { t: translateText } = useI18n();

  return (
    <div className={`note ${tone}`}>
      <Info size={14} />
      <span>{translateText(children)}</span>
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
  const { t: translateText } = useI18n();

  return (
    <div className={`progress ${tone}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
