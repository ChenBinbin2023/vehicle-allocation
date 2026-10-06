"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Pause,
  Play,
  Send,
  Sparkles,
  X,
  Wrench,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import type { StoryMessage } from "@/lib/sessions";
import { skillAvailability, storySkills } from "@/lib/story/skill-catalog";
import { visibleStoryEvents } from "@/lib/story/skill-runner";
import type { CampaignState } from "@/lib/story/types";

export default function StoryChat({
  campaign,
  messages,
  draft,
  onDraft,
  onSubmit,
  onToggleRun,
  onViewEvidence,
  open,
  onClose,
}: {
  campaign: CampaignState;
  messages: StoryMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (value: string) => void;
  onToggleRun: (runId: string) => void;
  onViewEvidence: (runId: string, step: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [highlighted, setHighlighted] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const menuOpen =
    draft.trimStart().startsWith("/") && !draft.trimStart().includes(" ");
  const query = draft.trim().toLowerCase();
  const options = useMemo(
    () => storySkills.filter((skill) => skill.command.startsWith(query || "/")),
    [query],
  );
  useEffect(() => setHighlighted(0), [query]);
  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, campaign.runs]);

  function choose(index: number) {
    const skill = options[index];
    if (!skill) return;
    onDraft(`${skill.command} ${skill.defaultPrompt}`);
  }

  return (
    <aside
      className={`story-chat ${open ? "open" : ""}`}
      aria-label="Agent CUI"
      inert={!open}
    >
      <header className="story-chat-head">
        <span className="story-agent-mark">
          <Bot size={17} />
        </span>
        <div>
          <strong>ATLAS Agent</strong>
          <small>CUI · Skill 驱动</small>
        </div>
        <span className="story-online">
          <i /> online
        </span>
        <button
          type="button"
          className="story-chat-close"
          aria-label="关闭 CUI"
          title="关闭 CUI"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </header>
      <div className="story-chat-body" ref={bodyRef}>
        <div className="story-agent-intro">
          <Sparkles size={15} />
          <p>
            输入 <kbd>/</kbd>{" "}
            选择能力。告诉我业务目标和约束，我会给出可追溯的方案。
          </p>
        </div>
        {messages.map((message) => {
          const run = message.storyRunId
            ? campaign.runs.find((item) => item.id === message.storyRunId)
            : undefined;
          return (
            <article
              key={message.id}
              className={`story-message ${message.role}`}
              data-testid={
                message.role === "user"
                  ? "story-user-message"
                  : "story-agent-message"
              }
            >
              {message.title && <strong>{message.title}</strong>}
              <p>{message.text}</p>
              {run && (
                <div className="story-run-trace">
                  {visibleStoryEvents(run).map((event, index) => (
                    <div
                      className={`story-cui-event ${run.query || run.planning || run.profit ? `query-cui-event ${event.role}` : ""}`}
                      data-testid="story-cui-event"
                      key={event.id}
                    >
                      <span>{index + 1}</span>
                      <div>
                        {(run.query || run.planning || run.profit) && (
                          <small className="query-cui-kind">
                            {event.role === "tool" ? (
                              <Wrench size={12} />
                            ) : event.role === "plan" ? (
                              <ListChecks size={12} />
                            ) : event.role === "agent" ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <Sparkles size={12} />
                            )}
                            {event.role === "tool"
                              ? "调用工具"
                              : event.role === "plan"
                                ? "规划"
                                : event.role === "agent"
                                  ? "阶段总结"
                                  : "思考"}
                          </small>
                        )}
                        {event.operation &&
                          (!(run.query || run.planning || run.profit) ||
                            !["思考", "规划", "阶段总结"].includes(
                              event.operation,
                            )) && (
                            <small className="cui-operation-label">
                              {event.operation}
                            </small>
                          )}
                        <strong>{event.title}</strong>
                        <p>{event.detail}</p>
                        {event.sources && (
                          <footer>
                            {event.sources.map((source) => (
                              <small key={source}>{source}</small>
                            ))}
                          </footer>
                        )}
                        {(run.evidence ||
                          event.canvasTab ||
                          event.planningTab ||
                          event.profitTab) && (
                          <button
                            type="button"
                            className="cui-evidence-link"
                            onClick={() =>
                              onViewEvidence(
                                run.id,
                                run.evidence
                                  ? Math.min(
                                      index,
                                      run.evidence.steps.length - 1,
                                    )
                                  : index,
                              )
                            }
                          >
                            {event.profitTab
                              ? `查看${event.profitTab === "orders" ? "订单利润" : event.profitTab === "models" ? "车型利润" : "门店利润"}`
                              : event.planningTab
                                ? `查看${event.planningTab === "overview" ? "基本统计" : event.planningTab === "graph" ? (event.operation === "vessel.orders.logistics" ? "物流建议" : event.operation === "vessel.orders.read" ? "订单分车" : "分车图谱") : event.planningTab === "water" ? "注水演示" : event.planningTab === "allocation" ? "门店分车" : event.planningTab === "map" ? "路线地图" : event.planningTab === "routes" ? "到店路线" : event.planningTab === "compare" ? "港口比较" : "到店批次"}`
                                : event.canvasTab
                                  ? `查看${event.canvasTab === "sales" ? "销量与预测" : event.canvasTab === "inventory" ? "库存与渠道" : "陆路运输成本"}`
                                  : "查看判断依据"}{" "}
                            ↗
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {run.status === "blocked" && (
                    <div className="story-run-warning">{run.blockedReason}</div>
                  )}
                  {(run.status === "running" || run.status === "paused") && (
                    <>
                      {(run.query || run.planning || run.profit) && (
                        <div className="query-cui-progress">
                          <i
                            style={{
                              width: `${Math.min(100, (run.elapsed / run.duration) * 100)}%`,
                            }}
                          />
                          <span>
                            {run.status === "paused"
                              ? "已暂停"
                              : "分析结果同步生成到画布"}{" "}
                            · {Math.round((run.elapsed / run.duration) * 100)}%
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="story-run-toggle"
                        onClick={() => onToggleRun(run.id)}
                      >
                        {run.status === "running" ? (
                          <Pause size={13} />
                        ) : (
                          <Play size={13} />
                        )}
                        {run.status === "running" ? "暂停" : "继续"}
                      </button>
                    </>
                  )}
                  {run.status === "complete" && (
                    <div className="story-run-answer">
                      {(run.query || run.planning || run.profit) && (
                        <strong className="query-cui-summary">任务总结</strong>
                      )}
                      {run.answer}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="story-composer">
        {menuOpen && (
          <div className="story-skill-menu" role="listbox">
            <div className="story-skill-menu-title">供应链 Skills</div>
            {options.map((skill, index) => {
              const availability = skillAvailability(skill.command, campaign);
              return (
                <button
                  type="button"
                  key={skill.command}
                  className={`${index === highlighted ? "active" : ""} ${availability.available ? "available" : "unavailable"}`}
                  data-testid="story-skill-option"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(index)}
                >
                  <span>
                    <strong>{skill.command}</strong>
                    <small>{skill.title}</small>
                  </span>
                  <em>
                    {skill.description}
                    <small>
                      {availability.available ? "可运行" : availability.reason}
                    </small>
                  </em>
                </button>
              );
            })}
          </div>
        )}
        <textarea
          data-testid="story-command"
          value={draft}
          rows={3}
          placeholder="输入 / 选择 Skill…"
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (menuOpen && event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((value) =>
                Math.min(options.length - 1, value + 1),
              );
              return;
            }
            if (menuOpen && event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((value) => Math.max(0, value - 1));
              return;
            }
            if (menuOpen && event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              choose(highlighted);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (draft.trim()) onSubmit(draft.trim());
            }
          }}
        />
        <div className="story-composer-foot">
          <span>
            <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行
          </span>
          <button
            type="button"
            aria-label="发送"
            onClick={() => draft.trim() && onSubmit(draft.trim())}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
