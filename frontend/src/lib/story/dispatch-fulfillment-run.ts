import {
  buildDispatchFulfillment,
  dispatchSelectionIssue,
  dispatchSourceRun,
  effectiveDispatchOptions,
} from "./dispatch-fulfillment";
import type { CampaignState, StoryEvent, StoryRun } from "./types";

export function startDispatchFulfillmentRun(
  id: string,
  prompt: string,
  state: CampaignState,
  sourceId?: string,
): StoryRun {
  const source = dispatchSourceRun(state, sourceId);
  const base: StoryRun = {
    id,
    command: "/shortage-fulfillment",
    prompt,
    businessDate: source?.businessDate ?? "今日缺货处理",
    inputVersion: state.version,
    status: "blocked",
    elapsed: 0,
    duration: 0,
    events: [],
    blocks: [],
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: [],
  };
  const issue = dispatchSelectionIssue(source?.dispatch);
  if (issue) return { ...base, blockedReason: issue, answer: issue };
  const dispatch = structuredClone(source!.dispatch!);
  const defaultCount = effectiveDispatchOptions(dispatch).filter(
    (s) => s.defaulted,
  ).length;
  dispatch.fulfillment = buildDispatchFulfillment(dispatch, source!.id, id);
  const result = dispatch.fulfillment;
  dispatch.selections = { ...result.selections };
  const selectionPolicy = defaultCount
    ? `${defaultCount} 台未手动选择，默认采用贡献利润最高的方案；手动选择保持不变。`
    : "全部沿用当前已选方案。";
  const local = result.instructions.filter(
    (i) => i.kind === "local-dealer",
  ).length;
  const review = result.instructions.filter((i) => i.requiresReview).length;
  const summary = `${selectionPolicy}已为 ${result.instructions.length} 台缺货车辆生成调度建议：${result.instructions.length - local} 台跨区调拨、${local} 台授权店采购；按供应商与收货门店合并为 ${result.purchaseOrders.length} 张采购单草案，采购金额 ${result.purchaseOrders.reduce((n, po) => n + po.purchase, 0).toLocaleString("en-US")} SAR。${review ? `其中 ${review} 台存在亏损或超期，已标注待复核。` : "所有已选方案均按期且贡献利润为正。"}04 部分可切换调度建议与采购订单，并随整份计划导出。单据已保存为演示草案，待车源和报价确认。`;
  const events: Omit<StoryEvent, "id">[] = [
    {
      role: "thinking",
      title: "按已选方案处理区域缺货",
      operation: "思考",
      detail:
        "沿用当前每日调拨快照，保留已手动选择的补齐方案；未选择的车辆默认采用贡献利润最高的候选方案，同利润时优先更快到店。跨区车生成调拨配送建议，本区采购车同时生成采购单与提车配送建议。",
      duration: 900,
    },
    {
      role: "plan",
      title: "执行计划",
      operation: "规划",
      detail:
        "1. 读取手动选择，未选车辆按贡献利润最高补齐。\n2. 保留所选车源、候选车辆、成本和时效。\n3. 按供应商与收货门店合并授权店采购单。\n4. 校验单车唯一性、金额与数量，生成 04 部分。",
      duration: 800,
    },
    {
      role: "data",
      title: "读取逐车选择与原始订单",
      operation: "shortage.selections.read",
      detail: `读取 ${dispatch.date} 快照中 ${result.instructions.length} 台车辆的方案。${selectionPolicy}全部车辆均匹配有效候选车源，库存编号无重复。`,
      duration: 1000,
    },
    {
      role: "tool",
      title: "生成缺货车辆配送建议",
      operation: "dispatch.instructions.build",
      detail: `${result.instructions.length} 台车辆逐一关联原订单、来源、目的门店、配送方式、费用与预计到店时间。已选跨区方案 ${result.instructions.length - local} 台，本区授权店方案 ${local} 台。`,
      duration: 1300,
    },
    {
      role: "tool",
      title: "汇总授权店采购订单",
      operation: "dealer.purchase-orders.draft",
      detail: `${local} 台采购车辆合并为 ${result.purchaseOrders.length} 张采购单，同一供应商与收货门店的车辆进入同一张订单；每一行保留车型、配置、颜色、候选车辆与采购单价。`,
      duration: 1300,
    },
    {
      role: "validation",
      title: "校验单据数量与费用",
      operation: "documents.validate",
      detail: `缺货车辆 ${dispatch.shortages.length} 台 = 配送建议 ${result.instructions.length} 台；采购单合计 ${local} 台，跨区车辆不重复进入采购单。${review} 台亏损或超期车辆在单据中标注待复核，生成结果保留本次选项快照。`,
      duration: 1000,
      guiBlock: "dispatch-fulfillment",
    },
    {
      role: "agent",
      title: "缺货调度与采购单已生成",
      operation: "阶段总结",
      detail: summary,
      duration: 700,
    },
  ];
  return {
    ...base,
    status: "running",
    dispatch,
    answer: summary,
    duration: events.reduce((n, event) => n + event.duration, 0),
    events: events.map((event, i) => ({
      ...event,
      id: `${id}-EVENT-${i}`,
      sources: [`${dispatch.date} 已选缺货方案快照`],
    })),
    blocks: [
      ...source!.blocks
        .filter((b) => b.type !== "dispatch-fulfillment")
        .map((b) => ({
          ...b,
          id: `${id}-${b.type}`,
          skillRunId: id,
          inputVersion: state.version,
          revealAt: 0,
          status: "ready" as const,
        })),
      {
        id: `${id}-BLOCK-fulfillment`,
        type: "dispatch-fulfillment",
        title: "缺货调度建议与采购订单",
        status: "queued",
        revealAt: 6300,
        skillRunId: id,
        inputVersion: state.version,
        data: {},
        interactions: ["切换单据", "导出快照"],
        sourceRefs: [source!.id],
      },
    ],
  };
}
