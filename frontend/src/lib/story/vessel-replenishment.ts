import network from "../store-planning-data.json";
import {
  vesselInventoryVersion,
  vesselOverview,
  vesselStoreModelStocks,
} from "./vessel-overview";
import { vesselOrders, planOrderTrips } from "./vessel-orders";
import type { StoreAllocation } from "./store-planning";

export type ReplenishmentParameters = {
  commercial?: import("./vessel-commercial").CommercialParameters;
  supply: number;
  reserveRatio: number;
  baseWos: number;
  channelGap: number;
  directTargetFactor: number;
  performanceTargetFactor: number;
  pairingEnabled: boolean;
  hotPerSlow: number;
  directDeliveryRatio: number;
  truckCapacity: number;
  storeFactors: Record<string, { salesFactor: number; performance: boolean }>;
};
export type ReplenishmentModelRow = {
  model: string;
  brand: string;
  stock: number;
  weeklySales: number;
  replenishment: number;
  orders: number;
  slow: boolean;
};
export type ReplenishmentStore = (typeof vesselOverview.stores)[number] & {
  city: string;
  adjustedWeeklySales: number;
  salesFactor: number;
  performance: boolean;
  targetWeeks: number;
  beforeWos: number | null;
  afterWos: number | null;
  beforeSatisfaction: number | null;
  afterSatisfaction: number | null;
  replenishment: number;
  orders: number;
  hotQty: number;
  pairedQty: number;
  directQty: number;
  vpcQty: number;
  models: ReplenishmentModelRow[];
};
export type VesselReplenishment = {
  /** Missing in snapshots saved before the opening-inventory revision. */
  sourceVersion?: string;
  parameters: ReplenishmentParameters;
  stores: ReplenishmentStore[];
  models: {
    model: string;
    supply: number;
    reserved: number;
    orders: number;
    replenishment: number;
    retained: number;
  }[];
  summary: {
    supply: number;
    reserved: number;
    orders: number;
    orderShortage: number;
    budget: number;
    injected: number;
    replenishment: number;
    retained: number;
    unallocatedInjection: number;
    direct: number;
    vpc: number;
    gap: number;
  };
  waterLevels: { direct: number; authorized: number };
};

// These classifications are editable scenario assumptions, not observed performance.
export const slowReplenishmentModels = new Set([
  "Fortuner",
  "Highlander",
  "Lexus RX 350h",
]);
export function defaultReplenishmentParameters(): ReplenishmentParameters {
  return {
    supply: 2500,
    reserveRatio: 0.1,
    baseWos: 4,
    channelGap: 0.1,
    directTargetFactor: 1,
    performanceTargetFactor: 1.1,
    pairingEnabled: true,
    hotPerSlow: 8,
    directDeliveryRatio: 0.3,
    truckCapacity: 8,
    storeFactors: {},
  };
}

