"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Pause,
  Play,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import type { StoryMessage } from "@/lib/sessions";
import { visibleStoryEvents } from "@/lib/story/skill-runner";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import type { StoryEvent, StoryRun } from "@/lib/story/types";

function withoutGuidance(text: string) {
  return text
    .replaceAll("，可以在画布逐项查看明细。", "。")
    .replaceAll("，并可跳转到对应图表继续核对。", "。")
    .replaceAll(
      "以上为模拟业务快照，可继续运行订单分车或分车计划模拟。",
      "以上统计使用同一份模拟业务快照。",
    )
    .replaceAll(
      "可在订单画布逐店、逐车次查看配载及卸货明细，再进入分车计划模拟。",
      "订单、配载及卸货明细已同步至画布。",
    );
}

function CuiText({ text, active = false }: { text: string; active?: boolean }) {
  const { t: translateText, locale: interfaceLocale } = useI18n();

  text = withoutGuidance(text);
  const parts = text.split(/\n\s*\n/).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const lines = part.split("\n").filter(Boolean);
        const bullet = lines.every((line) => /^(?:[-•]\s|\d+\.\s)/.test(line));
        return bullet ? (
          <ul key={index}>
            {lines.map((line, lineIndex) => (
              <li key={lineIndex}>
                {translateText(line.replace(/^(?:[-•]\s|\d+\.\s)/, ""))}
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>{translateText(part)}</p>
        );
      })}
      {active && <i className="cui-stream-cursor" />}
    </>
  );
}

