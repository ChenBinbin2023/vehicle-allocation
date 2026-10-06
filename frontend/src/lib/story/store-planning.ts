import planningData from "../store-planning-data.json";
import {
  addDeliveryCosts,
  unknownCostRates,
  type CostRates,
  type CostBreakdown,
} from "./logistics-cost";
// Source snapshots are simulated. Orders and transit arrival are explicit scenario assumptions.
export type PlanningStore = {
  id: string;
  name: string;
  channel: "直营" | "授权";
  orders: number;
  weeklySales: number;
  availableStock: number;
  allocationCap: number | null;
  dueDay: number;
  brand?: string;
  city?: string;
  region?: string;
  physicalStock?: number;
  lockedStock?: number;
  frozenStock?: number;
  transit?: number;
  parkingCapacity?: number;
  salesStart?: string;
  salesEnd?: string;
  salesBasis?: string;
};
export type AllocationScenario = {
  supply: number;
  targetDirect: number;
  targetAuthorized: number;
  sku: string;
  brand?: string;
  includeTransit?: boolean;
  offsetDirect?: number;
  offsetAuthorized?: number;
  source?: { snapshot: string; stockDate: string; nature: string };
  stores: PlanningStore[];
};
export type AllocationRow = PlanningStore & {
  targetWeeks: number;
  effectiveStock: number;
  offset: number;
  orderAllocated: number;
  replenishment: number;
  total: number;
  beforeWos: number | null;
  afterWos: number | null;
  gap: number;
};
export type StoreAllocation = {
  input: AllocationScenario;
  waterLevel: number;
  rows: AllocationRow[];
  summary: {
    orders: number;
    replenishment: number;
    assigned: number;
    retained: number;
    orderShortage: number;
    replenishmentGap: number;
  };
};
export type ReceivingRule = {
  id: string;
  directEligible: boolean;
  firstCapacity: number;
  schedule: Array<{ day: number; capacity: number }>;
};
export type PlanningVpc = "JED" | "RUH" | "DMM";
export type DeliveryScenario = {
  costRates?: CostRates;
  mode: "single" | "dual";
  stores: ReceivingRule[];
  vpcCapacity: Record<PlanningVpc, number>;
  includeVpcStock: boolean;
  sourceAssumptions?: boolean;
};
export type StoreBatch = {
  id: string;
  storeId: string;
  storeName: string;
  origin: string;
  source: "vessel" | "vpc_stock";
  viaVpc: PlanningVpc | null;
  routeClass: "direct" | "via_vpc" | "vpc_origin";
  qty: number;
  orders: number;
  replenishment: number;
  arrivalDay: number | null;
  unitCost: number;
  cost: number;
};
export type DeliveryRow = {
  storeId: string;
  storeName: string;
  origin: string;
  serviceVpc: PlanningVpc;
  total: number;
  orders: number;
  replenishment: number;
  directQty: number;
  viaVpcQty: number;
  unroutedQty: number;
  pendingScheduleQty: number;
  lastArrival: number | null;
  orderOnTime: number;
  orderLate: number;
  orderPending: number;
  knownCost: number;
};
export type RouteSnapshot = (typeof planningData.routes)[number] & {
  capacity: number;
  quote: number;
  storeIds: string[];
};
export type PortDelivery = {
  network?: RouteSnapshot[];
  costs?: CostBreakdown;
  rows: DeliveryRow[];
  batches: StoreBatch[];
  summary: {
    total: number;
    direct: number;
    viaVpc: number;
    unrouted: number;
    pendingSchedule: number;
    capacityOverflow: number;
    orderOnTime: number;
    orderLate: number;
    orderPending: number;
    knownCost: number;
    cost: number | null;
  };
};
export type StoreDelivery = {
  input: DeliveryScenario;
  single: PortDelivery;
  dual: PortDelivery;
  saving: number | null;
  costScope?: "source_linehaul";
  vpcStock: { qty: number; cost: number; batches: StoreBatch[] };
};
export type PlanningSnapshot =
  | { kind: "allocation"; result: StoreAllocation }
  | {
      kind: "delivery";
      allocationRunId: string;
      allocation: StoreAllocation;
      result: StoreDelivery;
    };
