"use client";

import { ArrowRight, Clock3, Ship, Sparkles } from "lucide-react";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import { visibleStoryBlocks } from "@/lib/story/skill-runner";
import type { CampaignState, StoryStage } from "@/lib/story/types";
import CrisisBlocks from "./blocks/CrisisBlocks";
import AllocationBlocks from "./blocks/AllocationBlocks";
import DeliveryBlocks from "./blocks/DeliveryBlocks";
import ExecutionBlocks from "./blocks/ExecutionBlocks";
import RebalanceBlocks from "./blocks/RebalanceBlocks";

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
}: {
  campaign: CampaignState;
  activeStage: StoryStage | "welcome";
  viewedRunId: string | null;
  onSelectRun: (runId: string) => void;
  onChangeDammamSafety: () => void;
  onApprove: (decisionId: string) => void;
}) {
  const stageRuns = activeStage === "welcome"
    ? []
    : campaign.runs.filter((item) => item.command === stageCommand[activeStage]);
  const run = stageRuns.find((item) => item.id === viewedRunId) ?? stageRuns.at(-1);
  if (!run) {
    return (
      <main className="story-canvas story-welcome">
        <div className="story-welcome-kicker"><Sparkles size={14} /> JEDDAH SINGLE-PORT RESPONSE</div>
        <h1>从一船 1,800 台车，<br />到每天每一笔订单。</h1>
        <p>两周前先重做分车与物流网络；到港后 72 小时形成库存基线；此后每天由 Agent 求解发货、调拨与回购。</p>
        <div className="story-welcome-flow">
          <article><span>阶段 01</span><strong>T-14 → T+3</strong><p>单港影响 · 船次分车 · 物流计划 · 到港执行</p></article>
          <ArrowRight size={20} />
          <article><span>阶段 02</span><strong>T+4 起 · 每日</strong><p>订单池 · 候选车源 · 调拨回购 · 发货审批</p></article>
        </div>
        <div className="story-welcome-cta"><span>/</span><div><strong>请在右侧 CUI 输入 “/”</strong><small>选择 /crisis-brief 开始第一段故事</small></div></div>
      </main>
    );
  }
  const skill = resolveStorySkill(run.command);
  const blocks = visibleStoryBlocks(run);
  const stale = blocks.some((block) => block.status === "stale");
  const canChangeDammamSafety = run.command === "/vessel-allocation"
    && run.id === stageRuns.at(-1)?.id
    && !campaign.deliveryPlan
    && !campaign.inventoryBaseline
    && campaign.dailyOperations.length === 0;
  const BlockContent = run.command === "/crisis-brief"
    ? CrisisBlocks
    : run.command === "/vessel-allocation"
      ? AllocationBlocks
      : run.command === "/delivery-plan"
        ? DeliveryBlocks
        : ExecutionBlocks;
  return (
    <main className="story-canvas" data-testid="story-run-block">
      <header className="story-canvas-head">
        <div><span>{run.command}</span><h1>{skill?.title}</h1><p>{run.prompt.replace(run.command, "").trim()}</p></div>
        <div className="story-canvas-controls">
          {stageRuns.length > 1 && (
            <label className="story-run-history">
              <span>历史运行</span>
              <select data-testid="run-history-select" value={run.id} onChange={(event) => onSelectRun(event.target.value)}>
                {stageRuns.map((item, index) => (
                  <option key={item.id} value={item.id}>#{index + 1} · {item.businessDate} · v{item.inputVersion}</option>
                ))}
              </select>
            </label>
          )}
          <div className={`story-run-state ${stale ? "stale" : run.status}`}><i />{stale ? "输入已变更" : run.status === "complete" ? "已完成" : run.status === "paused" ? "已暂停" : "Agent 运行中"}</div>
        </div>
      </header>
      <div className="story-canvas-meta">
        <span><Ship size={14} /> JEDDAH HORIZON · 1,800 台</span>
        <span><Clock3 size={14} /> {run.businessDate}</span>
        <span>输入版本 v{run.inputVersion}</span>
      </div>
      {run.status === "blocked" ? (
        <section className="story-block story-blocked"><strong>当前 Skill 尚未解锁</strong><p>{run.blockedReason}</p></section>
      ) : (
        <div className="story-block-stream">
          {blocks.map((block, index) => (
            <section className={`story-block ${block.status}`} key={block.id} data-block-type={block.type}>
              <div className="story-block-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="story-block-copy"><span>{block.type}</span><h2>{block.title}</h2>{block.status === "streaming" ? <p>Agent 正在生成这一部分…</p> : run.command === "/daily-rebalance" ? <RebalanceBlocks block={block} campaign={campaign} onApprove={onApprove} /> : run.command === "/vessel-allocation" ? <AllocationBlocks block={block} campaign={campaign} canChangeDammamSafety={canChangeDammamSafety} onChangeDammamSafety={onChangeDammamSafety} /> : <BlockContent block={block} campaign={campaign} />}</div>
              <div className="story-block-status"><i />{block.status === "streaming" ? "生成中" : block.status === "stale" ? "已失效" : "已就绪"}</div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