function apportion(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum),
    result = exact.map(Math.floor);
  const priority = exact
    .map((n, i) => ({ i, fraction: n - result[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (
    let i = 0, left = total - result.reduce((a, b) => a + b, 0);
    i < left;
    i++
  )
    result[priority[i].i]++;
  return result;
}
function bounded(
  value: number,
  label: string,
  min: number,
  max: number,
  integer = false,
) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(
      `${label}须为 ${min}–${max} ${integer ? "内的整数" : "之间的数值"}`,
    );
}

export function calculateVesselReplenishment(
  parameters: ReplenishmentParameters,
  injection?: number,
): VesselReplenishment {
  const p = parameters;
  bounded(p.supply, "供给", 0, 100000, true);
  bounded(p.reserveRatio, "预留比例", 0, 1);
  bounded(p.baseWos, "基准 WoS", 0.1, 52);
  bounded(p.channelGap, "直营与授权级差", 0, 1);
  bounded(p.directTargetFactor, "直营目标系数", 0.1, 5);
  bounded(p.performanceTargetFactor, "绩效目标系数", 0.1, 5);
  bounded(p.hotPerSlow, "车型搭配比例", 1, 100, true);
  bounded(p.directDeliveryRatio, "门店直送比例", 0, 1);
  bounded(p.truckCapacity, "板车容量", 8, 10, true);
  for (const factor of Object.values(p.storeFactors))
    bounded(factor.salesFactor, "门店销速系数", 0.1, 5);
  const sourceModels = vesselOverview.models;
  const supply = apportion(
    p.supply,
    sourceModels.map((m) => m.supply),
  );
  const committed = sourceModels.map((m) =>
    vesselOrders.orders
      .filter((o) => o.model === m.model)
      .reduce((s, o) => s + o.allocated, 0),
  );
  const capacities = supply.map((s, i) => Math.max(0, s - committed[i]));
  const reserved = Math.round(p.supply * p.reserveRatio);
  // Protect existing order commitments when choosing which models to reserve.
  const surplus = capacities.reduce((a, b) => a + b, 0);
  const modelReserves = apportion(Math.min(reserved, surplus), capacities);
  if (reserved > surplus) {
    const extra = apportion(
      reserved - surplus,
      supply.map((s, i) => s - modelReserves[i]),
    );
    extra.forEach((n, i) => (modelReserves[i] += n));
  }
  const models = sourceModels.map((m, i) => ({
    model: m.model,
    supply: supply[i],
    reserved: modelReserves[i],
    orders: Math.min(committed[i], supply[i] - modelReserves[i]),
    replenishment: 0,
    retained: 0,
  }));
  const stores: ReplenishmentStore[] = vesselOverview.stores.map((s) => {
    const source = network.stores.find((n) => n.id === s.id)!;
    const factor = p.storeFactors[s.id] ?? {
      salesFactor: 1,
      performance: false,
    };
    const supported = sourceModels.filter((m) =>
      source.brands.includes(m.brand),
    );
    const demandKey =
      s.channel === "直营" ? "directDemand4Weeks" : "authorizedDemand4Weeks";
    const totalDemand = supported.reduce((n, m) => n + m[demandKey], 0);
    const stock = vesselStoreModelStocks(s);
    const adjustedWeeklySales = s.weeklySales * factor.salesFactor;
    const targetWeeks =
      p.baseWos *
      (s.channel === "直营" ? p.directTargetFactor : 1) *
      (factor.performance ? p.performanceTargetFactor : 1);
    const beforeWos =
      adjustedWeeklySales > 0 ? s.stock / adjustedWeeklySales : null;
    return {
      ...s,
      city: source.city,
      adjustedWeeklySales,
      salesFactor: factor.salesFactor,
      performance: factor.performance,
      targetWeeks,
      beforeWos,
      afterWos: beforeWos,
      beforeSatisfaction: beforeWos === null ? null : beforeWos / targetWeeks,
      afterSatisfaction: beforeWos === null ? null : beforeWos / targetWeeks,
      replenishment: 0,
      orders: 0,
      hotQty: 0,
      pairedQty: 0,
      directQty: 0,
      vpcQty: 0,
      models: supported.map((m) => ({
        model: m.model,
        brand: m.brand,
        stock: stock[m.model],
        weeklySales:
          totalDemand > 0
            ? (adjustedWeeklySales * m[demandKey]) / totalDemand
            : 0,
        replenishment: 0,
        orders: 0,
        slow: slowReplenishmentModels.has(m.model),
      })),
    };
  });
  // Reuse tab2's actual allocated order identities; shortages never enter the pool.
  models.forEach((model) => {
    const orders = vesselOrders.orders.filter(
      (o) => o.model === model.model && o.allocated > 0,
    );
    const assigned = apportion(
      model.orders,
      orders.map((o) => o.allocated),
    );
    orders.forEach((o, i) => {
      const store = stores.find((s) => s.id === o.storeId)!;
      store.orders += assigned[i];
      store.models.find((m) => m.model === model.model)!.orders += assigned[i];
    });
  });
  const orders = models.reduce((n, m) => n + m.orders, 0);
  const budget = p.supply - reserved - orders;
  if (injection !== undefined) bounded(injection, "注入车辆", 0, budget, true);
  const injected = injection ?? budget;
  const remaining = models.map((m) => m.supply - m.reserved - m.orders);
  const modelIndex = new Map(models.map((m, i) => [m.model, i]));
  const rowLevel = (s: ReplenishmentStore) =>
    (s.stock + s.replenishment) / (s.adjustedWeeklySales * s.targetWeeks);
  const room = (s: ReplenishmentStore, m: ReplenishmentModelRow) =>
    m.weeklySales > 0 &&
    m.stock + m.replenishment < Math.ceil(m.weeklySales * s.targetWeeks);
  function candidate(s: ReplenishmentStore) {
    const available = s.models.filter(
      (m) => remaining[modelIndex.get(m.model)!] > 0 && room(s, m),
    );
    const hot = available.filter((m) => !m.slow);
    // Once the ratio is reached, the next eligible car is the paired slow model.
    const hotByBrand = (brand: string) =>
      s.models
        .filter((m) => m.brand === brand && !m.slow)
        .reduce((n, m) => n + m.replenishment, 0);
    const slowByBrand = (brand: string) =>
      s.models
        .filter((m) => m.brand === brand && m.slow)
        .reduce((n, m) => n + m.replenishment, 0);
    const owed = (brand: string) =>
      Math.floor(hotByBrand(brand) / p.hotPerSlow) > slowByBrand(brand);
    const slow = available.filter(
      (m) => m.slow && (!p.pairingEnabled || owed(m.brand)),
    );
    const candidates = p.pairingEnabled
      ? slow.length
        ? slow
        : hot.filter((m) => !owed(m.brand))
      : available;
    return candidates.sort((a, b) => {
      const level = (m: ReplenishmentModelRow) =>
        (m.stock + m.replenishment) / (m.weeklySales * s.targetWeeks);
      return level(a) - level(b) || a.model.localeCompare(b.model);
    })[0];
  }
  let used = 0;
  const waterLevels = { direct: 0, authorized: 0 };
  for (let quantity = 0; quantity < injected; quantity++) {
    const eligible = stores
      .filter(
        (s) =>
          s.adjustedWeeklySales > 0 &&
          s.stock + s.replenishment <
            Math.ceil(s.adjustedWeeklySales * s.targetWeeks),
      )
      .map((s) => ({ store: s, model: candidate(s) }))
      .filter((item) => item.model);
    eligible.sort((a, b) => {
      const level = (s: ReplenishmentStore) =>
        rowLevel(s) + (s.channel === "授权" ? p.channelGap : 0);
      return (
        level(a.store) - level(b.store) || a.store.id.localeCompare(b.store.id)
      );
    });
    if (!eligible.length) break;
    const { store, model } = eligible[0];
    const index = modelIndex.get(model!.model)!;
    model!.replenishment++;
    store.replenishment++;
    if (p.pairingEnabled && model!.slow) store.pairedQty++;
    if (!model!.slow) store.hotQty++;
    remaining[index]--;
    models[index].replenishment++;
    used++;
    waterLevels[store.channel === "直营" ? "direct" : "authorized"] =
      rowLevel(store);
  }
  stores.forEach((s) => {
    s.afterWos =
      s.adjustedWeeklySales > 0
        ? (s.stock + s.replenishment) / s.adjustedWeeklySales
        : null;
    s.afterSatisfaction =
      s.afterWos === null ? null : s.afterWos / s.targetWeeks;
    const parking = network.stores.find((n) => n.id === s.id)!.capacity ?? 0;
    s.directQty = Math.min(
      Math.floor(s.replenishment * p.directDeliveryRatio),
      Math.max(0, parking - s.stock),
    );
    s.vpcQty = s.replenishment - s.directQty;
  });
  models.forEach(
    (m) => (m.retained = m.supply - m.reserved - m.orders - m.replenishment),
  );
  return {
    sourceVersion: vesselInventoryVersion,
    parameters: structuredClone(p),
    stores,
    models,
    waterLevels,
    summary: {
      supply: p.supply,
      reserved,
      orders,
      orderShortage: vesselOverview.summary.orders - orders,
      budget,
      injected,
      replenishment: used,
      retained: budget - used,
      unallocatedInjection: injected - used,
      direct: stores.reduce((n, s) => n + s.directQty, 0),
      vpc: stores.reduce((n, s) => n + s.vpcQty, 0),
      gap: stores.reduce(
        (n, s) =>
          n +
          Math.max(
            0,
            Math.ceil(s.adjustedWeeklySales * s.targetWeeks) -
              s.stock -
              s.replenishment,
          ),
        0,
      ),
    },
  };
}

export function replenishmentAllocation(
  result: VesselReplenishment,
): StoreAllocation {
  const p = result.parameters,
    s = result.summary;
  const rows = result.stores.map((store) => ({
    ...store,
    weeklySales: store.adjustedWeeklySales,
    availableStock: store.stock,
    effectiveStock: store.stock,
    physicalStock: store.stock,
    parkingCapacity:
      network.stores.find((s) => s.id === store.id)!.capacity ?? 0,
    salesStart: vesselOverview.weeklyWindow.start,
    salesEnd: vesselOverview.weeklyWindow.end,
    orders: store.orders,
    orderAllocated: store.orders,
    total: store.orders + store.replenishment,
    allocationCap: null,
    dueDay: 7,
    brand: [...new Set(store.models.map((m) => m.brand))].join(" / "),
    offset: store.channel === "授权" ? p.channelGap : 0,
    gap: Math.max(
      0,
      Math.ceil(store.adjustedWeeklySales * store.targetWeeks) -
        store.stock -
        store.replenishment,
    ),
  }));
  return {
    input: {
      supply: s.supply,
      targetDirect: p.baseWos * p.directTargetFactor,
      targetAuthorized: p.baseWos,
      sku: "本船订单与门店补库",
      brand: "丰田 / 雷克萨斯",
      source: {
        snapshot: result.sourceVersion ?? vesselInventoryVersion,
        stockDate: "2026-08-05",
        nature: "模拟订单与门店库存",
      },
      offsetDirect: 0,
      offsetAuthorized: p.channelGap,
      stores: rows,
      replenishment: p,
    },
    rows,
    waterLevel: Math.max(
      result.waterLevels.direct,
      result.waterLevels.authorized + p.channelGap,
    ),
    summary: {
      orders: s.orders,
      replenishment: s.replenishment,
      assigned: s.orders + s.replenishment,
      retained: s.reserved + s.retained,
      orderShortage: s.orderShortage,
      replenishmentGap: s.gap,
    },
  };
}

export function replenishmentOverview(result: VesselReplenishment) {
  const overview = structuredClone(vesselOverview);
  overview.summary.supply = result.summary.supply;
  for (const model of overview.models) {
    const pool = result.models.find((m) => m.model === model.model)!;
    const split = apportion(pool.supply, [
      model.directSupply,
      model.authorizedSupply,
    ]);
    model.supply = pool.supply;
    model.directSupply = split[0];
    model.authorizedSupply = split[1];
    for (const channel of ["直营", "授权"] as const) {
      const allocated = result.stores
        .filter((s) => s.channel === channel)
        .reduce(
          (sum, store) =>
            sum +
            (store.models.find((m) => m.model === model.model)?.orders ?? 0),
          0,
        );
      if (channel === "直营") {
        model.directOrderShortage = model.directOrders - allocated;
        model.directReplenishmentShortage = Math.max(
          0,
          model.directDemand4Weeks - model.directStock - model.directSupply,
        );
      } else {
        model.authorizedOrderShortage = model.authorizedOrders - allocated;
        model.authorizedReplenishmentShortage = Math.max(
          0,
          model.authorizedDemand4Weeks -
            model.authorizedStock -
            model.authorizedSupply,
        );
      }
    }
  }
  for (const channel of overview.channels) {
    channel.orderShortage = overview.models.reduce(
      (sum, model) =>
        sum +
        (channel.channel === "直营"
          ? model.directOrderShortage
          : model.authorizedOrderShortage),
      0,
    );
    channel.replenishmentShortage = overview.models.reduce(
      (sum, model) =>
        sum +
        (channel.channel === "直营"
          ? model.directReplenishmentShortage
          : model.authorizedReplenishmentShortage),
      0,
    );
  }
  overview.summary.orderShortage = result.summary.orderShortage;
  overview.summary.replenishmentShortage = overview.channels.reduce(
    (sum, c) => sum + c.replenishmentShortage,
    0,
  );
  overview.summary.toyotaSupply = overview.models
    .filter((m) => m.brand === "丰田")
    .reduce((sum, m) => sum + m.supply, 0);
  overview.summary.lexusSupply =
    overview.summary.supply - overview.summary.toyotaSupply;
  const last = overview.supplyHistory.at(-1)!;
  last.toyota = overview.summary.toyotaSupply;
  last.lexus = overview.summary.lexusSupply;
  const previous = overview.supplyHistory.at(-2)!;
  overview.summary.supplyChangePercent =
    (overview.summary.supply / (previous.toyota + previous.lexus) - 1) * 100;
  overview.assumptions.push(
    `本轮船量 ${result.summary.supply} 台、预留 ${result.summary.reserved} 台。订单缺口以扣除预留后的实际分配量计算；4 周补库缺口和整体可售周数仍为全船供给覆盖估算，预留车辆另见 Tab3，不代表已可发运。`,
  );
  return overview;
}

export function replenishmentOrders(result: VesselReplenishment) {
  const orders = vesselOrders.orders.map((o) => ({ ...o }));
  for (const model of result.models) {
    const rows = orders.filter(
      (o) => o.model === model.model && o.allocated > 0,
    );
    const quantities = apportion(
      model.orders,
      rows.map((o) => o.allocated),
    );
    rows.forEach((o, i) => (o.allocated = quantities[i]));
  }
  return {
    ...vesselOrders,
    orders,
    assumptions: [
      ...vesselOrders.assumptions,
      `本轮总量 ${result.summary.supply} 台，预留 ${result.summary.reserved} 台，实际订单分配 ${result.summary.orders} 台；不足车源按原订单权重缩减。`,
    ],
    plans: {
      single: planOrderTrips(vesselOrders.stores, orders, "single"),
      dual: planOrderTrips(vesselOrders.stores, orders, "dual"),
    },
  };
}
