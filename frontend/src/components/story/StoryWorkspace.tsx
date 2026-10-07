"use client";
import {
  hydrateVesselScenario,
  reviseVesselScenario,
  selectVesselScenarioVersion,
} from "@/lib/story/vessel-scenario";

import { useEffect, useLayoutEffect, useState } from "react";
import { MessageSquare, X, Sparkles } from "lucide-react";
import type {
  Folder,
  Session,
  SessionSnapshot,
  StoryMessage,
} from "@/lib/sessions";
import { resolveStorySkill, storySkills } from "@/lib/story/skill-catalog";
import {
  chooseDispatchOptions,
  dispatchFulfillmentPrompt,
} from "@/lib/story/dispatch-fulfillment";
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
  folders,
  snapshot,
  onSnapshot,
  onSelectSession,
  onNewSession,
  onProjectChange,
}: {
  session: Session;
  sessions: Session[];
  folders: Folder[];
  snapshot: SessionSnapshot;
  onSnapshot: (id: string, snapshot: SessionSnapshot) => void;
  onSelectSession: (id: string) => void;
  onNewSession: (folderId?: string) => void;
  onProjectChange: (folderId: string) => void;
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
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("task");
  const [canvasOpen, setCanvasOpen] = useState(
    snapshot.campaign.runs.length > 0,
  );
  const [focusedStep, setFocusedStep] = useState<number | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const busy = campaign.runs.some((run) => run.status === "running");

  useEffect(() => {
    if (window.innerWidth <= 1100 && snapshot.campaign.runs.length)
      setChatOpen(false);
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
    value = value.trim();
    if (!value) return;
    if (
      campaign.runs.some(
        (run) => run.status === "running" || run.status === "paused",
      )
    )
      return;
    const skill =
      resolveStorySkill(value) ??
      (!value.startsWith("/")
        ? resolveStorySkill(
            /缺货/.test(value) && /选择|选定|已选|采购订单|采购单/.test(value)
              ? "/shortage-fulfillment"
              : /每日调拨|调度计划|今天.*订单|今日.*订单/.test(value)
                ? "/daily-dispatch"
                : /模拟|补库|WoS|预留比例|价格系数|物流系数/.test(value)
                  ? "/vessel-allocation"
                  : /订单分车|分配订单|订单物流/.test(value)
                    ? "/order-allocation"
                    : "/query",
          )
        : undefined);
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
      (value.startsWith("/")
        ? value.replace(/^\/[^\s，,]+[\s，,]*/, "")
        : value) || skill.defaultPrompt;
    const viewedDispatch = campaign.runs.find(
      (r) => r.id === viewedRunId && r.dispatch,
    );
    const run = startStoryRun(skill.command, prompt, campaign, {
      ...options,
      ...(skill.command === "/shortage-fulfillment" &&
      !options.dispatchRunId &&
      viewedDispatch
        ? { dispatchRunId: viewedDispatch.id }
        : {}),
    });
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
        text: "",
        storyRunId: run.id,
        createdAt: new Date(now).toISOString(),
      },
    ]);
    setActiveStage(skill.stage);
    setViewedRunId(run.id);
    setFocusedStep(null);
    setWorkspaceView("task");
    setCanvasOpen(true);
    setDraft("");
  }

  function selectRun(runId: string, step: number | null = null) {
    const run = campaign.runs.find((item) => item.id === runId);
    const skill = run && resolveStorySkill(run.command);
    if (!skill) return;
    setActiveStage(skill.stage);
    setViewedRunId(runId);
    setWorkspaceView("task");
    setCanvasOpen(true);
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
      className={`story-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${chatOpen ? "" : " chat-closed"}${!canvasOpen ? " cui-only" : ""}`}
      data-testid="story-shell"
    >
      <WorkspaceSidebar
        sessions={sessions}
        folders={folders}
        activeId={session.id}
        activeFolderId={session.folderId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        view={workspaceView}
        onView={(view) => {
          setWorkspaceView(view);
          if (view !== "plugins") setCanvasOpen(true);
        }}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
      />
      {canvasOpen && (
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
          onCloseCanvas={() => {
            setCanvasOpen(false);
            setChatOpen(true);
            setWorkspaceView("task");
          }}
          onChangeDammamSafety={changeDammamSafety}
          busy={busy || campaign.runs.some((run) => run.status === "paused")}
          onSelectDispatch={(runId, selections) => {
            if (
              campaign.runs.some(
                (r) => r.status === "running" || r.status === "paused",
              )
            )
              return;
            setCampaign((current) => ({
              ...current,
              runs: current.runs.map((run) =>
                run.id === runId ? chooseDispatchOptions(run, selections) : run,
              ),
            }));
          }}
          onGenerateDispatch={(dispatchRunId) =>
            submit(`/shortage-fulfillment ${dispatchFulfillmentPrompt}`, {
              dispatchRunId,
            })
          }
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
      )}
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
        dispatchRunId={
          campaign.runs.find((run) => run.id === viewedRunId && run.dispatch)
            ?.id
        }
        fullWidth={!canvasOpen}
        folders={folders}
        folderId={session.folderId}
        onProjectChange={onProjectChange}
        onPlugins={() => setWorkspaceView("plugins")}
        onOpenCanvas={() => setCanvasOpen(true)}
        campaign={campaign}
        messages={messages}
        draft={draft}
        onDraft={setDraft}
        onSubmit={submit}
        onToggleRun={toggleRun}
        open={!canvasOpen || chatOpen}
        onClose={() => setChatOpen(false)}
      />
      {workspaceView === "plugins" && (
        <div
          className="workspace-plugin-backdrop"
          onClick={() => setWorkspaceView("task")}
        >
          <section
            className="workspace-plugin-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="插件与 Skills"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>BUILT-IN SKILLS</small>
                <h2>插件与 Skills</h2>
                <p>选择能力，在当前项目开始任务。</p>
              </div>
              <button
                type="button"
                aria-label="关闭插件"
                onClick={() => setWorkspaceView("task")}
              >
                <X size={18} />
              </button>
            </header>
            <div>
              {storySkills.map((skill) => (
                <button
                  type="button"
                  key={skill.command}
                  onClick={() => {
                    setDraft(`${skill.command} ${skill.defaultPrompt}`);
                    setWorkspaceView("task");
                    setChatOpen(true);
                  }}
                >
                  <Sparkles size={18} />
                  <strong>{skill.title}</strong>
                  <code>{skill.command}</code>
                  <p>{skill.description}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
