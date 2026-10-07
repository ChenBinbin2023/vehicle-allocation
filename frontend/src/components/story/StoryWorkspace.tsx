"use client";
import {
  hydrateVesselScenario,
  reviseVesselScenario,
  selectVesselScenarioVersion,
} from "@/lib/story/vessel-scenario";

import { useEffect, useLayoutEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
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
import type { PlanningRunOptions } from "@/lib/story/store-planning-run";
import StoryChat from "./StoryChat";
import WorkspaceSidebar, { type WorkspaceView } from "./WorkspaceSidebar";
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
  const [campaign, setCampaign] = useState(() => ({
    ...snapshot.campaign,
    runs: snapshot.campaign.runs.map(hydrateVesselScenario),
  }));
  const [messages, setMessages] = useState<StoryMessage[]>(snapshot.messages);
  const [draft, setDraft] = useState(snapshot.draft);
  const [activeStage, setActiveStage] = useState<StoryStage | "welcome">(
    snapshot.activeStage,
  );
  const [viewedRunId, setViewedRunId] = useState<string | null>(
    snapshot.campaign.activeRunId,
  );
  const [chatOpen, setChatOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(
    snapshot.activeStage === "welcome" ? "overview" : "task",
  );
  const [focusedStep, setFocusedStep] = useState<number | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
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
        const active = current.runs.find(
          (run) => run.id === current.activeRunId,
        );
        if (!active || active.status !== "running") return current;
        const advanced = advanceStoryRun(active, delta);
        const withRun = {
          ...current,
          runs: current.runs.map((run) =>
            run.id === advanced.id ? advanced : run,
          ),
        };
        return advanced.status === "complete"
          ? applyStoryRunResult(withRun, advanced)
          : withRun;
      });
    }, 80);
    return () => window.clearInterval(timer);
  }, [busy]);

  function submit(value: string, options: PlanningRunOptions = {}) {
    if (
      campaign.runs.some(
        (run) => run.status === "running" || run.status === "paused",
      )
    )
      return;
    const skill = resolveStorySkill(value);
    const now = Date.now();
    if (!skill) {
      setMessages((current) => [
        ...current,
        { id: now, role: "user", text: value },
        {
          id: now + 1,
          role: "agent",
          title: "未找到这个 Skill",
          text: "输入 / 选择供应链分析能力。",
        },
      ]);
      setDraft("");
      return;
    }
    const prompt =
      value.slice(skill.command.length).trim() || skill.defaultPrompt;
    const run = startStoryRun(skill.command, prompt, campaign, options);
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
        text:
          skill.command === "/smart-query"
            ? "我会从本地数据读取销量、库存和路线费用，逐步生成三个分析视图。思考、规划与工具调用均为演示记录，可点击查看对应结果。"
            : skill.command === "/vessel-allocation"
              ? "我会先生成截至 2026-08-05 的模拟基本统计，展示本船车型、订单缺口和全网销速库存。工作台可切换分车图谱、分车计划模拟与门店结果；点击过程记录可返回基本统计。"
              : "我会读取业务快照，展示采用的规则、候选方案与校验结果。点击过程记录可以查看画布中的对应依据。",
        storyRunId: run.id,
      },
    ]);
    setActiveStage(skill.stage);
    setViewedRunId(run.id);
    setFocusedStep(null);
    setWorkspaceView("task");
    setDraft("");
  }

  function selectRun(runId: string, step: number | null = null) {
    const run = campaign.runs.find((item) => item.id === runId);
    const skill = run && resolveStorySkill(run.command);
    if (!skill) return;
    setActiveStage(skill.stage);
    setViewedRunId(runId);
    setWorkspaceView("task");
    setFocusedStep(step);
    setFocusRevision((value) => value + 1);
  }

  function changeDammamSafety(nextSafety = 120) {
    setCampaign((current) => {
      const latestAllocationRun = current.runs
        .filter((run) => run.command === "/vessel-allocation")
        .at(-1);
      if (
        latestAllocationRun?.id !== viewedRunId ||
        (current.deliveryPlan && current.deliveryPlan.status !== "blocked") ||
        current.inventoryBaseline ||
        current.dailyOperations.length > 0 ||
        latestAllocationRun.status !== "complete" ||
        current.planningParameters.dammamSafetyStock === nextSafety
      ) {
        return current;
      }
      const newVersion = current.version + 1;
      return {
        ...current,
        version: newVersion,
        planningParameters: {
          ...current.planningParameters,
          dammamSafetyStock: nextSafety,
        },
        allocation: current.allocation
          ? { ...current.allocation, status: "stale" }
          : null,
        deliveryPlan: null,
        runs: current.runs.map((run) =>
          run.id === viewedRunId || run.command === "/delivery-plan"
            ? markStoryRunStale(run, newVersion)
            : run,
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
    setDraft(
      `/vessel-allocation 按达曼 ${nextSafety} 台自由安全库存重新分车，保护 620 台已确认订单，并说明利雅得库存的变化。`,
    );
  }

  function toggleRun(runId: string) {
    setCampaign((current) => ({
      ...current,
      runs: current.runs.map((run) =>
        run.id === runId &&
        (run.status === "running" || run.status === "paused")
          ? { ...run, status: run.status === "running" ? "paused" : "running" }
          : run,
      ),
    }));
  }

  return (
    <div
      className={`story-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${chatOpen ? "" : " chat-closed"}`}
      data-testid="story-shell"
    >
      <WorkspaceSidebar
        sessions={sessions}
        activeId={session.id}
        view={workspaceView}
        onView={setWorkspaceView}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
      />
      <StreamingCanvas
        campaign={campaign}
        activeStage={activeStage}
        viewedRunId={viewedRunId}
        onSelectRun={selectRun}
        focusedStep={focusedStep}
        focusRevision={focusRevision}
        workspaceView={workspaceView}
        sessionTitle={session.title}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        onChangeDammamSafety={changeDammamSafety}
        busy={busy || campaign.runs.some((run) => run.status === "paused")}
        onRunProfit={(profitInput, deliveryRunId) =>
          submit(
            "/profit-analysis 按已选物流快照和当前销售情景分析贡献利润。",
            { profitInput, deliveryRunId },
          )
        }
        onSaveScenario={(runId, action) => {
          setCampaign((current) => ({
            ...current,
            runs: current.runs.map((run) => {
              if (run.id !== runId || run.status !== "complete") return run;
              return action.versionId
                ? selectVesselScenarioVersion(run, action.versionId)
                : action.parameters
                  ? reviseVesselScenario(
                      run,
                      action.parameters,
                      action.reason ?? "参数调整",
                    )
                  : run;
            }),
          }));
        }}
        onRunPlanning={(command, input, allocationRunId) => {
          const detail =
            "supply" in input
              ? input.replenishment
                ? `门店补库 总量=${input.replenishment.supply} 预留比例=${input.replenishment.reserveRatio * 100}% 级差=${input.replenishment.channelGap * 100}%；按当前参数重跑。`
                : `供给=${input.supply} 直营WoS=${input.targetDirect} 授权WoS=${input.targetAuthorized}；按当前门店快照模拟。`
              : `${input.mode === "single" ? "单港" : "双港"}到店模拟；D2接车=${input.stores.find((s) => s.id === "D2")?.firstCapacity ?? 0}；按当前接车和 VPC 容量重算。`;
          submit(command + " " + detail, { input, allocationRunId });
        }}
        onApprove={(decisionId) =>
          setCampaign((current) => approveDailyDecision(current, decisionId))
        }
      />
      <button
        type="button"
        className="story-mobile-chat-toggle"
        data-testid="mobile-chat-toggle"
        aria-label="打开 Agent CUI"
        onClick={() => setChatOpen(true)}
      >
        <MessageSquare size={17} />
      </button>
      <StoryChat
        campaign={campaign}
        messages={messages}
        draft={draft}
        onDraft={setDraft}
        onSubmit={submit}
        onToggleRun={toggleRun}
        onViewEvidence={selectRun}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