export type PlanningInput = AllocationScenario | DeliveryScenario;
export function defaultAllocationScenario(brand = "丰田"): AllocationScenario {
  const stocks = planningData.stock.filter((s) => s.brand === brand);
  return {
    supply: 1800,
    brand,
    sku: brand + " · 品牌级模拟（无车型/VIN明细）",
    targetDirect: 3,
    targetAuthorized: 4,
    includeTransit: false,
    offsetDirect: 0,
    offsetAuthorized: 0,
    source: {
      snapshot: planningData.snapshot,
      stockDate: planningData.stockDate,
      nature: planningData.nature,
    },
    stores: stocks.map((stock) => {
      const store = planningData.stores.find((s) => s.id === stock.store)!;
      const sales = planningData.velocity.find(
        (v) => v.store === stock.store && v.brand === brand,
      )!;
      return {
        id: store.id,
        name: store.name,
        channel: store.channel === "直营" ? "直营" : "授权",
        brand,
        city: store.city,
        region: store.region,
        orders: 0,
        weeklySales: sales.weekly ?? 0,
        availableStock: stock.free ?? 0,
        physicalStock: stock.physical ?? 0,
        lockedStock: stock.locked ?? 0,
        frozenStock: stock.frozen ?? 0,
        transit: stock.transit ?? 0,
        parkingCapacity: store.capacity ?? 0,
        salesStart: sales.start,
        salesEnd: sales.end,
        salesBasis: sales.basis,
        allocationCap: null,
        dueDay: 7,
      };
    }),
  };
}
export function defaultDeliveryScenario(
  allocation?: StoreAllocation,
): DeliveryScenario {
  if (allocation?.input.source) return dataDeliveryScenario(allocation);
  return {
    mode: "single",
    includeVpcStock: false,
    vpcCapacity: { JED: 307, RUH: 571, DMM: 272 },
    stores: [
      {
        id: "D1",
        directEligible: true,
        firstCapacity: 400,
        schedule: [
          { day: 4, capacity: 200 },
          { day: 9, capacity: 107 },
        ],
      },
      {
        id: "D2",
        directEligible: false,
        firstCapacity: 0,
        schedule: [{ day: 4, capacity: 421 }],
      },
      {
        id: "A1",
        directEligible: true,
        firstCapacity: 250,
        schedule: [
          { day: 4, capacity: 150 },
          { day: 10, capacity: 122 },
        ],
      },
      {
        id: "A2",
        directEligible: false,
        firstCapacity: 0,
        schedule: [{ day: 6, capacity: 150 }],
      },
    ],
  };
}
function numeric(value: number, label: string, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(label + "必须为非负" + (integer ? "整数" : "数值"));
}
export function calculateStoreAllocation(
  input: AllocationScenario,
): StoreAllocation {
  numeric(input.supply, "供给", true);
  if (input.supply > 100000) throw new Error("演示供给不能超过 100,000 台");
  numeric(input.targetDirect, "直营目标 WoS");
  numeric(input.targetAuthorized, "授权目标 WoS");
  if (input.targetDirect === 0 || input.targetAuthorized === 0)
    throw new Error("目标 WoS 必须大于 0");
  numeric(input.offsetDirect ?? 0, "直营偏移");
  numeric(input.offsetAuthorized ?? 0, "授权偏移");
  if ((input.offsetDirect ?? 0) > 1 || (input.offsetAuthorized ?? 0) > 1)
    throw new Error("渠道偏移不能超过 1（100%）");
  const ids = new Set<string>();
  const rows: AllocationRow[] = input.stores.map((store) => {
    if (ids.has(store.id)) throw new Error("门店 ID 重复");
    ids.add(store.id);
    numeric(store.orders, "订单", true);
    numeric(store.weeklySales, "销速");
    numeric(store.availableStock, "库存", true);
    numeric(store.dueDay, "交期", true);
    if (store.allocationCap !== null)
      numeric(store.allocationCap, "分车上限", true);
    numeric(store.transit ?? 0, "在途", true);
    const effectiveStock =
      store.availableStock + (input.includeTransit ? (store.transit ?? 0) : 0);
    return {
      ...store,
      effectiveStock,
      offset:
        (store.channel === "直营"
          ? input.offsetDirect
          : input.offsetAuthorized) ?? 0,
      targetWeeks:
        store.channel === "直营" ? input.targetDirect : input.targetAuthorized,
      orderAllocated: 0,
      replenishment: 0,
      total: 0,
      beforeWos: store.weeklySales ? effectiveStock / store.weeklySales : null,
      afterWos: null,
      gap: 0,
    };
  });
  let remaining = input.supply;
  const priority = [...rows].sort(
    (a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id),
  );
  for (const row of priority) {
    row.orderAllocated = Math.min(
      row.orders,
      remaining,
      row.allocationCap ?? Infinity,
    );
    remaining -= row.orderAllocated;
  }
  const caps = rows.map((row) =>
    Math.min(
      row.weeklySales
        ? Math.max(
            0,
            Math.ceil(row.weeklySales * row.targetWeeks) - row.effectiveStock,
          )
        : 0,
      Math.max(0, (row.allocationCap ?? Infinity) - row.orderAllocated),
    ),
  );
  const amount = Math.min(
    remaining,
    caps.reduce((a, b) => a + b, 0),
  );
  // A deterministic prefix of integer injections keeps playback monotonic.
  // Always raise the lowest normalized water level; IDs break discrete ties.
  const heap: number[] = [];
  const level = (i: number) =>
    (rows[i].effectiveStock + rows[i].replenishment) /
      (rows[i].weeklySales * rows[i].targetWeeks) +
    rows[i].offset;
  const compare = (a: number, b: number) => {
    const difference = level(a) - level(b);
    return Math.abs(difference) < 1e-10
      ? rows[a].id.localeCompare(rows[b].id)
      : difference;
  };
  for (let i = 0; i < rows.length; i++) {
    if (!caps[i]) continue;
    heap.push(i);
    let child = heap.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (compare(heap[parent], heap[child]) <= 0) break;
      [heap[parent], heap[child]] = [heap[child], heap[parent]];
      child = parent;
    }
  }
  let waterLevel = 0;
  for (let quantity = 0; quantity < amount; quantity++) {
    const i = heap[0];
    waterLevel = level(i);
    rows[i].replenishment++;
    if (rows[i].replenishment === caps[i]) {
      const last = heap.pop()!;
      if (heap.length) heap[0] = last;
    }
    let parent = 0;
    while (parent * 2 + 1 < heap.length) {
      let child = parent * 2 + 1;
      if (child + 1 < heap.length && compare(heap[child + 1], heap[child]) < 0)
        child++;
      if (compare(heap[parent], heap[child]) <= 0) break;
      [heap[parent], heap[child]] = [heap[child], heap[parent]];
      parent = child;
    }
  }
  for (const row of rows) {
    row.total = row.orderAllocated + row.replenishment;
    row.afterWos = row.weeklySales
      ? (row.effectiveStock + row.replenishment) / row.weeklySales
      : null;
    row.gap = row.weeklySales
      ? Math.max(
          0,
          Math.ceil(row.weeklySales * row.targetWeeks) -
            row.effectiveStock -
            row.replenishment,
        )
      : 0;
  }
  const orders = rows.reduce((s, r) => s + r.orderAllocated, 0),
    replenishment = rows.reduce((s, r) => s + r.replenishment, 0);
  return {
    input: structuredClone(input),
    waterLevel,
    rows,
    summary: {
      orders,
      replenishment,
      assigned: orders + replenishment,
      retained: input.supply - orders - replenishment,
      orderShortage: rows.reduce((s, r) => s + r.orders - r.orderAllocated, 0),
      replenishmentGap: rows.reduce((s, r) => s + r.gap, 0),
    },
  };
}
const logistics: Record<
  string,
  {
    vpc: PlanningVpc;
    directDay: number;
    viaDay: number;
    directCost: number;
    viaCost: number;
  }
