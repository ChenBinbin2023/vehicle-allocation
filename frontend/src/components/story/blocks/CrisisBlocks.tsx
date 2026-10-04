"use client";

import { AlertTriangle, Anchor, ArrowRight, CheckCircle2, ShieldAlert, Ship } from "lucide-react";
import type { CampaignState, StoryBlock } from "@/lib/story/types";
import { FactCard, MetricGrid, MiniBar, SectionGrid, StatusPill } from "../shared";

export default function CrisisBlocks({ block, campaign }: { block: StoryBlock; campaign: CampaignState }) {
  if (block.type === "vessel-hero") return <div className="story-vessel-hero"><div><span>T-14 · 决策窗口</span><strong>14</strong><small>DAYS TO JEDDAH</small></div><div><Ship size={24} /><h3>JEDDAH HORIZON</h3><p>1,800 台 · Toyota / Lexus · ETA T0</p></div><StatusPill tone="amber">达曼港关闭</StatusPill></div>;
  if (block.type === "vehicle-mix") {
    const counts = new Map<string, number>();
    campaign.vessel.vehicles.forEach((vehicle) => counts.set(vehicle.model, (counts.get(vehicle.model) ?? 0) + 1));
    const models = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    return <div className="story-bars">{models.map(([model, quantity], index) => <MiniBar key={model} label={model} value={quantity} total={1800} color={index < 2 ? "green" : "slate"} />)}</div>;
  }
  if (block.type === "demand-gap") return <><MetricGrid items={[{ label: "已预订订单", value: "620", note: "企业 240 · 零售 290 · 高配 90", tone: "green" }, { label: "VPC / 机动补库", value: "1,180", note: "补货 780 · 机动 300 · 缓冲 100" }, { label: "东向运输压力", value: "630", note: "需跨越 1,300+ km", tone: "amber" }]} /><div className="story-pool-split"><i style={{ width: "34.4%" }} /><span>34.4% 订单保护</span><em>65.6% 库存补充</em></div></>;
  if (block.type === "network-compare") return <div className="story-network-compare"><article><span>原双港网络</span><div className="network-line"><b>JED</b><i /><b>RUH</b><i /><b>DMM</b></div><p>西部走吉达，东部从达曼入境；区域路径短，但当前不可执行。</p></article><ArrowRight size={22} /><article className="active"><span>吉达单港网络</span><div className="network-line"><b>JED</b><i /><b>RUH</b><i /><b>DMM</b></div><p>订单车穿透直达，补货车由利雅得截流，减少重复装卸。</p></article></div>;
  if (block.type === "risk-board") return <SectionGrid columns={3}><FactCard eyebrow="HIGH" title="东向干线容量" tone="red"><p>630 台东向压力集中在 T0–T+3。</p></FactCard><FactCard eyebrow="HIGH" title="旧模式绕行" tone="red"><p>先入吉达再按旧 VPC 辐射将显著推高成本。</p></FactCard><FactCard eyebrow="MEDIUM" title="港口释放节奏" tone="amber"><p>必须把清关、PDI 与板车班次同步。</p></FactCard></SectionGrid>;
  return <div className="story-decision-list"><p><CheckCircle2 size={16} />保护 620 台已确认订单，不与补货池竞争。</p><p><Anchor size={16} />全部 1,800 台以吉达港为唯一入境点。</p><p><ShieldAlert size={16} />分车必须接受物流容量校验与局部回压。</p><p><AlertTriangle size={16} />每日调拨仅在 T+3 库存基线形成后启动。</p></div>;
}
