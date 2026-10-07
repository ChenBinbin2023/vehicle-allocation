import data from "../profit-data.json";
import { costBreakdown, type CostRates } from "./logistics-cost";
import type { StoreAllocation, StoreDelivery } from "./store-planning";
export type ProfitOrder = {
  id: string;
  storeId: string;
  brand: string;
  model: string;
  qty: number;
  unitPrice: number | null;
  discount: number | null;
  purchase: number | null;
  commissionPct: number | null;
  other: number | null;
};
export type ProfitScenario = {
  mode: "single" | "dual";
  costRates: CostRates;
  orders: ProfitOrder[];
};
export type ProfitMoney = {
  qty: number;
  revenue: number | null;
  purchase: number | null;
  logistics: number | null;
  commission: number | null;
  other: number | null;
  profit: number | null;
  margin: number | null;
};
export type ProfitRow = ProfitOrder &
  ProfitMoney & {
    storeName: string;
    city: string;
    linehaul: number | null;
    vpcShare: number;
    missing: string[];
  };
export type ProfitGroup = ProfitMoney & {
  id: string;
  name: string;
  orderIds: string[];
  missing: string[];
};
export type ProfitResult = {
  input: ProfitScenario;
  orders: ProfitRow[];
  models: ProfitGroup[];
  stores: ProfitGroup[];
  summary: ProfitMoney & {
    negativeOrders: number;
    unknownOrders: number;
    orderCount: number;
  };
  summaryText: string;
};
export type ProfitSnapshot = {
  deliveryRunId: string;
  allocation: StoreAllocation;
  delivery: StoreDelivery;
  result: ProfitResult;
};
export function defaultProfitScenario(
  allocation: StoreAllocation,
  delivery: StoreDelivery,
): ProfitScenario {
  const models = data.models.filter((m) =>
    (allocation.input.brand ?? "丰田").split(" / ").includes(m.brand),
  );
  const stores = allocation.rows
    .filter(
      (s) =>
        s.total >= 2 &&
        delivery[delivery.input.mode].rows.some(
          (r) => r.storeId === s.id && r.directQty + r.viaVpcQty >= 2,
        ),
    )
    .slice(0, 3);
  const rates = {
    ...data.rates,
    storageDays: data.storageDays,
    ...delivery.input.costRates,
  } as CostRates;
  const orders = stores.flatMap((s, i) => {
    const eligible = models.filter((m) =>
      (s.brand ?? allocation.input.brand ?? "丰田")
        .split(" / ")
        .includes(m.brand),
    );
    return [0, 1].map((n) => ({
      ...eligible[(i + n) % eligible.length],
      id: `SIM-SALE-${i + 1}-${n + 1}`,
      storeId: s.id,
      qty: Math.min(n ? 2 : 3, Math.floor(s.total / 2)),
    }));
  });
  return { mode: delivery.input.mode, costRates: rates, orders };
}
const moneyKeys = [
  "revenue",
  "purchase",
  "logistics",
  "commission",
  "other",
  "profit",
] as const;
function sumMoney(rows: ProfitMoney[]): ProfitMoney {
  const sums = Object.fromEntries(
    moneyKeys.map((k) => [
      k,
      rows.some((r) => r[k] === null)
        ? null
        : rows.reduce((s, r) => s + r[k]!, 0),
    ]),
  ) as Pick<ProfitMoney, (typeof moneyKeys)[number]>;
  return {
    ...sums,
    qty: rows.reduce((s, r) => s + r.qty, 0),
    margin:
      sums.profit === null || !sums.revenue ? null : sums.profit / sums.revenue,
  };
}
export function calculateProfit(
  allocation: StoreAllocation,
  delivery: StoreDelivery,
  input: ProfitScenario,
): ProfitResult {
  if (input.mode !== "single" && input.mode !== "dual")
    throw new Error("请选择单港或双港情景");
  costBreakdown(0, 0, 0, input.costRates);
  const ids = new Set<string>(),
    qtyByStore: Record<string, number> = {};
  for (const o of input.orders) {
    if (!o.id.trim() || ids.has(o.id))
      throw new Error("销售情景订单 ID 为空或重复");
    ids.add(o.id);
    const store = allocation.rows.find((s) => s.id === o.storeId);
    if (!store) throw new Error("未找到绑定分车门店 " + o.storeId);
    if (
      !(store.brand ?? allocation.input.brand ?? "丰田")
        .split(" / ")
        .includes(o.brand)
    )
      throw new Error("订单品牌与分车品牌不一致");
    if (!o.model.trim()) throw new Error("车型不能为空");
    if (!Number.isInteger(o.qty) || o.qty <= 0)
      throw new Error("订单数量必须是正整数");
    qtyByStore[o.storeId] = (qtyByStore[o.storeId] ?? 0) + o.qty;
    if (qtyByStore[o.storeId] > store.total)
      throw new Error("销售情景数量超过门店分车量");
    for (const k of [
      "unitPrice",
      "discount",
      "purchase",
      "commissionPct",
      "other",
    ] as const)
      if (o[k] !== null && (!Number.isFinite(o[k]) || o[k]! < 0))
        throw new Error("财务参数必须非负或留空");
    if (o.unitPrice !== null && o.discount !== null && o.discount > o.unitPrice)
      throw new Error("折扣不能超过单价");
    if (o.commissionPct !== null && o.commissionPct > 100)
      throw new Error("佣金率不能超过 100%");
  }
  const port = delivery[input.mode];
  const orders: ProfitRow[] = input.orders.map((o) => {
    const store = allocation.rows.find((s) => s.id === o.storeId)!;
    const route = port.rows.find((r) => r.storeId === o.storeId);
    const routed = (route?.directQty ?? 0) + (route?.viaVpcQty ?? 0);
    const linehaul = port.batches
      .filter((b) => b.storeId === o.storeId)
      .reduce((s, b) => s + b.cost, 0);
    const cost = costBreakdown(
      linehaul,
      routed,
      route?.viaVpcQty ?? 0,
      input.costRates,
    );
    const missing = [...cost.missing];
    if (!routed || qtyByStore[o.storeId] > routed)
      missing.push("销售情景车辆尚未全部落实运输");
    for (const [key, label] of [
      ["unitPrice", "销售单价"],
      ["discount", "折扣"],
      ["purchase", "采购成本"],
      ["commissionPct", "佣金率"],
      ["other", "其他费用"],
    ] as const)
      if (o[key] === null) missing.push(label);
    const revenue =
      o.unitPrice === null || o.discount === null
        ? null
        : o.qty * (o.unitPrice - o.discount);
    const purchase = o.purchase === null ? null : o.qty * o.purchase;
    const logistics =
      cost.total === null || !routed || qtyByStore[o.storeId] > routed
        ? null
        : (o.qty * cost.total) / routed;
    const commission =
      revenue === null || o.commissionPct === null
        ? null
        : (revenue * o.commissionPct) / 100;
    const other = o.other === null ? null : o.qty * o.other;
    const profit = [revenue, purchase, logistics, commission, other].some(
      (v) => v === null,
    )
      ? null
      : revenue! - purchase! - logistics! - commission! - other!;
    return {
      ...o,
      storeName: store.name,
      city: store.city ?? "",
      revenue,
      purchase,
      logistics,
      commission,
      other,
      profit,
      margin: profit === null || !revenue ? null : profit / revenue,
      linehaul: routed ? (o.qty * linehaul) / routed : null,
      vpcShare: routed ? (route?.viaVpcQty ?? 0) / routed : 0,
      missing,
    };
  });
  function group(
    key: (o: ProfitRow) => string,
    name: (o: ProfitRow) => string,
  ): ProfitGroup[] {
    const buckets = new Map<string, ProfitRow[]>();
    for (const o of orders)
      buckets.set(key(o), [...(buckets.get(key(o)) ?? []), o]);
    return [...buckets].map(([id, rows]) => ({
      ...sumMoney(rows),
      id,
      name: name(rows[0]),
      orderIds: rows.map((o) => o.id),
      missing: [...new Set(rows.flatMap((o) => o.missing))],
    }));
  }
  const summary = {
    ...sumMoney(orders),
    negativeOrders: orders.filter((o) => o.profit !== null && o.profit < 0)
      .length,
    unknownOrders: orders.filter((o) => o.profit === null).length,
    orderCount: orders.length,
  };
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const summaryText = `${summary.orderCount} 笔销售情景订单、${summary.qty} 台；${input.mode === "single" ? "单港" : "双港"}贡献利润${summary.profit === null ? "待确认" : ` ${fmt(summary.profit)} SAR`}。亏损订单 ${summary.negativeOrders} 笔，费用或价格未齐 ${summary.unknownOrders} 笔。仅计算这些情景订单，补库存不自动计入销售；未包含税费及固定经营费用。`;
  return {
    input: structuredClone(input),
    orders,
    models: group(
      (o) => o.brand + "/" + o.model,
      (o) => o.brand + " · " + o.model,
    ),
    stores: group(
      (o) => o.storeId,
      (o) => o.storeName,
    ),
    summary,
    summaryText,
  };
}
