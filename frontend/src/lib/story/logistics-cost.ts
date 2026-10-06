import type { PortDelivery } from "./store-planning";
import data from "../profit-data.json";
export type CostRates = {
  portHandling: number | null;
  pdi: number | null;
  lastMile: number | null;
  vpcHandling: number | null;
  storageDaily: number | null;
  storageDays: number | null;
};
export const costLabels: Record<keyof CostRates, string> = {
  portHandling: "港口处理",
  pdi: "整备 PDI",
  lastMile: "末端配送",
  vpcHandling: "VPC 处理",
  storageDaily: "VPC 每日暂存",
  storageDays: "暂存天数",
};
export const unknownCostRates: CostRates = {
  portHandling: null,
  pdi: null,
  lastMile: null,
  vpcHandling: null,
  storageDaily: null,
  storageDays: null,
};
// Defaults are explicitly authored simulation assumptions, not carrier quotes.
export const completeCostRates: CostRates = {
  ...data.rates,
  storageDays: data.storageDays,
};
export type CostBreakdown = {
  linehaul: number;
  portHandling: number | null;
  pdi: number | null;
  lastMile: number | null;
  vpcHandling: number | null;
  storage: number | null;
  knownTotal: number;
  total: number | null;
  missing: string[];
};
export function costBreakdown(
  linehaul: number,
  qty: number,
  via: number,
  rates: CostRates,
): CostBreakdown {
  for (const value of Object.values(rates))
    if (value !== null && (!Number.isFinite(value) || value < 0))
      throw new Error("物流费用和暂存天数必须是非负数或留空");
  const amount = (rate: number | null, n: number) =>
    n === 0 ? 0 : rate === null ? null : rate * n;
  const parts = {
    linehaul,
    portHandling: amount(rates.portHandling, qty),
    pdi: amount(rates.pdi, qty),
    lastMile: amount(rates.lastMile, qty),
    vpcHandling: amount(rates.vpcHandling, via),
    storage:
      via === 0 || rates.storageDaily === 0 || rates.storageDays === 0
        ? 0
        : rates.storageDaily === null || rates.storageDays === null
          ? null
          : via * rates.storageDaily * rates.storageDays,
  };
  const missing = Object.entries(parts)
    .filter(([, v]) => v === null)
    .map(([k]) =>
      k === "storage" ? "VPC 暂存" : costLabels[k as keyof CostRates],
    );
  const knownTotal = Object.values(parts).reduce<number>(
    (s, v) => s + (v ?? 0),
    0,
  );
  return {
    ...parts,
    knownTotal,
    total: missing.length ? null : knownTotal,
    missing,
  };
}
export function addDeliveryCosts(
  port: PortDelivery,
  rates: CostRates,
): PortDelivery {
  const costs = costBreakdown(
    port.batches.reduce((s, b) => s + b.cost, 0),
    port.summary.direct + port.summary.viaVpc,
    port.summary.viaVpc,
    rates,
  );
  if (port.summary.unrouted) costs.missing.push("未落实路线");
  if (costs.missing.length) costs.total = null;
  return {
    ...port,
    costs,
    summary: {
      ...port.summary,
      knownCost: costs.knownTotal,
      cost: costs.total,
    },
  };
}
export function parseCostRates(prompt: string, base: CostRates): CostRates {
  const rates = { ...base };
  if (prompt.includes("演示费率")) Object.assign(rates, completeCostRates);
  for (const [label, key] of [
    ["港口费", "portHandling"],
    ["整备", "pdi"],
    ["末端", "lastMile"],
    ["VPC费", "vpcHandling"],
    ["暂存日费", "storageDaily"],
    ["暂存天数", "storageDays"],
  ] as const) {
    const match = prompt.match(
      new RegExp(label + "\\s*[=：:]\\s*([^\\s;；]+)"),
    );
    if (match)
      rates[key] =
        match[1] === "待确认" ? null : Number(match[1].replaceAll(",", ""));
  }
  return rates;
}
