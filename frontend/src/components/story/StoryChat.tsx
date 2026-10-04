"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Pause, Play, Send, Sparkles, X } from "lucide-react";
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
  open,
  onClose,
}: {
  campaign: CampaignState;
  messages: StoryMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (value: string) => void;
  onToggleRun: (runId: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [highlighted, setHighlighted] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const menuOpen = draft.trimStart().startsWith("/") && !draft.trimStart().includes(" ");
  const query = draft.trim().toLowerCase();
  const options = useMemo(
    () => storySkills.filter((skill) => skill.command.startsWith(query || "/")),
    [query],
  );
  useEffect(() => setHighlighted(0), [query]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, campaign.runs]);

  function choose(index: number) {
    const skill = options[index];
    if (!skill) return;
    onDraft(`${skill.command} ${skill.defaultPrompt}`);
  }

  return (
    <aside className={`story-chat ${open ? "open" : ""}`} aria-label="Agent CUI">
      <header className="story-chat-head">
        <span className="story-agent-mark"><Bot size={17} /></span>
        <div><strong>ATLAS Agent</strong><small>CUI · Skill 驱动</small></div>
        <span className="story-online"><i /> online</span>
        <button type="button" className="story-chat-close" aria-label="关闭 CUI" onClick={onClose}><X size={15} /></button>
      </header>
      <div className="story-chat-body" ref={bodyRef}>
        <div className="story-agent-intro">
          <Sparkles size={15} />
          <p>输入 <kbd>/</kbd> 选择一段故事。选择只会带出提示词，按回车后才开始分析。</p>
        </div>
        {messages.map((message) => {
          const run = message.storyRunId
            ? campaign.runs.find((item) => item.id === message.storyRunId)
            : undefined;
          return (
            <article
              key={message.id}
              className={`story-message ${message.role}`}
              data-testid={message.role === "user" ? "story-user-message" : "story-agent-message"}
            >
              {message.title && <strong>{message.title}</strong>}
              <p>{message.text}</p>
              {run && (
                <div className="story-run-trace">
                  {visibleStoryEvents(run).map((event, index) => (
                    <div className="story-cui-event" data-testid="story-cui-event" key={event.id}>
                      <span>{index + 1}</span><div><strong>{event.title}</strong><p>{event.detail}</p></div>
                    </div>
                  ))}
                  {run.status === "blocked" && <div className="story-run-warning">{run.blockedReason}</div>}
                  {(run.status === "running" || run.status === "paused") && (
                    <button type="button" className="story-run-toggle" onClick={() => onToggleRun(run.id)}>
                      {run.status === "running" ? <Pause size={13} /> : <Play size={13} />}
                      {run.status === "running" ? "暂停" : "继续"}
                    </button>
                  )}
                  {run.status === "complete" && <div className="story-run-answer">{run.answer}</div>}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="story-composer">
        {menuOpen && (
          <div className="story-skill-menu" role="listbox">
            <div className="story-skill-menu-title">选择故事 Skill</div>
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
                  <span><strong>{skill.command}</strong><small>{skill.title}</small></span>
                  <em>{skill.description}<small>{availability.available ? "已解锁" : "等待前序 Skill"}</small></em>
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
              setHighlighted((value) => Math.min(options.length - 1, value + 1));
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
          <span><kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
          <button type="button" aria-label="发送" onClick={() => draft.trim() && onSubmit(draft.trim())}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