function CuiStep({
  event,
  run,
  active,
}: {
  event: StoryEvent;
  run: StoryRun;
  active: boolean;
}) {
  const { t: translateText, locale: interfaceLocale } = useI18n();

  const [expanded, setExpanded] = useState<boolean | null>(null);
  const thinking = event.role === "analysis" || event.role === "thinking";
  const note = event.role === "agent";
  const open = expanded ?? active;
  const label = thinking
    ? active
      ? "正在思考中"
      : "Thinking"
    : event.role === "plan"
      ? "任务规划"
      : event.role === "validation"
        ? "校验"
        : event.role === "data"
          ? "ReadFile"
          : event.operation?.includes("read")
            ? "ReadFile"
            : "Shell";
  if (note && event.operation === "阶段总结" && run.status === "complete")
    return null;
  return (
    <section
      className={`story-cui-event cui-timeline-step ${thinking ? "thinking" : note ? "note" : event.role} ${active ? "active" : "complete"}`}
      data-testid="story-cui-event"
      data-event-id={event.id}
    >
      <span className="cui-timeline-marker" aria-hidden="true">
        {thinking || event.role === "plan" ? (
          <BrainCircuit size={17} />
        ) : note ? (
          <Bot size={13} />
        ) : (
          <i />
        )}
      </span>
      {note ? (
        <div className="cui-agent-note">
          <CuiText text={event.detail} active={active} />
        </div>
      ) : (
        <div className={`cui-step-card ${open ? "expanded" : ""}`}>
          <button
            type="button"
            className="cui-step-toggle"
            aria-expanded={open}
            aria-controls={`${event.id}-detail`}
            onClick={() => setExpanded(!open)}
          >
            <span className="cui-step-kind">{translateText(label)}</span>
            <strong title={translateText(event.title)}>
              {translateText(event.title)}
            </strong>
            {!open && (
              <span className="cui-step-status">
                {translateText(
                  active
                    ? run.status === "paused"
                      ? "暂停"
                      : "进行中"
                    : "完成",
                )}
              </span>
            )}
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <div
            className="cui-step-detail"
            role="region"
            aria-label={translateText(`${translateText(event.title)}详情`)}
            tabIndex={0}
            id={`${event.id}-detail`}
            hidden={!open}
          >
            <CuiText text={event.detail} active={active} />
            {translateText(
              event.operation &&
                !["思考", "规划", "阶段总结"].includes(event.operation) && (
                  <code>{translateText(event.operation)}</code>
                ),
            )}
            {!!event.sources?.length && (
              <footer>
                {event.sources.map((source) => (
                  <small key={source}>{translateText(source)}</small>
                ))}
              </footer>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CuiAnswer({
  run,
  message,
  processOpen,
  onToggleProcess,
}: {
  run: StoryRun;
  message: StoryMessage;
  processOpen: boolean;
  onToggleProcess: () => void;
}) {
  const { t: translateText, locale: interfaceLocale } = useI18n();

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const copyTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const seconds = Math.ceil(run.elapsed / 1000);
  const duration =
    seconds >= 60
      ? `${Math.floor(seconds / 60)}分钟 ${seconds % 60}秒`
      : `${seconds}秒`;
  const startedAt =
    message.createdAt ??
    (message.id > 1_000_000_000_000
      ? new Date(message.id).toISOString()
      : undefined);
  const finishedAt = run.completedAt
    ? new Date(run.completedAt)
    : startedAt
      ? new Date(new Date(startedAt).getTime() + run.elapsed)
      : undefined;
  const validTime =
    finishedAt && !Number.isNaN(finishedAt.getTime()) ? finishedAt : undefined;
  const time =
    validTime?.toLocaleTimeString(interfaceLocale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) ?? "--:--";
  const answer = withoutGuidance(
    run.answer ?? run.planningSummary ?? "任务已完成。",
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(translateText(answer));
      setCopied(true);
      setCopyError(false);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyError(true);
    }
  };
  return (
    <section
      className="story-run-answer cui-final-answer"
      data-testid="cui-final-answer"
    >
      <button
        type="button"
        className="cui-duration"
        aria-expanded={processOpen}
        onClick={onToggleProcess}
      >
        {translateText("用时 ")}
        {translateText(duration)}
        <ChevronRight size={15} />
      </button>
      <div className="cui-answer-content">
        <CuiText text={answer} />
      </div>
      <footer
        className="cui-response-actions"
        aria-label={translateText("回复操作")}
      >
        <button
          type="button"
          aria-label={translateText(copied ? "已复制" : "复制回复")}
          title={translateText(copied ? "已复制" : "复制回复")}
          onClick={copy}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
        <button
          type="button"
          aria-label={translateText("回复优秀")}
          title={translateText("回复优秀")}
          aria-pressed={feedback === "up"}
          onClick={() => setFeedback(feedback === "up" ? null : "up")}
        >
          <ThumbsUp size={15} />
        </button>
        <button
          type="button"
          aria-label={translateText("回复不佳")}
          title={translateText("回复不佳")}
          aria-pressed={feedback === "down"}
          onClick={() => setFeedback(feedback === "down" ? null : "down")}
        >
          <ThumbsDown size={15} />
        </button>
        <button
          type="button"
          aria-label={translateText("展开回复")}
          title={translateText("展开回复")}
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={15} />
        </button>
        <time
          dateTime={validTime?.toISOString()}
          title={translateText(validTime?.toLocaleString(interfaceLocale))}
        >
          {translateText(time)}
        </time>
        {copyError && (
          <span role="status">
            {translateText("复制失败，请展开回复后选择文字复制。")}
          </span>
        )}
      </footer>
      <dialog
        ref={dialog}
        className="cui-answer-dialog"
        aria-label={translateText("完整回复")}
        onClose={() => setExpanded(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setExpanded(false);
        }}
      >
        <header>
          <strong>{translateText("完整回复")}</strong>
          <button
            type="button"
            aria-label={translateText("关闭完整回复")}
            onClick={() => setExpanded(false)}
          >
            <X size={18} />
          </button>
        </header>
        <div>
          <CuiText text={answer} />
        </div>
      </dialog>
    </section>
  );
}

export default function StoryRunResponse({
  run,
  message,
  onToggleRun,
}: {
  run: StoryRun;
  message: StoryMessage;
  onToggleRun: (runId: string) => void;
}) {
  const { t: translateText, locale: interfaceLocale } = useI18n();

  const [processOpen, setProcessOpen] = useState(true);
  const events = visibleStoryEvents(run);
  let cursor = 0;
  return (
    <div className="story-run-trace">
      <div
        className="cui-event-stream"
        role="log"
        aria-label={translateText(
          `${resolveStorySkill(run.command)?.title}过程`,
        )}
        hidden={!processOpen}
      >
        {events.map((event) => {
          cursor += event.duration;
          return (
            <CuiStep
              key={event.id}
              event={event}
              run={run}
              active={run.elapsed < cursor}
            />
          );
        })}
      </div>
      {(run.status === "running" || run.status === "paused") && (
        <div className="cui-run-progress">
          <div>
            <i style={{ width: `${(run.elapsed / run.duration) * 100}%` }} />
          </div>
          <span>
            {translateText(
              run.status === "paused" ? "已暂停" : "正在生成分析与画布",
            )}{" "}
            ·{translateText(" ")}
            {Math.round((run.elapsed / run.duration) * 100)}%
          </span>
          <button type="button" onClick={() => onToggleRun(run.id)}>
            {run.status === "running" ? (
              <Pause size={12} />
            ) : (
              <Play size={12} />
            )}
            {translateText(run.status === "running" ? "暂停" : "继续")}
          </button>
        </div>
      )}
      {run.status === "complete" && (
        <CuiAnswer
          run={run}
          message={message}
          processOpen={processOpen}
          onToggleProcess={() => setProcessOpen(!processOpen)}
        />
      )}
    </div>
  );
}
