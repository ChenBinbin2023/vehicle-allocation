"use client";

import { ArrowRight, CheckCircle2, Gauge, PackageOpen, Route, Truck } from "lucide-react";
import type { CampaignState, RouteId, StoryBlock } from "@/lib/story/types";
import { FactCard, MetricGrid, MiniBar, SectionGrid, StatusPill } from "../shared";

const routeMeta: Array<[RouteId, string, string]> = [
  ["west", "西部短链", "JED → 西部"], ["riyadh", "利雅得中轴", "JED → RUH"], ["eastDirect", "东部订单直达", "JED → 东部交付点"], ["riyadhIntercept", "利雅得截流", "JED → RUH → 中东部"], ["dammamSafety", "达曼安全库存", "JED → DMM VPC"],
];
function routes(block: StoryBlock) { return (block.data.routes ?? { west: 520, riyadh: 650, eastDirect: 360, riyadhIntercept: 170, dammamSafety: 100 }) as Record<RouteId, number>; }

export default function DeliveryBlocks({ block, campaign }: { block: StoryBlock; campaign: CampaignState }) {
  const routeCounts = routes(block);
  if (block.type === "release-rhythm") return <div className="story-release"><article><span>D1</span><strong>630</strong><p>订单保护与西部短链</p></article><i /><article><span>D2</span><strong>760</strong><p>利雅得中轴与东向直达</p></article><i /><article><span>D3</span><strong>410</strong><p>截流短驳与安全库存</p></article></div>;
  if (block.type === "route-network") return <div className="story-route-grid" data-testid="route-counts">{routeMeta.map(([id, label, path], index) => <article key={id}><span>0{index + 1}</span><Route size={16} /><strong>{routeCounts[id]}</strong><h3>{label}</h3><p>{path}</p></article>)}</div>;
  if (block.type === "truck-loads") return <><MetricGrid items={[{ label: "板车批次", value: String(block.data.batchCount ?? campaign.deliveryPlan?.batches.length ?? 227), note: "8 位轿运车 · 路线内配载" }, { label: "车辆", value: "1,800", note: "每台车唯一 batchId", tone: "green" }, { label: "预计装载率", value: "99.1%", note: "末班允许非满载", tone: "green" }]} /><div className="story-truck-strip"><Truck size={22} /><i><b style={{ width: "99.1%" }} /></i><span>计划容量 1,816 · 使用 1,800</span></div></>;
  if (block.type === "capacity-board") return <div className="story-bars">{routeMeta.map(([id, label]) => <MiniBar key={id} label={label} value={routeCounts[id]} total={routeCounts[id]} color={id === "dammamSafety" ? "amber" : "green"} />)}</div>;
  if (block.type === "order-logistics") return <div className="story-data-table logistics"><div><span>订单类型</span><span>首选方案</span><span>保护逻辑</span><span>承诺</span></div><article><strong>企业大单</strong><span>多批次直达</span><span>同目的地成组</span><StatusPill>D+3</StatusPill></article><article><strong>高配车</strong><span>低装卸优先</span><span>配置与车况保护</span><StatusPill>D+3</StatusPill></article><article><strong>普通订单</strong><span>区域既有班次</span><span>不开亏损专车</span><StatusPill tone="slate">D+2/3</StatusPill></article><article><strong>VPC 补货</strong><span>利雅得截流</span><span>安全库存优先</span><StatusPill tone="amber">D+3</StatusPill></article><article><strong>偏远地区</strong><span>区域拼单</span><span>满载后发运</span><StatusPill tone="slate">班期制</StatusPill></article></div>;
  if (block.type === "cost-compare") return <SectionGrid columns={3}><FactCard eyebrow="1 HANDLING" title="订单穿透直达" tone="green"><p>成本较高但客户承诺最稳，避免 VPC 二次装卸。</p></FactCard><FactCard eyebrow="1 HANDLING" title="利雅得中轴"><p>适合规模化补库与全国机动库存。</p></FactCard><FactCard eyebrow="2 HANDLINGS" title="截流后短驳" tone="amber"><p>以更低干线成本覆盖中东部过渡带。</p></FactCard></SectionGrid>;
  if (block.type === "logistics-pressure") return <div className="story-pressure"><Gauge size={24} /><div><strong>当前没有阻断性容量缺口</strong><p>若东向容量下降，先回压机动与异常缓冲 VIN，不触碰 620 台已确认订单。</p></div><StatusPill>0 台待调整</StatusPill></div>;
  return <div className="story-publish-check"><PackageOpen size={34} /><div><span>JOINT PLAN</span><strong>{campaign.deliveryPlan?.id ?? `DELIVERY-v${block.inputVersion}`}</strong><p>分车守恒、路线容量、板车批次与收货窗口已校验</p></div><ArrowRight size={16} /><StatusPill><CheckCircle2 size={12} /> 已发布</StatusPill></div>;
}
