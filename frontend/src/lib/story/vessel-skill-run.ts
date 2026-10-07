import {
  latestStoreAllocation,
  startStorePlanningRun,
  type PlanningRunOptions,
} from "./store-planning-run";
import { vesselOverview } from "./vessel-overview";
import {
  replenishmentOverview,
  replenishmentOrders,
} from "./vessel-replenishment";
import { vesselOrders } from "./vessel-orders";
import type {
  CampaignState,
  StoryCommand,
  StoryEvent,
  StoryRun,
} from "./types";

export function startVesselSkillRun(
  id: string,
  command: StoryCommand,
  prompt: string,
  state: CampaignState,
  options: PlanningRunOptions,
): StoryRun {
  const previous =
    command === "/query" || command === "/order-allocation"
      ? latestStoreAllocation(state)
      : undefined;
  const base = startStorePlanningRun(id, "/vessel-allocation", prompt, state, {
    ...options,
    input: options.input ?? previous?.planning?.result.input,
  });
  if (base.status === "blocked" || base.planning?.kind !== "allocation")
    return { ...base, command };
  if (previous?.planning?.kind === "allocation" && !options.input)
    base.planning = structuredClone(previous.planning);
  // Historical brand-only scenarios retain their original graph and playback.
  if (command === "/vessel-allocation" && !base.planning.replenishment)
    return base;
  const result = base.planning.replenishment;
  const overview = result ? replenishmentOverview(result) : vesselOverview;
  const orders = result ? replenishmentOrders(result) : vesselOrders;
  const fmt = (value: number) => value.toLocaleString("zh-CN");
  const statistics = command === "/query";
  const orderSkill = command === "/order-allocation";
  const prefix = statistics
    ? "statistics"
    : orderSkill
      ? "orders"
      : "simulation";
  const sections = statistics
    ? [
        ["summary", "本船关键指标"],
        ["supply", "供给情况"],
        ["demand", "订单与需求缺口"],
        ["sales", "全网销速"],
        ["inventory", "仓店库存"],
        ["stores", "门店排名"],
      ]
    : orderSkill
      ? [
          ["summary", "订单概览"],
          ["routes", "门店订单与物流路线"],
          ["costs", "物流成本比较"],
        ]
      : [
          ["global", "全局模拟"],
          ["plan", "分车计划"],
          ["logistics", "物流方案"],
          ["profit", "利润计算"],
        ];
  const readEvent = base.events.find(
    (event) => event.operation === "vessel.overview.read",
  )!;
  const orderEvents = base.events.filter((event) =>
    ["vessel.orders.read", "vessel.orders.logistics"].includes(
      event.operation ?? "",
    ),
  );
  const events: Array<Omit<StoryEvent, "id">> = [
    {
      role: "analysis",
      operation: "思考",
      title: statistics
        ? "理解本轮统计范围"
        : orderSkill
          ? "确认订单优先与物流口径"
          : "确认补库目标与经营约束",
      detail: (statistics
        ? [
            `本轮使用 ${overview.snapshotDate} 的同一份业务快照，覆盖 ${overview.stores.length} 家门店与 ${overview.vpcs.length} 个 VPC；先核对本船供给、已确认订单和统计日期，避免不同快照的数据混用。`,
            "供给按车型与品牌汇总，需求分别列出当前订单和未来四周补库缺口；两种需求采用独立口径，避免重复相加。",
            "销量按历史月份和近八周周均销速展示，库存分为 VPC 与门店两层；库存水位与可售周数都保留对应的需求口径。",
            "结果拆为关键指标、供给、需求、销速、库存和门店排名六块，逐块生成；每块保留来源和统计口径。",
          ]
        : orderSkill
          ? [
              `本轮从 ${overview.stores.length} 家门店的订单读取车型与渠道需求，并与本船 ${fmt(overview.summary.supply)} 台供给核对。`,
              "先保护已确认订单，逐店检查可分配量与缺口；缺货车辆单列，不把补库车辆混入订单履约数量。",
              "单港和双港使用同一组订单比较，逐车次核对配载、卸货门店、车辆数量与运输成本，避免因比较范围不同产生偏差。",
              "输出门店订单、物流路线与成本比较；保留门店和车次明细，便于在地图与订单表之间交叉核对。",
            ]
          : [
              "先核对本船总量、预留比例、门店当前库存和已确认订单；订单保护与预留完成后，剩余车辆才进入补库池。",
              "以基准 WoS 和直营／授权级差确定各店目标水位，按车型注水分配；缺少销速或库存的数据单列，避免形成虚假的补库能力。",
              "物流按车辆分配结果测算，再结合价格系数、采购成本与直营固定费用核算经营结果；缺失成本保持未知。",
              "参数调整先用于预览，运行模拟后才保存新版本。分车、物流、利润使用同一个情景快照，历史版本保留各自的输入与结果。",
            ]
      )
        .map((item) => `• ${item}`)
        .join("\n"),
      duration: 1200,
    },
    {
      role: "agent",
      operation: "进度说明",
      title: "读取业务快照",
      detail: statistics
        ? "我先读取本船供给、订单、销量和库存资料，统一统计范围，再逐块生成分析结果。"
        : orderSkill
          ? "我先核对每家门店的订单与本船可分配车辆，再比较同一批订单的物流方案。"
          : "我先核对订单保护与预留约束，再模拟补库分配，并关联物流和经营结果。",
      duration: 300,
    },
    {
      role: "plan",
      operation: "规划",
      title: "执行计划",
      detail: sections
        .map(([, title], index) => `${index + 1}. ${title}`)
        .join("\n"),
      duration: 500,
    },
  ];
  let summary: string;
  if (statistics) {
    summary = `基本统计已完成，统计日期为 ${overview.snapshotDate}。\n\n• 本船供给 ${fmt(overview.summary.supply)} 台，已确认订单 ${fmt(overview.summary.orders)} 台，订单缺口 ${fmt(overview.summary.orderShortage)} 台。\n• 未来四周补库缺口 ${fmt(overview.summary.replenishmentShortage)} 台，订单与补库需求分别展示。\n• 覆盖 ${overview.stores.length} 家门店、${overview.vpcs.length} 个 VPC，门店库存 ${fmt(overview.summary.storeStock)} 台，VPC 库存 ${fmt(overview.summary.vpcStock)} 台。\n• 已生成供给、需求、销速、库存和门店排名。\n\n以上统计使用同一份模拟业务快照。`;
    const details = [
      readEvent.detail,
      `按车型与渠道核对 ${fmt(overview.summary.orders)} 台订单及未来四周 ${fmt(overview.summary.demand4Weeks)} 台需求，订单缺口 ${fmt(overview.summary.orderShortage)} 台，补库缺口 ${fmt(overview.summary.replenishmentShortage)} 台。`,
      `汇总 ${overview.vpcs.length} 个 VPC、${overview.regions.length} 个大区与 ${overview.stores.length} 家门店的历史销量；使用近八周周均销量比较销速。`,
      `门店库存 ${fmt(overview.summary.storeStock)} 台，VPC 库存 ${fmt(overview.summary.vpcStock)} 台；分别展示渠道与区域分布，避免库存重复计入。`,
      `按门店周均销量排序，支持查看直营与授权门店及车型明细，保留统计日期与来源口径。`,
    ];
    sections.slice(1).forEach(([name, title], index) =>
      events.push({
        ...readEvent,
        role: "tool",
        title: `生成${title}`,
        detail: details[index],
        guiBlock: `statistics-${name}`,
        duration: 850,
      }),
    );
  } else if (orderSkill) {
    summary = `订单分车已完成。\n\n• 本船订单需求 ${fmt(overview.summary.orders)} 台，可分配 ${fmt(orders.plans.dual.quantity)} 台，缺口 ${fmt(overview.summary.orderShortage)} 台单列。\n• 单港方案：${orders.plans.single.trips.length} 车次，运输成本 ${fmt(orders.plans.single.totalCost)} SAR。\n• 双港方案：${orders.plans.dual.trips.length} 车次，运输成本 ${fmt(orders.plans.dual.totalCost)} SAR。\n\n订单、配载及卸货明细已同步至画布。`;
    orderEvents.forEach((event, index) =>
      events.push({
        ...event,
        guiBlock: index ? "orders-costs" : "orders-routes",
        duration: 1300,
      }),
    );
  } else {
    summary = base.planningSummary ?? "分车计划模拟已完成。";
    base.events
      .filter(
        (event) =>
          ![
            "规划",
            "阶段总结",
            "vessel.overview.read",
            "vessel.orders.read",
            "vessel.orders.logistics",
          ].includes(event.operation ?? ""),
      )
      .forEach((event) =>
        events.push({
          ...event,
          duration: 950,
          guiBlock:
            event.operation === "commercial.simulate"
              ? "simulation-profit"
              : event.operation === "stock.waterfill"
                ? "simulation-plan"
                : "simulation-global",
        }),
      );
  }
  events.push({
    role: "analysis",
    operation: "思考",
    title: statistics
      ? "复核统计口径与结果关联"
      : orderSkill
        ? "复核订单守恒与物流比较"
        : "复核分车、物流与经营结果",
    detail: `• 核对本船供给 ${fmt(overview.summary.supply)} 台、订单 ${fmt(overview.summary.orders)} 台及缺口 ${fmt(overview.summary.orderShortage)} 台，确保 CUI 与画布来自同一份快照。\n• ${statistics ? "门店与 VPC 库存分别列示，历史销量与当前订单分别保留统计范围；门店排名可用于后续查看库存压力。" : orderSkill ? "单港与双港运输方案比较同一批可分配订单，缺口不计入已完成配载；保留每个门店的卸货记录。" : "预览参数与已保存版本分别保留，分车数量、物流成本和经营指标一同更新；未提供的成本不作为零成本。"}\n• 已将结果同步至独立画布，统计口径与来源保留。`,
    duration: 950,
  });
  events.push({
    role: "agent",
    operation: "阶段总结",
    title: statistics
      ? "基本统计已生成"
      : orderSkill
        ? "订单分车已完成"
        : "分车模拟已完成",
    detail: summary,
    duration: 600,
  });
  const duration = events.reduce((sum, event) => sum + event.duration, 0);
  return {
    ...base,
    command,
    events: events.map((event, index) => ({
      ...event,
      sources: event.sources ?? [overview.snapshotDate + " 模拟快照"],
      id: `${id}-EVENT-${index}`,
    })),
    duration,
    planningSummary: summary,
    nextSkillSuggestions: statistics
      ? ["/order-allocation", "/vessel-allocation"]
      : orderSkill
        ? ["/vessel-allocation"]
        : ["/delivery-plan"],
    blocks: sections.map(([name, title], index) => ({
      id: `${id}-BLOCK-${name}`,
      type: `${prefix}-${name}`,
      title,
      status: "queued",
      skillRunId: id,
      inputVersion: state.version,
      revealAt: 1800 + (index * (duration - 2200)) / sections.length,
      data: {},
      interactions: ["查看明细", "导出快照"],
      sourceRefs: [overview.snapshotDate + " 模拟快照"],
    })),
  };
}