> = {
  D1: { vpc: "JED", directDay: 2, viaDay: 4, directCost: 150, viaCost: 250 },
  D2: { vpc: "RUH", directDay: 3, viaDay: 4, directCost: 450, viaCost: 550 },
  A1: { vpc: "DMM", directDay: 2, viaDay: 4, directCost: 180, viaCost: 280 },
  A2: { vpc: "RUH", directDay: 5, viaDay: 6, directCost: 700, viaCost: 800 },
};
function planPort(
  allocation: StoreAllocation,
  input: DeliveryScenario,
  mode: "single" | "dual",
): PortDelivery {
  const vpcRemaining = { ...input.vpcCapacity };
  const drafts = allocation.rows.map((store) => {
    const route = logistics[store.id],
      rule = input.stores.find((r) => r.id === store.id);
    if (!route || !rule)
      throw new Error("缺少门店 " + store.id + " 的物流规则");
    const shift = store.id === "A1" && mode === "single" ? 3 : 0;
    const costShift = shift ? 520 : 0;
    const directQty = rule.directEligible
      ? Math.min(store.total, rule.firstCapacity)
      : 0;
    const directOrders = Math.min(directQty, store.orderAllocated);
    return {
      store,
      route,
      rule,
      shift,
      costShift,
      directQty,
      directOrders,
      viaOrders: 0,
      viaInventory: 0,
      needOrders: store.orderAllocated - directOrders,
      needInventory: store.replenishment - (directQty - directOrders),
    };
  });
  const priority = [...drafts].sort(
    (a, b) =>
      a.store.dueDay - b.store.dueDay || a.store.id.localeCompare(b.store.id),
  );
  // Share VPC capacity across stores; order cars precede all replenishment.
  for (const d of priority) {
    d.viaOrders = Math.min(d.needOrders, vpcRemaining[d.route.vpc]);
    vpcRemaining[d.route.vpc] -= d.viaOrders;
  }
  for (const d of priority) {
    d.viaInventory = Math.min(d.needInventory, vpcRemaining[d.route.vpc]);
    vpcRemaining[d.route.vpc] -= d.viaInventory;
  }
  const batches: StoreBatch[] = [];
  let capacityOverflow = 0;
  const rows = drafts.map((d) => {
    const { store, route, rule, shift, costShift } = d;
    const origin = mode === "dual" && store.id === "A1" ? "达曼港" : "吉达港";
    capacityOverflow += rule.directEligible ? d.viaOrders + d.viaInventory : 0;
    const local: StoreBatch[] = [];
    function batch(
      qty: number,
      orders: number,
      arrivalDay: number | null,
      via: boolean,
    ) {
      if (!qty) return;
      const unitCost = (via ? route.viaCost : route.directCost) + costShift;
      local.push({
        id: mode + "-" + store.id + "-" + (local.length + 1),
        storeId: store.id,
        storeName: store.name,
        origin,
        source: "vessel",
        viaVpc: via ? route.vpc : null,
        routeClass: via ? "via_vpc" : "direct",
        qty,
        orders,
        replenishment: qty - orders,
        arrivalDay,
        unitCost,
        cost: qty * unitCost,
      });
    }
    batch(d.directQty, d.directOrders, route.directDay + shift, false);
    let quantity = d.viaOrders + d.viaInventory,
      orders = d.viaOrders;
    for (const slot of [...rule.schedule].sort((a, b) => a.day - b.day)) {
      if (slot.day < route.viaDay) continue;
      const qty = Math.min(quantity, slot.capacity),
        orderQty = Math.min(orders, qty);
      batch(qty, orderQty, slot.day + shift, true);
      quantity -= qty;
      orders -= orderQty;
    }
    batch(quantity, orders, null, true);
    const unroutedQty =
      store.total - d.directQty - d.viaOrders - d.viaInventory;
    const orderOnTime = local
      .filter((b) => b.arrivalDay !== null && b.arrivalDay <= store.dueDay)
      .reduce((s, b) => s + b.orders, 0);
    const orderLate = local
      .filter((b) => b.arrivalDay !== null && b.arrivalDay > store.dueDay)
      .reduce((s, b) => s + b.orders, 0);
    batches.push(...local);
    return {
      storeId: store.id,
      storeName: store.name,
      origin,
      serviceVpc: route.vpc,
      total: store.total,
      orders: store.orderAllocated,
      replenishment: store.replenishment,
      directQty: d.directQty,
      viaVpcQty: d.viaOrders + d.viaInventory,
      unroutedQty,
      pendingScheduleQty: quantity,
      lastArrival:
        unroutedQty || quantity
          ? null
          : local.length
            ? Math.max(...local.map((b) => b.arrivalDay!))
            : null,
      orderOnTime,
      orderLate,
      orderPending: store.orderAllocated - orderOnTime - orderLate,
      knownCost: local.reduce((s, b) => s + b.cost, 0),
    };
  });
  const sum = (field: keyof DeliveryRow) =>
    rows.reduce((s, r) => s + Number(r[field]), 0);
  const knownCost = sum("knownCost"),
    unrouted = sum("unroutedQty");
  return {
    rows,
    batches,
    summary: {
      total: sum("total"),
      direct: sum("directQty"),
      viaVpc: sum("viaVpcQty"),
      unrouted,
      pendingSchedule: sum("pendingScheduleQty"),
      capacityOverflow,
      orderOnTime: sum("orderOnTime"),
      orderLate: sum("orderLate"),
      orderPending: sum("orderPending"),
      knownCost,
      cost: unrouted ? null : knownCost,
    },
  };
}
export function calculateStoreDelivery(
  allocation: StoreAllocation,
  input: DeliveryScenario,
): StoreDelivery {
  for (const capacity of Object.values(input.vpcCapacity))
    numeric(capacity, "VPC 容量", true);
  const ids = new Set<string>();
  for (const rule of input.stores) {
    if (ids.has(rule.id)) throw new Error("接车门店重复");
    ids.add(rule.id);
    numeric(rule.firstCapacity, "首批接车", true);
    const days = new Set<number>();
    for (const slot of rule.schedule) {
      numeric(slot.day, "接车日期", true);
      numeric(slot.capacity, "接车能力", true);
      if (days.has(slot.day)) throw new Error("同日接车时段重复");
      days.add(slot.day);
    }
  }
  const planner = allocation.input.source ? planDataPort : planPort;
  const baseSingle = planner(allocation, input, "single"),
    baseDual = planner(allocation, input, "dual");
  const single = allocation.input.source
    ? addDeliveryCosts(baseSingle, input.costRates ?? unknownCostRates)
    : baseSingle;
  const dual = allocation.input.source
    ? addDeliveryCosts(baseDual, input.costRates ?? unknownCostRates)
    : baseDual;
  const stockBatches: StoreBatch[] =
    input.includeVpcStock && !allocation.input.source
      ? [
          {
            id: "VPC-STOCK-D2",
            storeId: "D2",
            storeName: "中部门店 D2",
            origin: "RUH VPC",
            source: "vpc_stock",
            viaVpc: null,
            routeClass: "vpc_origin",
            qty: 20,
            orders: 20,
            replenishment: 0,
            arrivalDay: 1,
            unitCost: 100,
            cost: 2000,
          },
        ]
      : [];
  return {
    input: structuredClone(input),
    costScope: allocation.input.source ? "source_linehaul" : undefined,
    single,
    dual,
    saving:
      single.summary.cost === null || dual.summary.cost === null
        ? null
        : single.summary.cost - dual.summary.cost,
    vpcStock: {
      qty: stockBatches.length ? 20 : 0,
      cost: stockBatches.length ? 2000 : 0,
      batches: stockBatches,
    },
  };
}

