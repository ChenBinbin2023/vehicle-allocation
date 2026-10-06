import {
  calculateStoreAllocation,
  calculateStoreDelivery,
  defaultAllocationScenario,
  defaultDeliveryScenario,
  type AllocationScenario,
  type DeliveryScenario,
  type PlanningInput,
  type PlanningSnapshot,
} from "./store-planning";
import type {
  CampaignState,
  StoryCommand,
  StoryEvent,
  StoryRun,
} from "./types";
import { parseCostRates, unknownCostRates } from "./logistics-cost";
import { vesselOverview } from "./vessel-overview";
import { vesselOrders } from "./vessel-orders";

export type PlanningRunOptions = {
  input?: PlanningInput;
  allocationRunId?: string;
  profitInput?: import("./profit-analysis").ProfitScenario;
  deliveryRunId?: string;
};
const fmt = (n: number) => n.toLocaleString("en-US");
export function latestStoreAllocation(state: CampaignState, id?: string) {
  return [...state.runs]
    .reverse()
    .find(
      (run) =>
        run.planning?.kind === "allocation" &&
        run.status === "complete" &&
        !run.blocks.some((b) => b.status === "stale") &&
        (!id || run.id === id),
    );
}
export function startStorePlanningRun(
  id: string,
  command: StoryCommand,
  prompt: string,
  state: CampaignState,
  options: PlanningRunOptions,
): StoryRun {
  const base: StoryRun = {
    id,
    command,
    prompt,
    businessDate: "到港 D0 · 模拟计划",
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
    let planning: PlanningSnapshot, summary: string;
    let events: Array<Omit<StoryEvent, "id">>;
    if (command === "/vessel-allocation") {
      base.businessDate = "2026-08-05 · 模拟统计 / 分车情景";
      const previous = latestStoreAllocation(state);
      const input = structuredClone(
        options.input ??
          (previous?.planning?.kind === "allocation" &&
          previous.planning.result.input.source
            ? previous.planning.result.input
            : defaultAllocationScenario(
                prompt.includes("雷克萨斯") ? "雷克萨斯" : "丰田",
              )),
      ) as AllocationScenario;
      if (!("supply" in input)) throw new Error("分车需要供给和门店库存参数");
      if (
        !options.input &&
        /丰田|雷克萨斯/.test(prompt) &&
        input.brand !== (prompt.includes("雷克萨斯") ? "雷克萨斯" : "丰田")
      ) {
        const selected = defaultAllocationScenario(
          prompt.includes("雷克萨斯") ? "雷克萨斯" : "丰田",
        );
        selected.supply = input.supply;
        Object.assign(input, selected);
      }
      for (const [pattern, key] of [
        [
          /(?:供给(?:量)?\s*[=:：]?\s*|^\s*)(-?[\d,]+(?:\.\d+)?)\s*(?:台)?/,
          "supply",
        ],
        [/直营WoS\s*[=:：]\s*(-?[\d.]+)/i, "targetDirect"],
        [/授权WoS\s*[=:：]\s*(-?[\d.]+)/i, "targetAuthorized"],
      ] as const) {
        const value = options.input ? null : prompt.match(pattern);
        if (value) input[key] = Number(value[1].replaceAll(",", ""));
      }
      if (!options.input) {
        for (const match of prompt.matchAll(
          /\b(MOCK-[A-Z0-9]+-\d+)\s*订单\s*[=:：]\s*((?:[^\s,，;；]|,(?=\d))*)/gi,
        )) {
          const store = input.stores.find(
            (s) => s.id === match[1].toUpperCase(),
          );
          if (!store) throw new Error("当前品牌中没有门店 " + match[1]);
          const quantity = match[2].replace(/台$/, "");
          if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(quantity))
            throw new Error("未配订单数量格式无效");
          store.orders = Number(quantity.replaceAll(",", ""));
        }
        if (prompt.includes("直营优先")) input.offsetAuthorized = 0.3;
        if (prompt.includes("同步注水")) {
          input.offsetDirect = 0;
          input.offsetAuthorized = 0;
        }
      }
      const result = calculateStoreAllocation(input),
        s = result.summary;
      planning = { kind: "allocation", result };
      const overview = vesselOverview.summary;
      summary = `基本统计（${vesselOverview.snapshotDate}，模拟）：本船丰田与雷克萨斯共 ${fmt(overview.supply)} 台，订单缺货 ${fmt(overview.orderShortage)} 台，四周补库缺口 ${fmt(overview.replenishmentShortage)} 台，覆盖 79 家门店。订单分车：${fmt(overview.orders)} 台需求中，本船可分配 ${fmt(vesselOrders.plans.dual.quantity)} 台，${fmt(overview.orderShortage)} 台缺口不排车；单港 ${vesselOrders.plans.single.trips.length} 车次 / ${fmt(vesselOrders.plans.single.totalCost)} SAR，双港 ${vesselOrders.plans.dual.trips.length} 车次 / ${fmt(vesselOrders.plans.dual.totalCost)} SAR，支持逐车查看订单与多点卸货。分车情景（库存 ${input.source?.stockDate ?? "独立情景"}，${input.brand ?? "配置品牌"}）：供给 ${fmt(input.supply)} 台，已订订单 ${fmt(s.orders)} 台，补库存 ${fmt(s.replenishment)} 台，保留 ${fmt(s.retained)} 台。订单缺口 ${fmt(s.orderShortage)} 台，距目标 WoS 仍缺 ${fmt(s.replenishmentGap)} 台。基本统计、订单分车与可编辑品牌分车情景各自注明口径；物流为模拟建议。`;
      events = [
        {
          role: "plan",
          title: "执行计划",
          detail:
            "先展示 2026-08-05 的供需与库存模拟基本统计 → 读取分车情景的门店 × 品牌数据 → 先满足已订订单 → 按 WoS 注水 → 校验数量守恒。",
          operation: "规划",
          planningTab: "overview",
          duration: 700,
        },
        {
          role: "tool",
          title: "生成供需与库存基本统计",
          detail: `统计截至 ${vesselOverview.snapshotDate}：本船供给 ${fmt(overview.supply)} 台（丰田 ${fmt(overview.toyotaSupply)} / 雷克萨斯 ${fmt(overview.lexusSupply)}）；直营 34 家、授权 45 家，订单 ${fmt(overview.orders)} 台，订单缺货 ${fmt(overview.orderShortage)} 台，未来四周需求 ${fmt(overview.demand4Weeks)} 台。展示 2025-07—2026-07 的模拟船次、3 个 VPC 与 5 个区域销速，以及 79 家门店近 8 周周均销量。近期丰田供给下降按霍尔木兹海峡影响情景模拟，图表按缺口及销速排序。9 月源库存没有当作 8 月库存使用。`,
          operation: "vessel.overview.read",
          planningTab: "overview",
          sources: [
            "data/01_供给/按月总表.csv",
            "data/00_客户/门店主数据.csv",
            "data/02_销速/周度门店销量.csv",
            "2026-08-05 独立模拟库存与车型需求",
          ],
          duration: 750,
        },
        {
          role: "tool",
          title: "按门店展开本船订单",
          detail: `沿用基本统计：79 家门店共 ${fmt(overview.orders)} 台、${fmt(vesselOrders.orders.length)} 笔模拟订单，本船可分配 ${fmt(vesselOrders.plans.dual.quantity)} 台，缺口 ${fmt(overview.orderShortage)} 台。地图圆圈面积代表订单笔数；点击门店查看按车型、按订单类型的车辆数量柱状图，均按数量降序。订单号与类型由模拟明细生成，渠道与车型总量和基本统计一致。`,
          operation: "vessel.orders.read",
          planningTab: "graph",
          planningNode: "ORDERS",
          sources: ["2026-08-05 模拟订单明细", "基本统计渠道 × 车型预留量"],
          duration: 600,
        },
        {
          role: "tool",
          title: "生成单港与双港订单物流建议",
          detail: `只运输本船已分配的 ${fmt(vesselOrders.plans.dual.quantity)} 台。单港由吉达出发：${vesselOrders.plans.single.trips.length} 车次，${fmt(vesselOrders.plans.single.totalCost)} SAR；双港按目的城市报价选择吉达或达曼：${vesselOrders.plans.dual.trips.length} 车次，${fmt(vesselOrders.plans.dual.totalCost)} SAR。按 8 台/车合并邻近门店，支持多点卸货。点击车次可看路线、各站数量、对应订单号、全车总成本与每台成本。费用为整趟运输、额外卸货和港口处理/整备的模拟预算。`,
          operation: "vessel.orders.logistics",
          planningTab: "graph",
          planningNode: prompt.includes("单港")
            ? "LOGISTICS-SINGLE"
            : "LOGISTICS-DUAL",
          sources: [
            "模拟订单分车明细",
            "data/04_运力/路线主数据.csv · 情景报价参数",
          ],
          duration: 600,
        },
        {
          role: "tool",
          title: "读取订单、销速与自由库存",
          detail: `${input.stores.length} 家${input.brand ?? "模拟"}门店，供给 ${fmt(input.supply)} 台。读取 data 的周销速和自由库存，排除已锁与冻结库存；${input.includeTransit ? "本次假设在途按期到店并计入 E" : "未确认 ETA 的在途不计入 E"}。未配订单由情景输入提供，不能复用已锁库存。`,
          operation: "store.snapshot.read",
          planningNode: "B1",
          sources: [
            "data/00_客户/门店主数据.csv",
            "data/02_销速/销速汇总_门店.csv",
            "data/03_库存/当前库存_门店.csv",
          ],
          planningTab: "graph",
          duration: 800,
        },
        {
          role: "tool",
          title: "先分已订订单",
          detail: `按交期和门店 ID 分配，已满足 ${fmt(s.orders)} 台，订单缺口 ${fmt(s.orderShortage)} 台。订单车不计入门店自由补库水位。`,
          operation: "orders.allocate",
          planningNode: "ORD",
          planningTab: "graph",
          duration: 900,
        },
        {
          role: "tool",
          title: "计算 WoS 并注水到门店",
          detail: `目标库存 = 周销速 × 目标 WoS；补库缺口 = max(0, 目标库存 − E)。直营 ${input.targetDirect} 周、授权 ${input.targetAuthorized} 周，按最低相对水位注入 ${fmt(s.replenishment)} 台。`,
          operation: "stock.waterfill",
          planningTab: "water",
          duration: 900,
        },
        {
          role: "validation",
          title: "校验配置与数量守恒",
          detail: `同一品牌池内分配；${fmt(s.orders)} 订单 + ${fmt(s.replenishment)} 补库 + ${fmt(s.retained)} 保留 = ${fmt(input.supply)} 台。未达到目标的缺口 ${fmt(s.replenishmentGap)} 台单列。`,
          operation: "allocation.validate",
          planningTab: "allocation",
          duration: 800,
        },
        {
          role: "agent",
          title: "分车结论与下一步",
          detail: summary,
          operation: "阶段总结",
          planningTab: "allocation",
          duration: 700,
        },
      ];
      base.nextSkillSuggestions = ["/delivery-plan"];
    } else {
      const allocationRun = latestStoreAllocation(
        state,
        options.allocationRunId,
      );
      if (!allocationRun || allocationRun.planning?.kind !== "allocation")
        throw new Error("请先完成 /vessel-allocation 的门店分车模拟。");
      const allocation = allocationRun.planning.result;
      const previousDelivery = [...state.runs]
        .reverse()
        .find(
          (r) =>
            r.status === "complete" &&
            r.planning?.kind === "delivery" &&
            r.planning.allocationRunId === allocationRun.id,
        );
      const input = structuredClone(
        options.input ??
          (previousDelivery?.planning?.kind === "delivery"
            ? previousDelivery.planning.result.input
            : defaultDeliveryScenario(allocation)),
      ) as DeliveryScenario;
      if (!("vpcCapacity" in input))
        throw new Error("物流需要接车与 VPC 容量参数");
      if (!options.input && prompt.includes("双港")) input.mode = "dual";
      if (!options.input && prompt.includes("单港")) input.mode = "single";
      if (
        !options.input &&
        /演示费率|(?:港口费|整备|末端|VPC费|暂存日费|暂存天数)\s*[=：:]/.test(
          prompt,
        )
      )
        input.costRates = parseCostRates(
          prompt,
          input.costRates ?? unknownCostRates,
        );
      const capacity = options.input
        ? null
        : prompt.match(/D2接车\s*[=:：]\s*(-?[\d.]+)/i);
      if (capacity) {
        const row = input.stores.find((s) => s.id === "D2");
        if (!row) throw new Error("请使用当前数据门店的 GUI 接车参数");
        row.directEligible = true;
        row.firstCapacity = Number(capacity[1]);
      }
      const result = calculateStoreDelivery(allocation, input),
        active = result[input.mode],
        s = active.summary;
      planning = {
        kind: "delivery",
        allocationRunId: allocationRun.id,
        allocation: structuredClone(allocation),
        result,
      };
      const costText = allocation.input.source
        ? `干线 ${fmt(active.costs?.linehaul ?? 0)} SAR，已知费用小计 ${fmt(s.knownCost)} SAR；${s.cost === null ? "完整成本待确认：" + (active.costs?.missing.join("、") ?? "费用缺项") : "情景全链路预算 " + fmt(s.cost) + " SAR"}。`
        : s.cost === null
          ? "部分路线未落实，完整成本待确认。"
          : `全链路模拟费用 ${fmt(s.cost)} SAR。`;
      summary = `本船 ${fmt(s.total)} 台：首批直送 ${fmt(s.direct)} 台，经 VPC ${fmt(s.viaVpc)} 台，未落实 ${fmt(s.unrouted)} 台。待排到店时段 ${fmt(s.pendingSchedule)} 台；订单按期 ${fmt(s.orderOnTime)} 台、延误 ${fmt(s.orderLate)} 台、待确认 ${fmt(s.orderPending)} 台。${costText}${result.saving === null ? "跨港口场景完整成本节省待确认。" : `双港比单港节省 ${fmt(result.saving)} SAR。`}均为模拟计划，尚未发布或签收。`;

      base.nextSkillSuggestions = ["/profit-analysis"];
      events = [
        {
          role: "plan",
          title: "执行计划",
          detail:
            "引用分车快照 → 计算门店首批可接数量 → 剩余车辆占用专属 VPC 容量 → 排后续批次 → 比较单港与双港。",
          operation: "规划",
          planningTab: "routes",
          duration: 700,
        },
        {
          role: "tool",
          title: "读取门店归属与接车条件",
          detail: `引用 ${allocationRun.id}，分车 ${fmt(s.total)} 台。交付中心在门店；停车场、接车和整备条件共同决定首批能力。`,
          operation: "receiving.capacity.read",
          sources: ["分车结果快照", "02_到店交付与VPC路由设计.md"],
          planningTab: "routes",
          duration: 800,
        },
        {
          role: "tool",
          title: "拆分直送和 VPC 暂存",
          detail: `直送 ${fmt(s.direct)} 台，经 VPC ${fmt(s.viaVpc)} 台。其中有直送资格但超出首批接车能力的 ${fmt(s.capacityOverflow)} 台是经 VPC 数量的子集。VPC 共用容量先保护订单，再安排补库。`,
          operation: "routing.split",
          planningTab: "map",
          duration: 900,
        },
        {
          role: "tool",
          title: "生成到店批次",
          detail: `后续接车时段逐日扣减；${fmt(s.pendingSchedule)} 台尚无确定时段，ETA 保持未知。VPC 只是物理暂存点，车辆的门店归属不变。`,
          operation: "batches.schedule",
          planningTab: "batches",
          duration: 900,
        },
        {
          role: "validation",
          title: "比较完整费用和承诺时间",
          detail: `${allocation.input.source ? `报价来自路线整趟费用，按共享路线装载量向上取整计费；补充费率与暂存天数为情景参数。${costText}` : "报价为全链路模拟单台费，含 VPC 和末端配送。"}双港按期 ${fmt(result.dual.summary.orderOnTime)} 台，单港按期 ${fmt(result.single.summary.orderOnTime)} 台；${allocation.input.source ? (result.saving === null ? "完整成本暂不比较节省额。" : "完整费用覆盖后比较情景预算。") : "未落实路线使总费用保持待确认。"}`,
          operation: "scenarios.compare",
          planningTab: "compare",
          duration: 800,
        },
        {
          role: "agent",
          title: "物流结论与执行边界",
          detail: summary,
          operation: "阶段总结",
          planningTab: "compare",
          duration: 700,
        },
      ];
    }
    const tabs =
      planning.kind === "allocation"
        ? [
            ["overview", "基本统计"],
            ["graph", "订单分车"],
            ["water", "注水演示"],
            ["allocation", "门店分车"],
          ]
        : [
            ["map", "路线地图"],
            ["routes", "到店路线"],
            ["compare", "港口比较"],
            ["batches", "到店批次"],
          ];
    return {
      ...base,
      planning,
      events: events.map((e, i) => ({
        ...e,
        sources: e.sources ?? ["门店模拟快照"],
        id: id + "-EVENT-" + i,
      })),
      duration: events.reduce((sum, e) => sum + e.duration, 0),
      blocks: tabs.map(([tab, title], i) => ({
        id: id + "-BLOCK-" + i,
        type: "planning-" + tab,
        title,
        status: "queued",
        skillRunId: id,
        inputVersion: state.version,
        revealAt: 1600 + i * 900,
        data: { tab },
        interactions:
          tab === "overview"
            ? ["查看统计", "查看图表明细", "导出统计快照"]
            : ["调整参数", "模拟重跑", "导出快照"],
        sourceRefs:
          tab === "overview"
            ? ["2026-08-05 独立模拟统计快照"]
            : ["门店模拟快照"],
      })),
      answer: undefined,
      planningSummary: summary,
    };
  } catch (error) {
    return {
      ...base,
      status: "blocked",
      blockedReason: error instanceof Error ? error.message : "参数无效",
      answer: error instanceof Error ? error.message : "参数无效",
    };
  }
}
