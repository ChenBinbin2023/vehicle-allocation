import network from "../store-planning-data.json";
import { vesselOrders } from "./vessel-orders";
import type { VesselReplenishment } from "./vessel-replenishment";

export const commercialHubs = [
  { id: "JED", name: "吉达 VPC", city: "吉达", coordinates: [39.2, 21.55] },
  { id: "RUH", name: "利雅得 VPC", city: "利雅得", coordinates: [46.7, 24.65] },
  { id: "DMM", name: "达曼 VPC", city: "达曼", coordinates: [50.08, 26.45] },
  {
    id: "NORTH",
    name: "北部区域中转中心（模拟）",
    city: "哈伊勒",
    coordinates: [41.7, 27.52],
  },
  {
    id: "SOUTH",
    name: "南部区域中转中心（模拟）",
    city: "艾卜哈",
    coordinates: [42.5, 18.23],
  },
];
export type ModelPricing = {
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  retailFactor: number;
  wholesaleFactor: number;
  fixedCost: number;
};
export type StoreLogistics = {
  baseUnitCost: number;
  factor: number;
  hub: string;
};
export type CommercialParameters = {
  pricing: Record<string, ModelPricing>;
  logistics: Record<string, StoreLogistics>;
  simulation?: {
    regions: Record<string, number>;
    retailFactor: number;
    wholesaleFactor: number;
  };
};
export type CommercialPart = {
  storeId: string;
  model: string;
  quantity: number;
  cost: number;
};
export type CommercialTrip = {
  id: string;
  stage: "direct" | "transfer" | "last-mile";
  trigger: string;
  originId: string;
  destinationId: string;
  origin: string;
  destination: string;
  quantity: number;
  capacity: number;
  cost: number;
  parts: CommercialPart[];
};
export type CommercialMoney = {
  quantity: number;
  revenue: number;
  gross: number;
  logistics: number;
  fixed: number;
  net: number;
  margin: number | null;
};
export type CommercialProfitRow = CommercialMoney & {
  storeId: string;
  storeName: string;
  model: string;
  channel: "直营" | "授权";
  purchasePrice: number;
  unitPrice: number;
  unitGross: number;
  unitNet: number;
  unitLogistics: number;
  unitFixed: number;
  priceFactor: number;
};
export type CommercialResult = {
  input: CommercialParameters;
  logistics: {
    quantity: number;
    direct: number;
    viaHub: number;
    totalCost: number;
    stores: {
      storeId: string;
      name: string;
      channel: string;
      city: string;
      quantity: number;
      direct: number;
      viaHub: number;
      hub: string;
      baseUnitCost: number;
      factor: number;
      unitCost: number;
      cost: number;
    }[];
    trips: CommercialTrip[];
  };
  profit: {
    rows: CommercialProfitRow[];
    stores: (CommercialMoney & { id: string; name: string; channel: string })[];
    models: (CommercialMoney & { id: string; name: string })[];
    summary: CommercialMoney;
  };
};
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function defaultCommercialParameters(): CommercialParameters {
  // Prices are explicit demo assumptions in SAR, not observed market prices.
  const examples: Record<string, [number, number, number]> = {
    Camry: [99000, 120000, 110000],
    Yaris: [51000, 66000, 59000],
    Hilux: [95000, 115000, 105000],
    Corolla: [67000, 85000, 77000],
    "Land Cruiser 300": [275000, 320000, 295000],
    "Prado 250": [166000, 205000, 188000],
    "RAV4 Hybrid": [112000, 142000, 128000],
    Fortuner: [98000, 124000, 112000],
    Highlander: [139000, 175000, 158000],
    "Lexus LX 600": [550000, 620000, 590000],
    "Lexus ES 300h": [193000, 220000, 208000],
    "Lexus RX 350h": [280000, 315000, 300000],
    "Lexus NX 350h": [198000, 238000, 218000],
  };
  return {
    pricing: Object.fromEntries(
      Object.entries(examples).map(
        ([model, [purchasePrice, retailPrice, wholesalePrice]]) => [
          model,
          {
            purchasePrice,
            retailPrice,
            wholesalePrice,
            retailFactor: 1,
            wholesaleFactor: 1,
            fixedCost: 800,
          },
        ],
      ),
    ),
    logistics: Object.fromEntries(
      vesselOrders.stores.map((s) => {
        const route = network.routes.find(
          (r) => r.originId === "P-W" && r.city === s.city,
        )!;
        return [
          s.id,
          {
            baseUnitCost: cents(route.tripCost / 8 + 400 + 300),
            factor: 1,
            hub:
              s.region === "东部"
                ? "DMM"
                : s.region === "中部"
                  ? "RUH"
                  : s.region === "北部"
                    ? "NORTH"
                    : s.region === "南部"
                      ? "SOUTH"
                      : "JED",
          },
        ];
      }),
    ),
  };
}
function number(value: number, label: string, min = 0, max = 10000000) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(label + "须为 " + min + "–" + max + " 之间的数值");
}
export function validateCommercialParameters(p: CommercialParameters) {
  for (const s of vesselOrders.stores) {
    const row = p.logistics[s.id];
    if (!row) throw new Error(s.name + "缺少物流参数");
    number(row.baseUnitCost, s.name + "基准物流成本", 0, 100000);
    number(row.factor, s.name + "物流系数", 0, 5);
    if (!commercialHubs.some((h) => h.id === row.hub))
      throw new Error(s.name + "中转中心无效");
  }
  for (const model of Object.keys(defaultCommercialParameters().pricing)) {
    const r = p.pricing[model];
    if (!r) throw new Error(model + "缺少定价参数");
    for (const key of [
      "purchasePrice",
      "retailPrice",
      "wholesalePrice",
      "fixedCost",
    ] as const)
      number(r[key], model + " " + key);
    number(r.retailFactor, model + "零售系数", 0.01, 5);
    number(r.wholesaleFactor, model + "批发系数", 0.01, 5);
    if (r.wholesalePrice <= 0 || r.retailPrice <= r.wholesalePrice)
      throw new Error(model + "基准零售价须高于批发价，且批发价须大于 0");
    const retail = cents(r.retailPrice * r.retailFactor),
      wholesale = cents(r.wholesalePrice * r.wholesaleFactor);
    if (retail <= wholesale)
      throw new Error(model + "调整后零售价须高于调整后批发价");
    if (cents(retail - r.fixedCost) <= wholesale)
      throw new Error(
        model +
          "同等物流成本下直营单车净利必须高于授权；零售与批发成交价差须大于直营固定费用",
      );
  }
}
function sum(rows: CommercialMoney[]): CommercialMoney {
  const total = {
    quantity: 0,
    revenue: 0,
    gross: 0,
    logistics: 0,
    fixed: 0,
    net: 0,
    margin: null as number | null,
  };
  for (const r of rows)
    for (const k of [
      "quantity",
      "revenue",
      "gross",
      "logistics",
      "fixed",
      "net",
    ] as const)
      total[k] += r[k];
  for (const k of ["revenue", "gross", "logistics", "fixed", "net"] as const)
    total[k] = cents(total[k]);
  total.margin = total.revenue ? total.net / total.revenue : null;
  return total;
}
export function calculateCommercial(
  result: VesselReplenishment,
  parameters = result.parameters.commercial ?? defaultCommercialParameters(),
): CommercialResult {
  const input = structuredClone(parameters),
    capacity = result.parameters.truckCapacity;
  // Global controls multiply the individual overrides. Keep the stored inputs
  // intact so changing versions never compounds a multiplier a second time.
  const global = input.simulation;
  if (global) {
    number(global.retailFactor, "全局零售价格系数", 0.01, 5);
    number(global.wholesaleFactor, "全局批发价格系数", 0.01, 5);
    for (const [region, factor] of Object.entries(global.regions)) {
      if (!["西部", "中部", "东部", "北部", "南部"].includes(region))
        throw new Error("未知物流大区：" + region);
      number(factor, region + "物流系数", 0, 5);
    }
    const factor = (value: number) => Math.round(value * 1e6) / 1e6;
    for (const s of result.stores)
      input.logistics[s.id].factor = factor(
        input.logistics[s.id].factor * (global.regions[s.region] ?? 1),
      );
    for (const r of Object.values(input.pricing)) {
      r.retailFactor = factor(r.retailFactor * global.retailFactor);
      r.wholesaleFactor = factor(r.wholesaleFactor * global.wholesaleFactor);
    }
    delete input.simulation;
  }
  validateCommercialParameters(input);
  const stores = result.stores.map((s) => {
    const r = input.logistics[s.id],
      unitCost = cents(r.baseUnitCost * r.factor);
    return {
      storeId: s.id,
      name: s.name,
      channel: s.channel,
      city: s.city,
      quantity: s.replenishment,
      direct: s.directQty,
      viaHub: s.vpcQty,
      ...r,
      unitCost,
      cost: cents(unitCost * s.replenishment),
    };
  });
  const profitRows = result.stores.flatMap((s) =>
    s.models.map((m) => {
      const pricing = input.pricing[m.model],
        logistics = stores.find((r) => r.storeId === s.id)!;
      const priceFactor =
        s.channel === "直营" ? pricing.retailFactor : pricing.wholesaleFactor;
      const unitPrice = cents(
        (s.channel === "直营" ? pricing.retailPrice : pricing.wholesalePrice) *
          priceFactor,
      );
      const unitFixed = s.channel === "直营" ? cents(pricing.fixedCost) : 0;
      const unitGross = cents(unitPrice - pricing.purchasePrice),
        unitNet = cents(unitGross - logistics.unitCost - unitFixed);
      const quantity = m.replenishment,
        revenue = cents(quantity * unitPrice),
        net = cents(quantity * unitNet);
      return {
        storeId: s.id,
        storeName: s.name,
        model: m.model,
        channel: s.channel,
        quantity,
        unitPrice,
        purchasePrice: pricing.purchasePrice,
        unitGross,
        unitNet,
        unitLogistics: logistics.unitCost,
        unitFixed,
        priceFactor,
        revenue,
        gross: cents(quantity * unitGross),
        logistics: cents(quantity * logistics.unitCost),
        fixed: cents(quantity * unitFixed),
        net,
        margin: revenue ? net / revenue : null,
      };
    }),
  );
  // Compare like-for-like models using the actual store logistics, including
  // zero-allocation rows so a later allocation cannot silently invert channels.
  for (const model of Object.keys(input.pricing)) {
    const eligible = profitRows.filter((r) => r.model === model);
    const direct = eligible
      .filter((r) => r.channel === "直营")
      .sort((a, b) => a.unitNet - b.unitNet)[0];
    const authorized = eligible
      .filter((r) => r.channel === "授权")
      .sort((a, b) => b.unitNet - a.unitNet)[0];
    if (direct && authorized && direct.unitNet <= authorized.unitNet) {
      throw new Error(
        model +
          "直营单车净利必须高于授权：" +
          direct.storeId +
          "（" +
          direct.unitNet +
          " SAR）≤ " +
          authorized.storeId +
          "（" +
          authorized.unitNet +
          " SAR）。请调整零售 / 批发系数、直营固定费用或门店物流成本。",
      );
    }
  }
  const trips: CommercialTrip[] = [];
  const groups = new Map<
    string,
    {
      stage: CommercialTrip["stage"];
      originId: string;
      destinationId: string;
      parts: CommercialPart[];
    }
  >();
  function add(
    stage: CommercialTrip["stage"],
    originId: string,
    destinationId: string,
    part: CommercialPart,
  ) {
    if (!part.quantity) return;
    const key = stage + "/" + originId + "/" + destinationId;
    if (!groups.has(key))
      groups.set(key, { stage, originId, destinationId, parts: [] });
    groups.get(key)!.parts.push(part);
  }
  for (const s of result.stores) {
    const log = stores.find((r) => r.storeId === s.id)!;
    // Allocate the store's exact direct quantity to model rows without inventing cars.
    const exact = s.models.map((m) =>
      s.replenishment ? (s.directQty * m.replenishment) / s.replenishment : 0,
    );
    const direct = exact.map(Math.floor);
    const priority = exact
      .map((n, i) => ({ i, remainder: n - direct[i] }))
      .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
    const remainder = s.directQty - direct.reduce((a, b) => a + b, 0);
    for (let n = 0; n < remainder; n++) direct[priority[n].i]++;
    s.models.forEach((m, i) => {
      const via = m.replenishment - direct[i];
      add("direct", "P-W", s.city, {
        storeId: s.id,
        model: m.model,
        quantity: direct[i],
        cost: cents(direct[i] * log.unitCost),
      });
      const allVia = cents(via * log.unitCost),
        first = cents(allVia * 0.7);
      add("transfer", "P-W", log.hub, {
        storeId: s.id,
        model: m.model,
        quantity: via,
        cost: first,
      });
      add("last-mile", log.hub, s.city, {
        storeId: s.id,
        model: m.model,
        quantity: via,
        cost: cents(allVia - first),
      });
    });
  }
  function name(id: string) {
    return id === "P-W"
      ? "吉达港"
      : (commercialHubs.find((h) => h.id === id)?.name ?? id);
  }
  for (const group of groups.values()) {
    let parts: CommercialPart[] = [],
      quantity = 0;
    function flush() {
      if (!quantity) return;
      trips.push({
        id: "SIM-RPL-" + String(trips.length + 1).padStart(4, "0"),
        stage: group.stage,
        trigger: group.stage === "last-mile" ? "订单触发" : "到港补库",
        originId: group.originId,
        destinationId: group.destinationId,
        origin: name(group.originId),
        destination: name(group.destinationId),
        quantity,
        capacity,
        cost: cents(parts.reduce((n, p) => n + p.cost, 0)),
        parts,
      });
      parts = [];
      quantity = 0;
    }
    for (const part of group.parts) {
      let left = part.quantity,
        costLeft = part.cost;
      while (left) {
        const take = Math.min(left, capacity - quantity),
          cost =
            take === left
              ? costLeft
              : cents((part.cost * take) / part.quantity);
        parts.push({ ...part, quantity: take, cost });
        left -= take;
        costLeft = cents(costLeft - cost);
        quantity += take;
        if (quantity === capacity) flush();
      }
    }
    flush();
  }
  return {
    input,
    logistics: {
      quantity: result.summary.replenishment,
      direct: result.summary.direct,
      viaHub: result.summary.vpc,
      totalCost: cents(stores.reduce((n, s) => n + s.cost, 0)),
      stores,
      trips,
    },
    profit: {
      rows: profitRows,
      stores: result.stores.map((s) => ({
        id: s.id,
        name: s.name,
        channel: s.channel,
        ...sum(profitRows.filter((r) => r.storeId === s.id)),
      })),
      models: Object.keys(input.pricing).map((model) => ({
        id: model,
        name: model,
        ...sum(profitRows.filter((r) => r.model === model)),
      })),
      summary: sum(profitRows),
    },
  };
}
