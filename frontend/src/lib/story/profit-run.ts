import {
  calculateProfit,
  defaultProfitScenario,
  type ProfitScenario,
} from "./profit-analysis";
import { costLabels, parseCostRates } from "./logistics-cost";
import type { CampaignState, StoryRun, StoryEvent } from "./types";
export function latestDeliveryRun(state: CampaignState, id?: string) {
  return [...state.runs]
    .reverse()
    .find(
      (r) =>
        r.status === "complete" &&
        r.planning?.kind === "delivery" &&
        !r.blocks.some((b) => b.status === "stale") &&
        (!id || r.id === id),
    );
}
export function startProfitRun(
  id: string,
  prompt: string,
  state: CampaignState,
  options: { profitInput?: ProfitScenario; deliveryRunId?: string },
): StoryRun {
  const base: StoryRun = {
    id,
    command: "/profit-analysis",
    prompt,
    businessDate: "销售与物流 · 模拟情景",
    inputVersion: state.version,
    status: "running",
    elapsed: 0,
    duration: 0,
    events: [],
    blocks: [],
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: [],
  };
  try {
    const source = latestDeliveryRun(state, options.deliveryRunId);
    if (source?.planning?.kind !== "delivery")
      throw new Error("请先完成有效的 /delivery-plan 物流模拟，再分析利润。");
    const { allocation, result: delivery } = source.planning;
    if (!allocation.input.source)
      throw new Error("请使用 data 门店分车和到店物流结果分析利润。");
    const previous = [...state.runs]
      .reverse()
      .find(
        (r) => r.status === "complete" && r.profit?.deliveryRunId === source.id,
      );
    const input = structuredClone(
      options.profitInput ??
        previous?.profit?.result.input ??
        defaultProfitScenario(allocation, delivery),
    );
    if (!options.profitInput) {
      if (prompt.includes("单港")) input.mode = "single";
      if (prompt.includes("双港")) input.mode = "dual";
      const model = prompt.match(/车型\s*[=：:]\s*([^\s;；]+)/)?.[1];
      const store = prompt.match(/门店\s*[=：:]\s*([^\s;；]+)/)?.[1];
      if (model && !input.orders.some((o) => o.model === model))
        throw new Error("当前销售情景中没有车型 " + model);
      if (store && !input.orders.some((o) => o.storeId === store))
        throw new Error("当前销售情景中没有门店 " + store);
      if (
        !input.orders.some(
          (o) =>
            (!model || o.model === model) && (!store || o.storeId === store),
        ) &&
        (model || store)
      )
        throw new Error("指定车型与门店组合没有销售情景订单，请调整筛选条件。");
      for (const [label, key] of [
        ["单价", "unitPrice"],
        ["折扣", "discount"],
        ["采购", "purchase"],
        ["佣金", "commissionPct"],
        ["其他", "other"],
      ] as const) {
        const match = prompt.match(
          new RegExp(label + "\\s*[=：:]\\s*([^\\s;；]+)"),
        );
        if (match) {
          const value =
            match[1] === "待确认" ? null : Number(match[1].replaceAll(",", ""));
          input.orders = input.orders.map((o) =>
            (!model || o.model === model) && (!store || o.storeId === store)
              ? { ...o, [key]: value }
              : o,
          );
        }
      }
      input.costRates = parseCostRates(prompt, input.costRates);
    }
    const result = calculateProfit(allocation, delivery, input);
    const events: Array<Omit<StoryEvent, "id">> = [
      {
        role: "plan",
        title: "执行计划",
        detail:
          "引用指定物流快照 → 读取销售情景与价格 → 摊分物流费用 → 计算订单贡献利润 → 汇总车型与门店。",
        operation: "规划",
        profitTab: "orders",
        duration: 650,
      },
      {
        role: "tool",
        title: "读取绑定物流与销售情景",
        detail: `引用 ${source.id}；${result.summary.orderCount} 笔新增模拟销售订单。价格和采购成本来自新增情景表，非实际合同；补库车辆不自动计为销售。`,
        operation: "profit.snapshot.read",
        sources: [
          "data/05_利润/车型利润情景.csv",
          "data/04_运力/场景路线运力.csv",
        ],
        profitTab: "orders",
        duration: 750,
      },
      {
        role: "tool",
        title: "摊分物流成本",
        detail: `按门店已路由车辆平均摊分共享整趟干线报价、港口/PDI/末端费用以及经 VPC 比例。${Object.entries(
          input.costRates,
        )
          .map(
            ([k, v]) =>
              costLabels[k as keyof typeof input.costRates] +
              "=" +
              (v ?? "待确认"),
          )
          .join("；")}。费率为可编辑情景；没有订单 VIN 级运输绑定。`,
        operation: "profit.cost.allocate",
        sources: ["data/05_利润/物流补充费用情景.csv", "绑定物流画布"],
        profitTab: "orders",
        duration: 850,
      },
      {
        role: "analysis",
        title: "计算订单贡献利润",
        detail:
          "净收入 = 数量 ×（未税单价 − 单台折扣）；贡献利润 = 净收入 − 采购 − 物流 − 佣金 − 其他可归属费用。缺项订单保持待确认；亏损单列。",
        operation: "profit.order.calculate",
        profitTab: "orders",
        duration: 850,
      },
      {
        role: "validation",
        title: "汇总车型与门店并核对金额",
        detail: `三个视图引用同一订单集合；汇总利润率 = 总贡献利润 ÷ 总净收入。亏损 ${result.summary.negativeOrders} 笔，未齐成本/价格 ${result.summary.unknownOrders} 笔。固定经营费用与税费不在此口径。`,
        operation: "profit.aggregate.validate",
        profitTab: "models",
        duration: 750,
      },
      {
        role: "agent",
        title: "利润结论",
        detail: result.summaryText,
        operation: "阶段总结",
        profitTab: "stores",
        duration: 650,
      },
    ];
    return {
      ...base,
      profit: {
        deliveryRunId: source.id,
        allocation: structuredClone(allocation),
        delivery: structuredClone(delivery),
        result,
      },
      events: events.map((e, i) => ({ ...e, id: id + "-EVENT-" + i })),
      duration: events.reduce((s, e) => s + e.duration, 0),
      blocks: ["orders", "models", "stores"].map((tab, i) => ({
        id: id + "-BLOCK-" + i,
        type: "profit-" + tab,
        title: ["订单利润", "车型利润", "门店利润"][i],
        status: "queued",
        skillRunId: id,
        inputVersion: state.version,
        revealAt: 1400 + i * 650,
        data: { tab },
        interactions: ["下钻订单", "调整情景", "模拟重跑"],
        sourceRefs: ["绑定物流快照", "data/05_利润"],
      })),
    };
  } catch (error) {
    return {
      ...base,
      status: "blocked",
      blockedReason: error instanceof Error ? error.message : "利润参数无效",
      answer: error instanceof Error ? error.message : "利润参数无效",
    };
  }
}
