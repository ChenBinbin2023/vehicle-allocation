"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Database,
  GitBranch,
  LoaderCircle,
} from "lucide-react";
import { visibleStoryEvents } from "@/lib/story/skill-runner";
import type { StoryRun } from "@/lib/story/types";

export default function DecisionProcess({
  run,
  focusedStep,
}: {
  run: StoryRun;
  focusedStep: number | null;
}) {
  const { t: translateText } = useI18n();

  const shown = visibleStoryEvents(run);
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setSelected(Math.max(0, shown.length - 1)), [shown.length]);
  useEffect(() => {
    if (focusedStep !== null) {
      setSelected(focusedStep);
      setExpanded(true);
    }
  }, [focusedStep]);
  const steps = run.evidence?.steps ?? [];
  const index = Math.min(selected, steps.length - 1);
  const active = steps[index];
  if (!active || !shown.length) return null;
  const visibleSteps = steps.slice(
    0,
    Math.max(1, Math.min(shown.length, steps.length)),
  );
  const elapsedToStep = run.events
    .slice(0, index + 1)
    .reduce((sum, event) => sum + event.duration, 0);
  const finished = run.status === "complete" || run.elapsed >= elapsedToStep;
  return (
    <section
      className={`decision-process ${expanded ? "expanded" : ""}`}
      data-testid="decision-process"
    >
      <header>
        <div>
          <GitBranch size={15} />
          <h2>{translateText("决策过程")}</h2>
          <span>{translateText("数据 · 规则 · 校验 · 执行动作")}</span>
        </div>
        <button
          type="button"
          className="process-detail-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {translateText(expanded ? "收起明细" : "查看规则明细")}
        </button>
        <small>
          {translateText(
            run.status === "running" ? (
              <>
                <LoaderCircle size={13} className="decision-spinner" />
                {translateText("分析中")}
              </>
            ) : (
              "可追溯"
            ),
          )}
        </small>
      </header>
      <div className="decision-process-body">
        <nav aria-label={translateText("决策步骤")}>
          {visibleSteps.map((item, i) => (
            <button
              type="button"
              key={item.title}
              className={index === i ? "active" : ""}
              data-testid={`decision-step-${i}`}
              onClick={() => {
                setSelected(i);
                setExpanded(true);
              }}
            >
              <i>
                {run.status === "complete" || i < shown.length - 1 ? (
                  <Check size={10} />
                ) : (
                  i + 1
                )}
              </i>
              <span>
                <small>{translateText(item.operation)}</small>
                <strong>{translateText(item.title)}</strong>
              </span>
              <ChevronRight size={12} />
            </button>
          ))}
        </nav>
        <article className="decision-detail" data-testid="decision-detail">
          <div className="decision-detail-heading">
            <span>{translateText(active.operation)}</span>
            <h3>{translateText(active.title)}</h3>
          </div>
          <div className="decision-inputs">
            {active.inputs.map((input) => (
              <div key={input.label}>
                <small>{translateText(input.label)}</small>
                <strong>{translateText(input.value)}</strong>
              </div>
            ))}
          </div>
          <div className="decision-rule">
            <b>{translateText("采用规则")}</b>
            <p>{translateText(active.rule)}</p>
          </div>
          <div className={`decision-output ${!finished ? "pending" : ""}`}>
            <b>{translateText(finished ? "处理结果" : "正在校验")}</b>
            <p>
              {translateText(
                finished
                  ? active.output
                  : "正在基于本轮数据计算；完成后写入结果。",
              )}
            </p>
          </div>
          <footer>
            <Database size={12} />
            {active.sources.map((source) => (
              <span key={source}>{translateText(source)}</span>
            ))}
          </footer>
        </article>
      </div>
    </section>
  );
}
