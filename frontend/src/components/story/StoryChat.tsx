"use client";

import { useEffect, useRef } from "react";
import { LayoutPanelLeft, Sparkles, X } from "lucide-react";
import type { Folder, StoryMessage } from "@/lib/sessions";
import type { CampaignState } from "@/lib/story/types";
import StoryComposer from "./StoryComposer";
import StoryRunResponse from "./StoryRunResponse";

export default function StoryChat({
  campaign,
  messages,
  draft,
  onDraft,
  onSubmit,
  onToggleRun,
  open,
  onClose,
  fullWidth,
  folders,
  folderId,
  onProjectChange,
  onPlugins,
  onOpenCanvas,
  dispatchRunId,
}: {
  campaign: CampaignState;
  messages: StoryMessage[];
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (value: string) => void;
  onToggleRun: (runId: string) => void;
  open: boolean;
  onClose: () => void;
  fullWidth: boolean;
  folders: Folder[];
  folderId: string;
  onProjectChange: (id: string) => void;
  onPlugins: () => void;
  onOpenCanvas: () => void;
  dispatchRunId?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const currentRun = campaign.runs.find(
    (run) => run.status === "running" || run.status === "paused",
  );
  const empty = !messages.length;
  useEffect(() => {
    if (following.current && bodyRef.current)
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, campaign.runs]);
  useEffect(() => {
    following.current = true;
  }, [messages.length]);
  return (
    <aside
      className={`story-chat ${open ? "open" : ""} ${fullWidth ? "cui-full" : ""} ${empty ? "cui-empty" : ""}`}
      aria-label="Agent CUI"
      inert={!open}
    >
      <header className="story-chat-head">
        {!fullWidth && (
          <>
            <span className="cui-agent-symbol">
              <Sparkles size={17} />
            </span>
            <div>
              <strong>ATLAS Agent</strong>
              <small>CUI · Skill 驱动</small>
            </div>
            <span className="story-online">
              <i /> ONLINE
            </span>
          </>
        )}
        {fullWidth && (
          <span className="cui-session-label">{empty ? "" : "任务对话"}</span>
        )}
        {campaign.runs.length > 0 && fullWidth && (
          <button
            type="button"
            className="cui-canvas-toggle"
            aria-label="打开 GUI 画布"
            onClick={onOpenCanvas}
          >
            <LayoutPanelLeft size={16} />
            画布
          </button>
        )}
        {!fullWidth && (
          <button
            type="button"
            className="story-chat-close"
            aria-label="关闭 CUI"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        )}
      </header>
      <div
        className="story-chat-body"
        ref={bodyRef}
        onScroll={() => {
          const node = bodyRef.current;
          if (node)
            following.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 80;
        }}
      >
        {empty ? (
          <div className="cui-welcome" data-testid="cui-welcome">
            <span>
              <Sparkles size={21} />
            </span>
            <h1>我们该处理什么工作?</h1>
            <p>输入第一句话，或键入 / 使用内置 Skill 开始任务。</p>
          </div>
        ) : (
          messages.map((message) => {
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
                {message.text && <p>{message.text}</p>}
                {run && (
                  <StoryRunResponse
                    run={run}
                    message={message}
                    onToggleRun={onToggleRun}
                  />
                )}
              </article>
            );
          })
        )}
      </div>
      <StoryComposer
        dispatchRunId={dispatchRunId}
        campaign={campaign}
        draft={draft}
        onDraft={onDraft}
        onSubmit={onSubmit}
        folders={folders}
        folderId={folderId}
        onProjectChange={onProjectChange}
        onPlugins={onPlugins}
        busy={currentRun?.status === "running"}
        paused={currentRun?.status === "paused"}
        onToggleRun={() => currentRun && onToggleRun(currentRun.id)}
      />
    </aside>
  );
}
