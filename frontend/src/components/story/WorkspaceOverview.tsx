"use client";

import {
  ArrowRight,
  Database,
  FileText,
  LockKeyhole,
  Ship,
  Sparkles,
} from "lucide-react";
import type { CampaignState } from "@/lib/story/types";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import { MetricGrid, StatusPill } from "./shared";
import {
  calculateStoreAllocation,
  defaultAllocationScenario,
} from "@/lib/story/store-planning";

export default function WorkspaceOverview({
  campaign,
  mode,
  onViewRun,
}: {
  campaign: CampaignState;
  mode: "overview" | "data";
  onViewRun: (runId: string) => void;
}) {
  const latestAllocation = [...campaign.runs]
    .reverse()
    .find(
      (run) => run.status === "complete" && run.planning?.kind === "allocation",
    );
  const storePlan =
    latestAllocation?.planning?.kind === "allocation"
      ? latestAllocation.planning.result
      : calculateStoreAllocation(defaultAllocationScenario());
  if (mode === "data")
    return (
      <div className="workspace-data-library">
        <span className="workspace-page-kicker">ALJ / 数据与业务规则</span>
        <h1>每个判断都有来源</h1>
        <p>本项目的船次、订单、库存及业务策略。所有数据均为本地演示快照。</p>
        <div className="source-library-grid">
          {[
            {
              name: "船次供给情景",
              detail: "1,800 台为情景输入；data 无本船 VIN 清单",
              value: "1,800 台",
              icon: Ship,
            },
            {
              name: "门店分车模拟快照",
              detail:
                "data 门店 × 品牌周销速、自由库存与 WoS 目标；订单单独输入",
              value: "79 家门店 / 99 条记录",
              icon: FileText,
            },
            {
              name: "门店接车与 VPC 容量",
              detail: "路线与整趟报价来自 data；接车时段与 VPC 容量为情景假设",
              value: "3 个区域",
              icon: Database,
            },
            {
              name: "VIN 占用与签收记录",
              detail: "订单保护、发运、签收与日常锁车",
              value: `${campaign.auditTrail.length} 条变更`,
              icon: LockKeyhole,
            },
          ].map((item) => (
            <article key={item.name}>
              <item.icon size={20} />
              <strong>{item.name}</strong>
              <span>{item.value}</span>
              <p>{item.detail}</p>
              <StatusPill tone="slate">演示快照</StatusPill>
            </article>
          ))}
        </div>
        <section className="model-section">
          <header>
            <h3>决策采用的业务规则</h3>
            <StatusPill>5 类约束</StatusPill>
          </header>
          <div className="business-rule-library">
            {[
              {
                title: "已确认订单优先",
                rule: "企业、已付款零售和高配承诺先锁 VIN，补货不能挤占。",
              },
              {
                title: "补货看有效缺口",
                rule: "周销速 × 目标 WoS − 到店日自由库存；订单单列，剩余供给按门店相对水位注水。",
              },
              {
                title: "物流先校验再承诺",
                rule: "最终目的地是门店；按首批接车能力拆分直送与 VPC 暂存，再排后续到店批次。",
              },
              {
                title: "车源先过滤再比价",
                rule: "VIN 可用、权属与授权、数量、承诺期通过后，比较净贡献和调出方影响。",
              },
              {
                title: "人工确认与执行校验",
                rule: "门店调拨与企业集结需批准；审批时再次去重锁车，回购未确权不可执行。",
              },
            ].map((item, i) => (
              <article key={item.title}>
                <i>0{i + 1}</i>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.rule}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  return (
    <div className="workspace-overview">
      <div className="workspace-page-kicker">
        <Sparkles size={14} /> ALJ · 沙特供应链
      </div>
      <h1>供应链工作台</h1>
      <p>先按订单与 WoS 分车到门店，再模拟直送、VPC 暂存和分批到店。</p>
      <article className="workspace-vessel-card">
        <div>
          <span>INBOUND VESSEL</span>
          <h2>JEDDAH HORIZON</h2>
          <p>
            {storePlan.rows.length} 家门店 ·{" "}
            {storePlan.input.brand ?? "历史情景"} ·{" "}
            {storePlan.input.supply.toLocaleString("en-US")} 台供给模拟
          </p>
        </div>
        <StatusPill tone="amber">单港 / 双港到店比较</StatusPill>
      </article>
      <MetricGrid
        items={[
          {
            label: "订单基准",
            value: storePlan.summary.orders.toLocaleString("en-US"),
            note: "缺少未配订单源数据，默认 0",
          },
          {
            label: "门店补库",
            value: storePlan.summary.replenishment.toLocaleString("en-US"),
            note: "按直营 / 授权的 WoS 注水",
          },
          {
            label: "生成的分析画布",
            value: String(campaign.runs.length),
            note: "保留每轮输入和依据",
          },
        ]}
      />
      <section className="workspace-recent">
        <header>
          <h3>本任务的分析画布</h3>
          <small>{campaign.runs.length} 项</small>
        </header>
        {campaign.runs.length ? (
          [...campaign.runs].reverse().map((run) => (
            <button
              type="button"
              key={run.id}
              onClick={() => onViewRun(run.id)}
            >
              <FileText size={16} />
              <div>
                <strong>{resolveStorySkill(run.command)?.title}</strong>
                <small>
                  {run.businessDate} · 输入版本 v{run.inputVersion}
                </small>
              </div>
              <StatusPill tone={run.status === "complete" ? "green" : "amber"}>
                {run.status === "complete" ? "已保存" : "运行中"}
              </StatusPill>
              <ArrowRight size={13} />
            </button>
          ))
        ) : (
          <div className="workspace-empty">
            <p>
              尚未开始分析。在右侧输入 <kbd>/</kbd> 选择所需能力。
            </p>
            <small>选择 Skill 只填入任务描述，按回车开始。</small>
          </div>
        )}
      </section>
    </div>
  );
}
