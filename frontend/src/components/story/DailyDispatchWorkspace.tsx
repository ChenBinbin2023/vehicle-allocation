"use client";
import { useEffect, useRef } from "react";
import { ArrowDown, CalendarDays, Download, Truck } from "lucide-react";
import type { StoryRun } from "@/lib/story/types";
import { SkillStream, StreamBlock } from "./SkillStream";
import DispatchDemandPanel from "./DispatchDemandPanel";
import DispatchAdvice from "./DispatchAdvice";
import DispatchShortagePanel from "./DispatchShortagePanel";
import DispatchFulfillmentPanel from "./DispatchFulfillmentPanel";

export default function DailyDispatchWorkspace({
  run,
  focusedStep,
  focusRevision,
  disabled,
  onSelect,
  onGenerate,
}: {
  run: StoryRun;
  focusedStep: number | null;
  focusRevision: number;
  disabled: boolean;
  onSelect: (selections: Record<string, string>) => void;
  onGenerate: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const event = focusedStep === null ? undefined : run.events[focusedStep];
  const focusedBlock = run.blocks.find((b) => b.type === event?.guiBlock);
  useEffect(() => {
    if (event?.guiBlock)
      root.current
        ?.querySelector(`[data-block-type="${event.guiBlock}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [event?.id, focusRevision, focusedBlock?.status]);
  const documentsStatus = run.blocks.find(
    (b) => b.type === "dispatch-fulfillment",
  )?.status;
  useEffect(() => {
    if (documentsStatus === "ready")
      root.current
        ?.querySelector('[data-block-type="dispatch-fulfillment"]')
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [documentsStatus]);
  const data = run.dispatch;
  if (!data) return null;
  const s = data.summary;
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { runId: run.id, command: run.command, ...data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `daily-dispatch-${data!.date}-${run.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      className="planning-workspace daily-dispatch"
      data-testid="daily-dispatch"
      data-skill-command={run.command}
      ref={root}
    >
      <header className="dd-heading">
        <div>
          <small>
            DAILY DISPATCH <i /> 08:30 运营简报
          </small>
          <h1>每日调拨计划</h1>
          <p>从今日订单出发，为每一台车安排合适的车源与送达路径。</p>
        </div>
        <span className={`dd-run-status ${run.status}`}>
          <i />
          {run.status === "complete"
            ? "方案已生成"
            : run.status === "paused"
              ? "已暂停"
              : `生成中 ${Math.round((run.elapsed / run.duration) * 100)}%`}
        </span>
      </header>
      <div className="dd-context">
        <span>
          <CalendarDays size={14} />
          {data.date} · 沙特当地时间
        </span>
        <span className="dd-demo">模拟运营快照</span>
        <button
          type="button"
          disabled={run.status !== "complete"}
          onClick={download}
        >
          <Download size={14} />
          导出调度计划
        </button>
      </div>
      <nav className="dd-jump" aria-label="每日调拨分区">
        {[
          ["demand", "需求总览"],
          ["available", "有货车辆"],
          ["shortage", "区域缺货"],
          ...(data.fulfillment ? [["fulfillment", "调度与采购单"]] : []),
        ].map(([name, title]) => (
          <button
            key={name}
            type="button"
            disabled={
              !run.blocks.some(
                (b) => b.type === `dispatch-${name}` && b.status === "ready",
              )
            }
            onClick={() =>
              root.current
                ?.querySelector(`[data-block-type="dispatch-${name}"]`)
                ?.scrollIntoView({ block: "start", behavior: "smooth" })
            }
          >
            {title}
            <ArrowDown size={12} />
          </button>
        ))}
      </nav>
      <SkillStream run={run}>
        <StreamBlock name="dispatch-summary">
          <div className="dd-daily-strip" data-testid="dispatch-summary">
            <div className="dd-strip-label">
              <CalendarDays size={18} />
              <span>
                昨日订单<small>{data.yesterday}</small>
              </span>
            </div>
            <div>
              <span>
                <i className="dd-dot green" />
                新增
              </span>
              <strong>
                {s.newOrders}
                <small>笔</small>
                <em>{s.newVehicles} 台</em>
              </strong>
            </div>
            <div>
              <span>
                <i className="dd-dot gray" />
                取消
              </span>
              <strong>
                {s.cancelledOrders}
                <small>笔</small>
                <em>{s.cancelledVehicles} 台</em>
              </strong>
            </div>
            <div>
              <span>
                <i className="dd-dot amber" />
                待拼车积压
              </span>
              <strong>
                {s.waitingOrders}
                <small>笔</small>
                <em>{s.waitingVehicles} 台</em>
              </strong>
            </div>
            <div className="dd-today">
              <span>今日待处理</span>
              <strong>
                {s.orders}
                <small>笔</small>
                <em>{s.vehicles} 台</em>
              </strong>
            </div>
          </div>
        </StreamBlock>
        <StreamBlock name="dispatch-demand">
          <DispatchDemandPanel data={data} />
        </StreamBlock>
        <StreamBlock name="dispatch-available">
          <div className="dd-plan-banner">
            <span>
              <Truck size={21} />
            </span>
            <div>
              <strong>调度建议已就绪</strong>
              <p>
                {s.vehicles - s.shortage} 台已找到区域车源 · {data.trips.length}{" "}
                个运输批次 · {s.shortage} 台需补齐区域缺货
              </p>
            </div>
            <small>建议阶段 · 待车源与报价确认</small>
          </div>
          <DispatchAdvice data={data} />
        </StreamBlock>
        <StreamBlock name="dispatch-shortage">
          <DispatchShortagePanel
            data={data}
            disabled={disabled}
            onSelect={onSelect}
            onGenerate={onGenerate}
          />
        </StreamBlock>
        <StreamBlock name="dispatch-fulfillment">
          <DispatchFulfillmentPanel
            data={data}
            disabled={disabled}
            onGenerate={onGenerate}
          />
        </StreamBlock>
      </SkillStream>
      <footer className="dd-boundary">
        独立演示快照 ·
        库存编号、订单、费率及采购报价为模拟设定。到店时间按沙特当地时间显示；方案确认前不锁定车辆或创建实际运输任务。
      </footer>
    </div>
  );
}
