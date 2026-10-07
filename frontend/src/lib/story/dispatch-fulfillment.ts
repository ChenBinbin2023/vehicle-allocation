import type { DispatchOption, DispatchSnapshot } from "./daily-dispatch";
import type { CampaignState, StoryRun } from "./types";

export const dispatchFulfillmentPrompt =
  "针对所有的缺货，基于选择的方案，生成调度建议，以及授权店采购订单。";

export type DispatchInstruction = {
  id: string;
  vehicleId: string;
  orderId: string;
  optionId: string;
  vin: string;
  sourceId: string;
  storeId: string;
  kind: DispatchOption["kind"];
  mode: string;
  logistics: number;
  arrivalHours: number;
  profit: number;
  requiresReview: boolean;
  purchaseOrderId?: string;
};
export type DispatchPurchaseOrder = {
  id: string;
  supplierId: string;
  storeId: string;
  quantity: number;
  purchase: number;
  logistics: number;
  other: number;
  totalCost: number;
  profit: number;
  arrivalHours: number;
  requiresReview: boolean;
  lines: {
    vehicleId: string;
    orderId: string;
    optionId: string;
    vin: string;
    model: string;
    trim: string;
    color: string;
    purchase: number;
    logistics: number;
    other: number;
    profit: number;
  }[];
};
export type DispatchFulfillment = {
  sourceRunId: string;
  selections: Record<string, string>;
  instructions: DispatchInstruction[];
  purchaseOrders: DispatchPurchaseOrder[];
};

export function dispatchSourceRun(state: CampaignState, id?: string) {
  const candidates = state.runs.filter(
    (run) => run.dispatch && run.status === "complete",
  );
  return id
    ? candidates.find((run) => run.id === id)
    : (candidates.find((run) => run.id === state.activeRunId) ??
        candidates.at(-1));
}

export function selectedDispatchOptions(data: DispatchSnapshot) {
  return data.shortages.map((shortage) => ({
    shortage,
    option: shortage.options.find(
      (option) => option.id === data.selections?.[shortage.vehicleId],
    ),
  }));
}

export function dispatchSelectionIssue(data?: DispatchSnapshot) {
  if (!data) return "请先生成每日调拨计划，并为缺货车辆选择补齐方案。";
  if (!data.shortages.length) return "当前计划没有缺货车辆，无需生成缺货单据。";
  const selected = selectedDispatchOptions(data);
  const missing = selected.filter((item) => !item.option).length;
  if (missing)
    return `还有 ${missing} 台缺货车辆未选择有效方案，请在 03 区域逐车选择。`;
  const vins = selected.map((item) => item.option!.vin);
  if (new Set(vins).size !== vins.length)
    return "已选方案存在重复候选车辆，请重新选择车源。";
}

export function dispatchFulfillmentIsCurrent(data: DispatchSnapshot) {
  return Boolean(
    data.fulfillment &&
    data.shortages.every(
      (s) =>
        data.selections?.[s.vehicleId] ===
        data.fulfillment!.selections[s.vehicleId],
    ),
  );
}

export function chooseDispatchOptions(
  run: StoryRun,
  selections: Record<string, string>,
): StoryRun {
  if (!run.dispatch || run.status !== "complete") return run;
  const valid = Object.entries(selections).filter(([vehicleId, optionId]) =>
    run.dispatch!.shortages.some(
      (s) =>
        s.vehicleId === vehicleId && s.options.some((o) => o.id === optionId),
    ),
  );
  return {
    ...run,
    dispatch: {
      ...run.dispatch,
      selections: { ...run.dispatch.selections, ...Object.fromEntries(valid) },
    },
  };
}

export function buildDispatchFulfillment(
  data: DispatchSnapshot,
  sourceRunId: string,
  runId: string,
): DispatchFulfillment {
  const issue = dispatchSelectionIssue(data);
  if (issue) throw new Error(issue);
  const instructions: DispatchInstruction[] = [];
  const purchaseOrders: DispatchPurchaseOrder[] = [];
  for (const { shortage, option: choice } of selectedDispatchOptions(data)) {
    const option = choice!;
    const vehicle = data.vehicles.find((v) => v.id === shortage.vehicleId)!;
    const order = data.orders.find((o) => o.id === vehicle.orderId)!;
    const instruction: DispatchInstruction = {
      id: `DSP-${data.date.replaceAll("-", "")}-${runId}-${instructions.length + 1}`,
      vehicleId: vehicle.id,
      orderId: order.id,
      optionId: option.id,
      vin: option.vin,
      sourceId: option.sourceId,
      storeId: order.storeId,
      kind: option.kind,
      mode: option.mode,
      logistics: option.logistics,
      arrivalHours: option.arrivalHours,
      profit: option.profit,
      requiresReview: option.profit < 0 || !option.onTime,
    };
    if (option.kind === "local-dealer") {
      let po = purchaseOrders.find(
        (p) => p.supplierId === option.sourceId && p.storeId === order.storeId,
      );
      if (!po) {
        po = {
          id: `PO-${data.date.replaceAll("-", "")}-${runId}-${purchaseOrders.length + 1}`,
          supplierId: option.sourceId,
          storeId: order.storeId,
          quantity: 0,
          purchase: 0,
          logistics: 0,
          other: 0,
          totalCost: 0,
          profit: 0,
          arrivalHours: 0,
          requiresReview: false,
          lines: [],
        };
        purchaseOrders.push(po);
      }
      po.lines.push({
        vehicleId: vehicle.id,
        orderId: order.id,
        optionId: option.id,
        vin: option.vin,
        model: order.model,
        trim: order.trim,
        color: order.color,
        purchase: option.purchase,
        logistics: option.logistics,
        other: option.other,
        profit: option.profit,
      });
      po.quantity++;
      po.purchase += option.purchase;
      po.logistics += option.logistics;
      po.other += option.other;
      po.totalCost += option.totalCost;
      po.profit += option.profit;
      po.arrivalHours = Math.max(po.arrivalHours, option.arrivalHours);
      po.requiresReview ||= instruction.requiresReview;
      instruction.purchaseOrderId = po.id;
    }
    instructions.push(instruction);
  }
  return {
    sourceRunId,
    selections: { ...data.selections },
    instructions,
    purchaseOrders,
  };
}
