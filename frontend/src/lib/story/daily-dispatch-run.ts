import { createDispatchSnapshot } from "./daily-dispatch";
import type { CampaignState, StoryEvent, StoryRun } from "./types";

export function startDailyDispatchRun(
  id: string,
  prompt: string,
  state: CampaignState,
): StoryRun {
  const dispatch = createDispatchSnapshot();
  const s = dispatch.summary;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const reviewCount = dispatch.shortages.filter(
    (item) => item.requiresReview,
  ).length;
  const summary = `今日需处理 ${s.orders} 笔订单、${s.vehicles} 台车。其中 ${s.vehicles - s.shortage} 台匹配到服务 VPC 或区域门店车源，形成 ${dispatch.trips.length} 个运输批次，物流费用 ${fmt(s.logistics)} SAR；${s.shortage} 台区域缺货车辆已逐车比较跨区调拨与本区授权店采购，${reviewCount} 台建议暂缓并复核采购报价或销售条件。取消的 ${s.cancelledOrders} 笔订单不进入调度。推荐方案、利润与时效已同步到画布，车源和报价仍需执行前确认。`;
  const events: Omit<StoryEvent, "id">[] = [
    {
      role: "thinking",
      title: "整理今日待处理订单",
      operation: "思考",
      detail:
        "先核对昨日新增、取消与积压待拼车订单，取消订单从需求池剔除。再按门店、车型及配置整理今日有效需求，为每台车寻找来源与可按期到店的物流方案。",
      duration: 1000,
    },
    {
      role: "plan",
      title: "执行计划",
      operation: "规划",
      detail:
        "1. 汇总昨日订单变化与今日需求。\n2. 按门店和车型展示需求地图。\n3. 逐车匹配 VPC 与其他门店的同配置可用库存。\n4. 比较小车直送与多单大车拼载。\n5. 诊断区域缺货，比较跨区调拨与本区采购的利润和时效。\n6. 校验车辆、费用与交付承诺，生成调度建议。",
      duration: 900,
    },
    {
      role: "tool",
      title: "读取订单变化与待拼车积压",
      operation: "orders.read · orders.validate",
      detail: `昨日新增 ${s.newOrders} 笔 / ${s.newVehicles} 台，取消 ${s.cancelledOrders} 笔 / ${s.cancelledVehicles} 台；截至昨日收盘，待拼车积压 ${s.waitingOrders} 笔 / ${s.waitingVehicles} 台。今天有效需求共 ${s.orders} 笔、${s.vehicles} 台，分布在 ${dispatch.stores.length} 家门店。`,
      duration: 1200,
      guiBlock: "dispatch-summary",
    },
    {
      role: "data",
      title: "按门店、车型与配置聚合需求",
      operation: "demand.aggregate",
      detail:
        "以车辆台数作为地图圆圈面积，点击门店可查看各车型数量；车型柱状图保留配置和颜色明细。新增与待拼车筛选只改变需求视图，取消订单不参与需求与配载。",
      duration: 1100,
      guiBlock: "dispatch-demand",
    },
    {
      role: "tool",
      title: "匹配区域车源与订单配置",
      operation: "inventory.match · source.check",
      detail: `逐车核对车型、配置、颜色及库存可用状态。${s.vehicles - s.shortage} 台已匹配服务 VPC 或其他门店车源；锁定库存不参与匹配，每个库存编号仅进入一项调度建议。另有 ${s.shortage} 台在服务 VPC 和区域门店中无可用同配置车辆。`,
      duration: 1400,
      guiBlock: "dispatch-available",
    },
    {
      role: "analysis",
      title: "生成小车直送与多单拼载批次",
      operation: "logistics.consolidate · costs.allocate",
      detail: `同源、同区域沿线订单分别测算小车组合和大车拼载：大车最多 8 台、3 个卸货点，小车最多 2 台；先满足交期，再选择费用更低的方式，相同费用优先直送。共生成 ${dispatch.trips.filter((t) => t.mode === "consolidated").length} 个大车批次与 ${dispatch.trips.filter((t) => t.mode === "small").length} 个小车批次，整车费用 ${fmt(s.logistics)} SAR，逐车分摊后与批次费用一致。`,
      duration: 1400,
      guiBlock: "dispatch-available",
    },
    {
      role: "thinking",
      title: "缺货车辆需要同时比较利润与交期",
      operation: "再次思考",
      detail:
        "区域缺货不直接转为本地高价采购。为每台车保留一辆跨区 VPC 候选和一辆本区授权店候选，先判断能否满足承诺时间，再比较净收入、采购价、物流及其他成本形成的贡献利润。",
      duration: 1000,
    },
    {
      role: "tool",
      title: "逐车计算两种缺货补齐方案",
      operation: "shortage.compare · profit.calculate",
      detail: `${s.shortage} 台缺货车辆已逐车生成两种方案。利润 = 未税净收入 − 采购成本 − 物流 − 其他归属费用。时效紧张的订单优先本区采购；两种方案均按期时优先贡献利润更高的方案，并列出推荐理由。其中 ${reviewCount} 台的按期方案亏损，建议暂缓并人工复核采购报价或销售条件。`,
      duration: 1600,
      guiBlock: "dispatch-shortage",
    },
    {
      role: "validation",
      title: "校验数量、车源占用与成本守恒",
      operation: "plan.validate",
      detail: `有效需求 ${s.vehicles} 台 = 区域有货 ${s.vehicles - s.shortage} 台 + 缺货比较 ${s.shortage} 台。取消订单、不可用库存与重复候选均已排除；批次容量与逐车费用完成核对。所有库存编号、采购报价、线路费率和预计到店时间均为独立演示快照，实际下单前需确认。`,
      duration: 1000,
      guiBlock: "dispatch-shortage",
    },
    {
      role: "agent",
      title: "今日调度计划已生成",
      operation: "阶段总结",
      detail: summary,
      duration: 900,
    },
  ];
  return {
    id,
    command: "/daily-dispatch",
    prompt,
    businessDate: dispatch.date,
    inputVersion: state.version,
    status: "running",
    elapsed: 0,
    duration: events.reduce((n, e) => n + e.duration, 0),
    events: events.map((e, i) => ({
      ...e,
      id: `${id}-EVENT-${i}`,
      sources: [`${dispatch.date} 每日调拨模拟快照`],
    })),
    blocks: [
      ["summary", "昨日订单统计", 3100],
      ["demand", "门店需求分布", 4200],
      ["available", "有货车辆调度建议", 7000],
      ["shortage", "区域缺货方案比较", 10100],
    ].map(([name, title, revealAt]) => ({
      id: `${id}-BLOCK-${name}`,
      type: `dispatch-${name}`,
      title: String(title),
      revealAt: Number(revealAt),
      status: "queued",
      skillRunId: id,
      inputVersion: state.version,
      data: {},
      interactions: ["查看明细", "导出快照"],
      sourceRefs: [`${dispatch.date} 每日调拨模拟快照`],
    })),
    dispatch,
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: [],
    answer: summary,
  };
}
