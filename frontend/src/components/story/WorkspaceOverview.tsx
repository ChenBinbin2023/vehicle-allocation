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

export default function WorkspaceOverview({
  campaign,
  mode,
  onViewRun,
}: {
  campaign: CampaignState;
  mode: "overview" | "data";
  onViewRun: (runId: string) => void;
}) {
  if (mode === "data")
    return (
      <div className="workspace-data-library">
        <span className="workspace-page-kicker">ALJ / 数据与业务规则</span>
        <h1>每个判断都有来源</h1>
        <p>本项目的船次、订单、库存及业务策略。所有数据均为本地演示快照。</p>
        <div className="source-library-grid">
          {[
            {
              name: "滚装船 VIN 清单",
              detail: "Toyota / Lexus · 配置、颜色、需求类别",
              value: "1,800 台",
              icon: Ship,
            },
            {
              name: "已确认销售需求",
              detail: "企业合同、付款零售、稀缺配置",
              value: "620 台",
              icon: FileText,
            },
            {
              name: "三大 VPC 库存",
              detail: "当前可售、危机覆盖策略和库存落点",
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
                rule: "目标覆盖量 − 当前可售 − 已确认在途 + 订单需求；剩余保留机动和异常缓冲。",
              },
              {
                title: "物流先校验再承诺",
                rule: "按最终地址选路，逐路线检查容量；同方向按 8 位演示模板配载。",
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
      <p>把下一船的分配、物流与每天的订单承诺放在同一个工作空间。</p>
      <article className="workspace-vessel-card">
        <div>
          <span>INBOUND VESSEL</span>
          <h2>JEDDAH HORIZON</h2>
          <p>预计两周后抵达吉达 · Toyota / Lexus · 1,800 台</p>
        </div>
        <StatusPill tone="amber">吉达单港入境</StatusPill>
      </article>
      <MetricGrid
        items={[
          { label: "已预订订单", value: "620", note: "企业 · 零售 · 高配" },
          { label: "库存补充", value: "1,180", note: "覆盖 · 机动 · 异常缓冲" },
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
