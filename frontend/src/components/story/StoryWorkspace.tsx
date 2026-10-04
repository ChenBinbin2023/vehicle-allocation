"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ChevronRight, MessageSquare, Plus } from "lucide-react";
import type { Session, SessionSnapshot, StoryMessage } from "@/lib/sessions";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import {
  advanceStoryRun,
  applyStoryRunResult,
  markStoryRunStale,
  startStoryRun,
} from "@/lib/story/skill-runner";
import type { StoryStage } from "@/lib/story/types";
import { approveDailyDecision } from "@/lib/story/rebalance-engine";
import StoryChat from "./StoryChat";
import StoryProgress from "./StoryProgress";
import StreamingCanvas from "./StreamingCanvas";

export default function StoryWorkspace({
  session,
  sessions,
  snapshot,
  onSnapshot,
  onSelectSession,
  onNewSession,
}: {
  session: Session;
  sessions: Session[];
  snapshot: SessionSnapshot;
  onSnapshot: (id: string, snapshot: SessionSnapshot) => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  const [campaign, setCampaign] = useState(snapshot.campaign);
  const [messages, setMessages] = useState<StoryMessage[]>(snapshot.messages);
  const [draft, setDraft] = useState(snapshot.draft);
  const [activeStage, setActiveStage] = useState<StoryStage | "welcome">(snapshot.activeStage);
  const [viewedRunId, setViewedRunId] = useState<string | null>(snapshot.campaign.activeRunId);
  const [chatOpen, setChatOpen] = useState(true);
  const busy = campaign.runs.some((run) => run.status === "running");

  useEffect(() => {
    if (window.innerWidth <= 1100) setChatOpen(false);
  }, []);

  useLayoutEffect(() => {
    onSnapshot(session.id, {
      ...snapshot,
      campaign,
      messages,
      draft,
      activeStage,
      canvasMode: "business",
    });
  }, [activeStage, campaign, draft, messages, onSnapshot, session.id]);

  useEffect(() => {
    if (!busy) return;
    let previous = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = now - previous;
      previous = now;
      setCampaign((current) => {
        const active = current.runs.find((run) => run.id === current.activeRunId);
        if (!active || active.status !== "running") return current;
        const advanced = advanceStoryRun(active, delta);
        const withRun = {
          ...current,
          runs: current.runs.map((run) => run.id === advanced.id ? advanced : run),
        };
        return advanced.status === "complete"
          ? applyStoryRunResult(withRun, advanced)
          : withRun;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [busy]);

  function submit(value: string) {
    if (campaign.runs.some((run) => run.status === "running" || run.status === "paused")) return;
    const skill = resolveStorySkill(value);
    const now = Date.now();
    if (!skill) {
      setMessages((current) => [
        ...current,
        { id: now, role: "user", text: value },
        { id: now + 1, role: "agent", title: "未找到这个 Skill", text: "输入 / 从五段供应保障故事中选择。" },
      ]);
      setDraft("");
      return;
    }
    const prompt = value.slice(skill.command.length).trim() || skill.defaultPrompt;
    const run = startStoryRun(skill.command, prompt, campaign);
    if (run.status === "blocked") {
      setMessages((current) => [
        ...current,
        { id: now, role: "user", text: value },
        {
          id: now + 1,
          role: "agent",
          title: "前置条件尚未满足",
          text: run.blockedReason ?? "当前不可运行",
        },
      ]);
      setDraft("");
      return;
    }
    setCampaign((current) => ({
      ...current,
      activeRunId: run.id,
      runs: [...current.runs, run],
    }));
    setMessages((current) => [
      ...current,
      { id: now, role: "user", text: value },
      {
        id: now + 1,
        role: "agent",
        title: `${skill.title}已启动`,
        text: "我会同步生成 CUI 推理轨迹和中间业务工作台。",
        storyRunId: run.id,
      },
    ]);
    setActiveStage(skill.stage);
    setViewedRunId(run.id);
    setDraft("");
  }

  function selectStage(stage: StoryStage) {
    const command = {
      crisis: "/crisis-brief",
      allocation: "/vessel-allocation",
      delivery: "/delivery-plan",
      execution: "/arrival-execution",
      rebalance: "/daily-rebalance",
    } as const;
    const latest = campaign.runs.filter((run) => run.command === command[stage]).at(-1);
    setActiveStage(stage);
    setViewedRunId(latest?.id ?? null);
  }

  function changeDammamSafety() {
    setCampaign((current) => {
      const latestAllocationRun = current.runs
        .filter((run) => run.command === "/vessel-allocation")
        .at(-1);
      if (
        latestAllocationRun?.id !== viewedRunId ||
        current.deliveryPlan ||
        current.inventoryBaseline ||
        current.dailyOperations.length > 0
      ) {
        return current;
      }
      const newVersion = current.version + 1;
      const nextSafety = 120;
      return {
        ...current,
        version: newVersion,
        planningParameters: { ...current.planningParameters, dammamSafetyStock: nextSafety },
        allocation: current.allocation ? { ...current.allocation, status: "stale" } : null,
        deliveryPlan: null,
        runs: current.runs.map((run) =>
          run.id === viewedRunId ? markStoryRunStale(run, newVersion) : run,
        ),
        auditTrail: [
          ...current.auditTrail,
          {
            id: `AUDIT-DMM-SAFETY-${newVersion}`,
            at: "T-10",
            action: "change_planning_parameter",
            detail: `达曼安全库存从 ${current.planningParameters.dammamSafetyStock} 台调整为 ${nextSafety} 台`,
          },
        ],
      };
    });
  }

  function toggleRun(runId: string) {
    setCampaign((current) => ({
      ...current,
      runs: current.runs.map((run) => run.id === runId && (run.status === "running" || run.status === "paused")
        ? { ...run, status: run.status === "running" ? "paused" : "running" }
        : run),
    }));
  }

  return (
    <div className="story-shell" data-testid="story-shell">
      <aside className="story-sidebar">
        <div className="story-brand"><span>AT</span><div><strong>ATLAS</strong><small>Vehicle Supply Agent</small></div></div>
        <div className="story-session-head"><span>工作会话</span><button type="button" onClick={onNewSession} aria-label="新建 Session"><Plus size={15} /></button></div>
        <div className="story-session-list">
          {sessions.map((item) => (
            <button type="button" key={item.id} onClick={() => onSelectSession(item.id)} className={item.id === session.id ? "active" : ""}>
              <span><i />{item.title}</span><ChevronRight size={13} />
            </button>
          ))}
        </div>
        <StoryProgress campaign={campaign} activeStage={activeStage} onSelect={selectStage} />
        <div className="story-sidebar-foot"><span>JED · Single Port</span><small>Demo data · v3</small></div>
      </aside>
      <StreamingCanvas
        campaign={campaign}
        activeStage={activeStage}
        viewedRunId={viewedRunId}
        onSelectRun={setViewedRunId}
        onChangeDammamSafety={changeDammamSafety}
        onApprove={(decisionId) => setCampaign((current) => approveDailyDecision(current, decisionId))}
      />
      <button type="button" className="story-mobile-chat-toggle" data-testid="mobile-chat-toggle" aria-label="打开 Agent CUI" onClick={() => setChatOpen(true)}><MessageSquare size={17} /></button>
      <StoryChat campaign={campaign} messages={messages} draft={draft} onDraft={setDraft} onSubmit={submit} onToggleRun={toggleRun} open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
