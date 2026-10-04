"use client";

import { AlertTriangle, CheckCircle2, Clock3, LockKeyhole, Network, PackageCheck, Store, Truck } from "lucide-react";
import type { CampaignState, DailyPlan, SourceCandidate, StoryBlock } from "@/lib/story/types";
import { FactCard, MetricGrid, SectionGrid, StatusPill } from "../shared";

function currentPlan(block: StoryBlock, campaign: CampaignState): DailyPlan | undefined {
  const snapshot = block.data.plan as DailyPlan | undefined;
  return campaign.dailyOperations.find((plan) => plan.businessDate === snapshot?.businessDate) ?? snapshot;
}
function sources(plan: DailyPlan | undefined, orderId: string) {
  return plan?.candidates.filter((candidate) => candidate.orderId === orderId) ?? [];
}
function SourceRow({ source }: { source: SourceCandidate }) {
  return <article><strong>{source.location}</strong><span>{source.vehicleIds.length} 台 · {source.leadDays} 天</span><span>{source.cost.toLocaleString()} SAR</span><StatusPill tone={source.executable ? "green" : "amber"}>{source.executable ? "可执行" : "待确认"}</StatusPill></article>;
}

export default function RebalanceBlocks({ block, campaign, onApprove }: { block: StoryBlock; campaign: CampaignState; onApprove: (decisionId: string) => void }) {
  const plan = currentPlan(block, campaign);
  if (!plan) return <p>正在建立今日调拨方案…</p>;
  const enterpriseOrder = plan.orders.find((item) => item.type === "enterprise");
  const premiumOrder = plan.orders.find((item) => item.type === "premium");
  const enterprise = plan.decisions.find((item) => item.orderId === enterpriseOrder?.id);
  const premium = plan.decisions.find((item) => item.orderId === premiumOrder?.id);
  const enterpriseSources = sources(plan, enterpriseOrder?.id ?? "");
  const dealer = plan.candidates.find((item) => item.sourceType === "dealer");
  const typeLabel = { enterprise: "企业大单", premium: "高利润", retail: "普通零售", remote: "偏远地区" } as const;
  if (block.type === "daily-orders") return <div className="story-data-table daily" data-testid="daily-orders"><div><span>订单</span><span>类型</span><span>数量</span><span>目的地 / 承诺</span></div>{plan.orders.map((order) => <article key={order.id}><strong>{order.id}</strong><span>{typeLabel[order.type]}</span><span>{order.quantity} × {order.model}</span><span>{order.destination} · {order.dueInDays} 天</span></article>)}</div>;
  if (block.type === "order-priority") return <MetricGrid items={[{ label: "P1 · 企业承诺", value: "80", note: "组合多来源库存", tone: "green" }, { label: "P1 · 高利润", value: "1", note: "低干扰同城调拨", tone: "green" }, { label: "P2 · 普通零售", value: "1", note: "本地 VPC 优先" }, { label: "P2 · 偏远订单", value: "8", note: "等待拼单班次", tone: "amber" }]} />;
  if (block.type === "vpc-fulfillment") return <SectionGrid columns={3}><FactCard eyebrow="LOCAL FIRST" title="达曼 VPC → Camry"><p>本地库存随既有短驳班次发运，成本 950 SAR。</p></FactCard><FactCard eyebrow="MULTI-SOURCE" title="三 VPC → 80 Hilux"><p>40 + 24 + 16 组合，不击穿任一来源安全水位。</p></FactCard><FactCard eyebrow="CONSOLIDATED" title="吉达 VPC → 塔布克"><p>8 台满载一台板车，进入西北周班。</p></FactCard></SectionGrid>;
  if (block.type === "source-network") return <div className="story-source-network"><Network size={24} /><div>{plan.candidates.map((candidate) => <span key={candidate.id} className={candidate.executable ? "ready" : "blocked"}><i />{candidate.location}<small>{candidate.vehicleIds.length || "—"} 台</small></span>)}</div></div>;
  if (block.type === "enterprise-assembly") return <div data-testid="enterprise-assembly"><div className="story-assembly">{enterpriseSources.map((source, index) => <span className="story-assembly-part" key={source.id}><article><span>{source.location}</span><strong>{source.vehicleIds.length}</strong><small>{source.leadDays} 天 · {source.cost.toLocaleString()} SAR</small></article>{index < enterpriseSources.length - 1 && <b>+</b>}</span>)}<em>= {enterpriseOrder?.quantity ?? 0} 台</em></div><p className="story-inline-note"><LockKeyhole size={14} /> 组合后来源覆盖仍为 18 / 17 / 10 天。</p></div>;
  if (block.type === "premium-transfer") return <div className="story-premium-choice"><article className="recommended"><StatusPill>推荐</StatusPill><Store size={20} /><strong>利雅得旗舰店</strong><p>1 台 Lexus LX · 同城 · 当日可达</p><small>调出后仍有 3 天覆盖 · 成本 2,800 SAR</small></article><article><StatusPill tone="amber">备选</StatusPill><Store size={20} /><strong>利雅得授权车商</strong><p>车源存在，但权属和回购价未确认</p><small>未满足 3 项交易条件</small></article></div>;
  if (block.type === "retail-options") return <div className="story-decision-list"><p><CheckCircle2 size={16} /> Camry 普通订单：达曼 VPC 本地发货，成本低于 6,200 SAR 毛利。</p><p><Truck size={16} /> 不生成跨区亏损专车；本地缺车时才从利雅得补位。</p></div>;
  if (block.type === "remote-consolidation") return <div className="story-remote" data-testid="remote-consolidation"><Truck size={34} /><div><span>JED → TABUK · 西北周班</span><strong>8 台 Hilux 拼单，满载一台板车</strong><p>预计 3 天到达 · 成本 21,000 SAR · 比零散发运节省 37%</p></div><StatusPill>承诺内</StatusPill></div>;
  if (block.type === "store-impact") return <MetricGrid items={[{ label: "利雅得旗舰店", value: "4 → 3 天", note: "LX 覆盖 · 不破安全线", tone: "green" }, { label: "达曼 VPC", value: "18 → 17 天", note: "Camry 覆盖" }, { label: "Hilux 三来源", value: "≥ 10 天", note: "企业大单调出后", tone: "green" }]} />;
  if (block.type === "buyback-conditions") return <div className="story-buyback"><div><AlertTriangle size={22} /><strong>授权车商回购尚不可执行</strong><p>{dealer?.unmetConditions.join(" · ")}</p></div><button type="button" disabled data-testid="buyback-disabled">等待权属与付款授权</button></div>;
  if (block.type === "daily-approvals") return <div className="story-approval-list">{plan.decisions.map((decision) => <article key={decision.id}><div><span>{decision.orderId}</span><strong>{decision.rationale}</strong></div>{decision.status === "approved" ? <StatusPill><CheckCircle2 size={12} /> 已批准</StatusPill> : decision.status === "approval_required" ? <button type="button" data-testid={decision.id === enterprise?.id ? "approve-enterprise" : decision.id === premium?.id ? "approve-premium" : "approve-decision"} onClick={() => onApprove(decision.id)}>批准方案</button> : <StatusPill tone="slate">自动建议</StatusPill>}</article>)}</div>;
  const locked = campaign.inventoryBaseline?.positions.filter((position) => position.status === "locked").length ?? 0;
  return <div className="story-daily-execution" data-testid="daily-execution"><PackageCheck size={35} /><div><span>{plan.businessDate} EXECUTION BOARD</span><strong>{plan.executionTasks.length} 个运输任务 · {locked} 台已锁定</strong><p>{plan.executionTasks.length ? "已生成发运任务，库存从 available 更新为 locked。" : "批准企业大单或高利润调拨后，Agent 将生成运输任务并锁定库存。"}</p></div><Clock3 size={21} /></div>;
}
