"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, FileText, History, Ship } from "lucide-react";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import { visibleStoryBlocks } from "@/lib/story/skill-runner";
import type { CampaignState, StoryStage } from "@/lib/story/types";
import CrisisBlocks from "./blocks/CrisisBlocks";
import AllocationBlocks from "./blocks/AllocationBlocks";
import DeliveryBlocks from "./blocks/DeliveryBlocks";
import ExecutionBlocks from "./blocks/ExecutionBlocks";
import RebalanceBlocks from "./blocks/RebalanceBlocks";
import DecisionProcess from "./DecisionProcess";
import AllocationDecisionModel from "./AllocationDecisionModel";
import LogisticsDecisionModel from "./LogisticsDecisionModel";
import RebalanceDecisionModel from "./RebalanceDecisionModel";
import WorkspaceOverview from "./WorkspaceOverview";
import type { WorkspaceView } from "./WorkspaceSidebar";

const stageCommand = {
  crisis: "/crisis-brief",
  allocation: "/vessel-allocation",
  delivery: "/delivery-plan",
  execution: "/arrival-execution",
  rebalance: "/daily-rebalance",
} as const;

export default function StreamingCanvas({
  campaign,
  activeStage,
  viewedRunId,
  onSelectRun,
  onChangeDammamSafety,
  onApprove,
  focusedStep,
  workspaceView,
  sessionTitle,
}: {
  campaign: CampaignState;
  activeStage: StoryStage | "welcome";
  viewedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onChangeDammamSafety: (value?: number) => void;
  onApprove: (decisionId: string) => void;
  focusedStep: number | null;
  workspaceView: WorkspaceView;
  sessionTitle: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const stageRuns =
    activeStage === "welcome"
      ? []
      : campaign.runs.filter(
          (item) => item.command === stageCommand[activeStage],
        );
  const run =
    stageRuns.find((item) => item.id === viewedRunId) ?? stageRuns.at(-1);
  const taskVisible = workspaceView === "task" && run;
  const blocks = run ? visibleStoryBlocks(run) : [];
  const stale = blocks.some((block) => block.status === "stale");
  const latestAllocation = campaign.runs
    .filter((item) => item.command === "/vessel-allocation")
    .at(-1);
  const canChangeSafety =
    run?.id === latestAllocation?.id &&
    run?.status === "complete" &&
    !stale &&
    (!campaign.deliveryPlan || campaign.deliveryPlan.status === "blocked") &&
    !campaign.inventoryBaseline;
  const canApprove =
    run?.id ===
      campaign.runs.filter((item) => item.command === "/daily-rebalance").at(-1)
        ?.id && run?.status === "complete";
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [run?.id, workspaceView]);
  useEffect(() => {
    if (focusedStep !== null)
      mainRef.current
        ?.querySelector(".decision-process")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [focusedStep, run?.id]);
  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: PointerEvent) => {
      if (!historyRef.current?.contains(event.target as Node))
        setHistoryOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [historyOpen]);
  return (
    <div className="workspace-canvas-shell">
      <div className="workspace-canvas-toolbar">
        <div>
          <span>ALJ</span>
          <i>/</i>
          <strong>{sessionTitle}</strong>
        </div>
        <div className="canvas-history-control" ref={historyRef}>
          <button
            type="button"
            aria-label="画布历史"
            aria-expanded={historyOpen}
            data-testid="canvas-history-toggle"
            onClick={() => setHistoryOpen((value) => !value)}
          >
            <History size={15} />
            <span>画布历史</span>
            <small>{campaign.runs.length}</small>
          </button>
          {historyOpen && (
            <div
              className="canvas-history-menu"
              data-testid="canvas-history-menu"
            >
              <header>当前任务 · 分析画布</header>
              {[...campaign.runs].reverse().map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === run?.id ? "active" : ""}
                  data-testid="canvas-history-item"
                  data-run-command={item.command}
                  onClick={() => {
                    onSelectRun(item.id);
                    setHistoryOpen(false);
                  }}
                >
                  <FileText size={14} />
                  <div>
                    <strong>{resolveStorySkill(item.command)?.title}</strong>
                    <small>
                      {item.businessDate} · v{item.inputVersion} ·{" "}
                      {item.blocks.some((block) => block.status === "stale")
                        ? "输入已变更"
                        : item.status === "complete"
                          ? "已保存"
                          : "运行中"}
                    </small>
                  </div>
                </button>
              ))}
              {!campaign.runs.length && (
                <p>尚无分析画布，请在 CUI 发起任务。</p>
              )}
            </div>
          )}
        </div>
      </div>
      <main
        className="story-canvas"
        ref={mainRef}
        data-testid={taskVisible ? "story-run-block" : "workspace-overview"}
      >
        {!taskVisible ? (
          <WorkspaceOverview
            campaign={campaign}
            mode={workspaceView === "data" ? "data" : "overview"}
            onViewRun={onSelectRun}
          />
        ) : (
          <>
            <header className="story-canvas-head">
              <div>
                <span>{run.command}</span>
                <h1>{resolveStorySkill(run.command)?.title}</h1>
                <p>{run.prompt.replace(run.command, "").trim()}</p>
              </div>
              <div
                className={`story-run-state ${stale ? "stale" : run.status}`}
              >
                <i />
                {stale
                  ? "输入已变更"
                  : run.status === "complete"
                    ? "已完成"
                    : run.status === "paused"
                      ? "已暂停"
                      : "Agent 运行中"}
              </div>
            </header>
            <div className="story-canvas-meta">
              <span>
                <Ship size={14} />
                JEDDAH HORIZON · 1,800 台
              </span>
              <span>
                <Clock3 size={14} />
                {run.businessDate}
              </span>
              <span>输入版本 v{run.inputVersion}</span>
              <span>本地演示快照</span>
            </div>
            <DecisionProcess key={run.id} run={run} focusedStep={focusedStep} />
            <div className="story-block-stream">
              {blocks.map((block) => {
                let content;
                if (block.status === "streaming")
                  content = (
                    <div className="block-loading">
                      <i />
                      <i />
                      <i />
                      <p>正在汇总本轮数据与判断依据…</p>
                    </div>
                  );
                else if (block.type === "allocation-logic" && run.evidence)
                  content = (
                    <AllocationDecisionModel
                      key={run.id}
                      evidence={run.evidence}
                      canApply={Boolean(canChangeSafety)}
                      stale={stale}
                      onApply={onChangeDammamSafety}
                    />
                  );
                else if (block.type === "delivery-logic" && run.evidence)
                  content = (
                    <LogisticsDecisionModel
                      key={run.id}
                      evidence={run.evidence}
                    />
                  );
                else if (
                  block.type === "rebalance-logic" &&
                  run.evidence?.dailyPlan
                )
                  content = (
                    <RebalanceDecisionModel
                      key={run.id}
                      evidence={run.evidence}
                      plan={
                        campaign.dailyOperations.find(
                          (plan) => plan.id === run.evidence?.dailyPlan?.id,
                        ) ?? run.evidence.dailyPlan
                      }
                      canApprove={Boolean(canApprove)}
                      onApprove={onApprove}
                    />
                  );
                else if (run.command === "/crisis-brief")
                  content = <CrisisBlocks block={block} campaign={campaign} />;
                else if (run.command === "/vessel-allocation")
                  content = (
                    <AllocationBlocks
                      block={block}
                      campaign={campaign}
                      canChangeDammamSafety={Boolean(canChangeSafety)}
                      onChangeDammamSafety={() => onChangeDammamSafety(120)}
                    />
                  );
                else if (run.command === "/delivery-plan")
                  content = (
                    <DeliveryBlocks block={block} campaign={campaign} />
                  );
                else if (run.command === "/arrival-execution")
                  content = (
                    <ExecutionBlocks block={block} campaign={campaign} />
                  );
                else
                  content = (
                    <RebalanceBlocks
                      block={block}
                      campaign={campaign}
                      canApprove={Boolean(canApprove)}
                      onApprove={onApprove}
                    />
                  );
                return (
                  <section
                    className={`story-block ${block.status} ${block.type.endsWith("-logic") ? "decision-model-block" : ""}`}
                    key={block.id}
                    data-block-type={block.type}
                  >
                    <div className="story-block-copy">
                      <div className="business-block-heading">
                        <h2>{block.title}</h2>
                        <div className="story-block-status">
                          <i />
                          {block.status === "streaming"
                            ? "生成中"
                            : block.status === "stale"
                              ? "已失效"
                              : "已就绪"}
                        </div>
                      </div>
                      {content}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