function dataDeliveryScenario(allocation: StoreAllocation): DeliveryScenario {
  return {
    mode: "single",
    includeVpcStock: false,
    sourceAssumptions: true,
    // Receiving and VPC capacities are editable simulation assumptions, not source facts.
    vpcCapacity: {
      JED: allocation.input.supply,
      RUH: allocation.input.supply,
      DMM: allocation.input.supply,
    },
    stores: allocation.rows.map((store) => {
      const physical = planningData.stock
        .filter((s) => s.store === store.id)
        .reduce((s, r) => s + (r.physical ?? 0), 0);
      const parking = Math.max(0, (store.parkingCapacity ?? 0) - physical);
      const daily = Math.max(1, Math.ceil(store.weeklySales / 2));
      return {
        id: store.id,
        directEligible: store.channel === "直营",
        firstCapacity: Math.min(parking, daily),
        schedule: [4, 7, 10, 14].map((day) => ({
          day,
          capacity: Math.min(parking, daily),
        })),
      };
    }),
  };
}
function planDataPort(
  allocation: StoreAllocation,
  input: DeliveryScenario,
  mode: "single" | "dual",
): PortDelivery {
  const scenario = mode === "dual" ? "SC-DUAL" : "SC-WEST";
  const routeRemaining = Object.fromEntries(
    planningData.scenarioRoutes
      .filter((r) => r.scenario === scenario)
      .map((r) => [r.id, r.capacity ?? 0]),
  );
  const vpcRemaining = { ...input.vpcCapacity };
  const drafts = allocation.rows.map((store) => {
    const mapping = planningData.mapping.find(
      (m) =>
        m.store === store.id &&
        (mode === "dual" ? m.dual === "是" : m.west === "是"),
    );
    const route = planningData.routes.find((r) => r.id === mapping?.route);
    const rule = input.stores.find((r) => r.id === store.id);
    if (!rule || !route)
      throw new Error("缺少门店 " + store.id + " 的接车或源路线");
    const vpc: PlanningVpc =
      store.city === "达曼" || store.region === "东部"
        ? "DMM"
        : store.region === "西部"
          ? "JED"
          : "RUH";
    return {
      store,
      route,
      rule,
      vpc,
      routeOrders: 0,
      routeStock: 0,
      direct: 0,
      directOrders: 0,
      viaOrders: 0,
      viaStock: 0,
    };
  });
  const priority = [...drafts].sort(
    (a, b) =>
      a.store.dueDay - b.store.dueDay || a.store.id.localeCompare(b.store.id),
  );
  for (const d of priority) {
    d.routeOrders = Math.min(
      d.store.orderAllocated,
      routeRemaining[d.route.id] ?? 0,
    );
    routeRemaining[d.route.id] -= d.routeOrders;
  }
  for (const d of priority) {
    d.routeStock = Math.min(
      d.store.replenishment,
      routeRemaining[d.route.id] ?? 0,
    );
    routeRemaining[d.route.id] -= d.routeStock;
  }
  for (const d of drafts) {
    const sourcePhysical = planningData.stock
      .filter((s) => s.store === d.store.id)
      .reduce((s, r) => s + (r.physical ?? 0), 0);
    const parking = Math.max(
      0,
      (d.store.parkingCapacity ?? 0) - sourcePhysical,
    );
    d.direct = d.rule.directEligible
      ? Math.min(d.routeOrders + d.routeStock, d.rule.firstCapacity, parking)
      : 0;
    d.directOrders = Math.min(d.direct, d.routeOrders);
  }
  for (const d of priority) {
    d.viaOrders = Math.min(d.routeOrders - d.directOrders, vpcRemaining[d.vpc]);
    vpcRemaining[d.vpc] -= d.viaOrders;
  }
  for (const d of priority) {
    d.viaStock = Math.min(
      d.routeStock - (d.direct - d.directOrders),
      vpcRemaining[d.vpc],
    );
    vpcRemaining[d.vpc] -= d.viaStock;
  }
  const routedTotals: Record<string, number> = {};
  for (const d of drafts)
    routedTotals[d.route.id] =
      (routedTotals[d.route.id] ?? 0) + d.direct + d.viaOrders + d.viaStock;
  const batches: StoreBatch[] = [];
  const rows: DeliveryRow[] = drafts.map((d) => {
    const routed = d.direct + d.viaOrders + d.viaStock;
    const routeTotal = routedTotals[d.route.id];
    const quote =
      planningData.scenarioRoutes.find(
        (r) => r.scenario === scenario && r.id === d.route.id,
      )?.cost ??
      d.route.tripCost ??
      0;
    const totalQuote = Math.ceil(routeTotal / (d.route.load ?? 8)) * quote;
    const unitCost = routeTotal ? totalQuote / routeTotal : 0;
    const local: StoreBatch[] = [];
    const transportDay = Math.ceil((d.route.hours ?? 0) / 24);
    function batch(
      qty: number,
      orders: number,
      arrivalDay: number | null,
      via: boolean,
    ) {
      if (!qty) return;
      local.push({
        id: mode + "-" + d.store.id + "-" + (local.length + 1),
        storeId: d.store.id,
        storeName: d.store.name,
        origin: d.route.origin,
        source: "vessel",
        viaVpc: via ? d.vpc : null,
        routeClass: via ? "via_vpc" : "direct",
        qty,
        orders,
        replenishment: qty - orders,
        arrivalDay,
        unitCost,
        cost: qty * unitCost,
      });
    }
    batch(d.direct, d.directOrders, transportDay, false);
    let pending = d.viaOrders + d.viaStock,
      orders = d.viaOrders;
    for (const slot of [...d.rule.schedule].sort((a, b) => a.day - b.day)) {
      if (slot.day < transportDay + 1) continue;
      const qty = Math.min(pending, slot.capacity),
        orderQty = Math.min(orders, qty);
      batch(qty, orderQty, slot.day, true);
      pending -= qty;
      orders -= orderQty;
    }
    batch(pending, orders, null, true);
    batches.push(...local);
    const unrouted = d.store.total - routed;
    const onTime = local
      .filter((b) => b.arrivalDay !== null && b.arrivalDay <= d.store.dueDay)
      .reduce((s, b) => s + b.orders, 0);
    const late = local
      .filter((b) => b.arrivalDay !== null && b.arrivalDay > d.store.dueDay)
      .reduce((s, b) => s + b.orders, 0);
    return {
      storeId: d.store.id,
      storeName: d.store.name,
      origin: d.route.origin,
      serviceVpc: d.vpc,
      total: d.store.total,
      orders: d.store.orderAllocated,
      replenishment: d.store.replenishment,
      directQty: d.direct,
      viaVpcQty: d.viaOrders + d.viaStock,
      unroutedQty: unrouted,
      pendingScheduleQty: pending,
      lastArrival:
        pending || unrouted
          ? null
          : local.length
            ? Math.max(...local.map((b) => b.arrivalDay!))
            : null,
      orderOnTime: onTime,
      orderLate: late,
      orderPending: d.store.orderAllocated - onTime - late,
      knownCost: local.reduce((s, b) => s + b.cost, 0),
    };
  });
  const sum = (key: keyof DeliveryRow) =>
    rows.reduce((s, r) => s + Number(r[key]), 0);
  return {
    rows,
    batches,
    network: [...new Set(drafts.map((d) => d.route.id))].map((id) => {
      const route = drafts.find((d) => d.route.id === id)!.route;
      const source = planningData.scenarioRoutes.find(
        (r) => r.scenario === scenario && r.id === id,
      );
      return {
        ...route,
        capacity: source?.capacity ?? 0,
        quote: source?.cost ?? route.tripCost ?? 0,
        storeIds: drafts
          .filter((d) => d.route.id === id)
          .map((d) => d.store.id),
      };
    }),
    summary: {
      total: sum("total"),
      direct: sum("directQty"),
      viaVpc: sum("viaVpcQty"),
      unrouted: sum("unroutedQty"),
      pendingSchedule: sum("pendingScheduleQty"),
      capacityOverflow: rows.reduce(
        (s, r) =>
          s +
          (input.stores.find((i) => i.id === r.storeId)?.directEligible
            ? r.viaVpcQty
            : 0),
        0,
      ),
      orderOnTime: sum("orderOnTime"),
      orderLate: sum("orderLate"),
      orderPending: sum("orderPending"),
      knownCost: sum("knownCost"),
      cost: null,
    },
  };
}
