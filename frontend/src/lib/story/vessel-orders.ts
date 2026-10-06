import network from "../store-planning-data.json";
import geography from "../query-map-data.json";
import { completeCostRates } from "./logistics-cost";
import { vesselOverview, type VesselOverviewData } from "./vessel-overview";

export type OrderPortMode = "single" | "dual";
export type VesselOrder = {
  id: string;
  storeId: string;
  model: string;
  brand: "丰田" | "雷克萨斯";
  channel: "直营" | "授权";
  type: string;
  quantity: number;
  allocated: number;
};
export type OrderStore = VesselOverviewData["stores"][number] & {
  city: string;
  coordinates: number[];
};
export type OrderTripStop = {
  storeId: string;
  storeName: string;
  city: string;
  quantity: number;
  cost: number;
  orders: { orderId: string; model: string; quantity: number }[];
};
export type OrderTrip = {
  id: string;
  portId: "P-W" | "P-E";
  portName: string;
  quantity: number;
  capacity: number;
  stops: OrderTripStop[];
  linehaulCost: number;
  handlingCost: number;
  totalCost: number;
  unitCost: number;
};
export type OrderTransportPlan = {
  mode: OrderPortMode;
  trips: OrderTrip[];
  quantity: number;
  totalCost: number;
};

// Integer largest-remainder apportionment preserves the overview's commitments.
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const result = exact.map(Math.floor);
  const priority = exact
    .map((n, i) => ({ i, fraction: n - result[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remainder = total - result.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[priority[i].i]++;
  return result;
}

export function createVesselOrders(overview: VesselOverviewData) {
  const cities = geography.cities as Record<string, { coordinates: number[] }>;
  const stores: OrderStore[] = overview.stores.map((store) => {
    const source = network.stores.find((s) => s.id === store.id);
    if (!source || !cities[source.city])
      throw new Error(`门店 ${store.id} 缺少城市坐标`);
    return {
      ...store,
      city: source.city,
      coordinates: cities[source.city].coordinates,
    };
  });
  const orders: VesselOrder[] = [];
  const types = ["零售订单", "大客户订单", "展厅订单"];
  for (const model of overview.models) {
    for (const channel of ["直营", "授权"] as const) {
      const eligible = stores.filter(
        (s) =>
          s.channel === channel &&
          network.stores
            .find((source) => source.id === s.id)
            ?.brands.includes(model.brand),
      );
      const total =
        channel === "直营" ? model.directOrders : model.authorizedOrders;
      const shortage =
        channel === "直营"
          ? model.directOrderShortage
          : model.authorizedOrderShortage;
      if (!eligible.length && total)
        throw new Error(`${model.model} 没有可承接订单的门店`);
      const quantities = apportion(
        total,
        eligible.map((s) => s.weeklySales),
      );
      const shortages = apportion(shortage, quantities);
      eligible.forEach((store, index) => {
        const byType = apportion(
          quantities[index],
          channel === "直营" ? [7, 2, 1] : [4, 4, 2],
        );
        const gaps = apportion(shortages[index], byType);
        byType.forEach((quantity, typeIndex) => {
          if (!quantity) return;
          orders.push({
            id: `SIM-ORD-${String(orders.length + 1).padStart(5, "0")}`,
            storeId: store.id,
            model: model.model,
            brand: model.brand,
            channel,
            type: types[typeIndex],
            quantity,
            allocated: quantity - gaps[typeIndex],
          });
        });
      });
    }
  }
  return {
    snapshotDate: overview.snapshotDate,
    assumptions: [
      "模拟订单明细沿用基本统计的渠道 × 车型总量，以门店八周销速为权重分摊；订单号为模拟编号。",
      "单港为吉达；双港按目的城市的整趟情景报价择港。默认 8 台/车，邻近城市合车，最多 3 个卸货点。",
      "整趟报价 + 120 SAR × 额外卸货点 + 港口处理/整备费；成本不含 VPC、跨港调拨和海运。",
      "仅运输本船已分配订单，不含缺口订单；与可编辑品牌注水情景采用独立口径。",
    ],
    stores,
    orders,
    plans: {
      single: planOrderTrips(stores, orders, "single"),
      dual: planOrderTrips(stores, orders, "dual"),
    },
  };
}

// Neighbouring cities can share a truck; this is a schematic advice scenario.
const corridors = [
  ["吉达", "麦加", "塔伊夫"],
  ["延布", "麦地那"],
  ["达曼", "胡拜尔", "朱拜勒", "哈萨"],
  ["布赖代", "欧奈宰"],
  ["艾卜哈", "海米斯穆谢特"],
];
export const orderPorts = {
  "P-W": { name: "吉达港", coordinates: [39.16, 21.48] },
  "P-E": { name: "达曼港", coordinates: [50.18, 26.5] },
} as const;

export function planOrderTrips(
  stores: OrderStore[],
  orders: VesselOrder[],
  mode: OrderPortMode,
): OrderTransportPlan {
  const trips: OrderTrip[] = [];
  const buckets = new Map<
    string,
    {
      store: OrderStore;
      route: (typeof network.routes)[number];
      orders: VesselOrder[];
    }[]
  >();
  for (const store of stores) {
    const allocated = orders.filter(
      (o) => o.storeId === store.id && o.allocated > 0,
    );
    if (!allocated.length) continue;
    const routes = network.routes
      .filter(
        (r) =>
          r.city === store.city && (mode === "dual" || r.originId === "P-W"),
      )
      .sort((a, b) => a.tripCost - b.tripCost || a.id.localeCompare(b.id));
    const route = routes[0];
    if (!route) throw new Error(`缺少到 ${store.city} 的物流路线`);
    const corridor =
      corridors.find((cities) => cities.includes(store.city))?.join("/") ??
      store.city;
    const key = route.originId + ":" + corridor;
    buckets.set(key, [
      ...(buckets.get(key) ?? []),
      { store, route, orders: allocated },
    ]);
  }
  for (const entries of buckets.values()) {
    entries.sort(
      (a, b) => a.route.km - b.route.km || a.store.id.localeCompare(b.store.id),
    );
    const portId = entries[0].route.originId as OrderTrip["portId"];
    const capacity = Math.min(...entries.map((e) => e.route.load));
    let stops: OrderTripStop[] = [],
      quantity = 0;
    function finish() {
      if (!quantity) return;
      const used = entries.filter((e) =>
        stops.some((s) => s.storeId === e.store.id),
      );
      // Whole-truck quote + additional unloading stops; no VPC or duplicate last-mile charge.
      const linehaulCost =
        Math.max(...used.map((e) => e.route.tripCost)) +
        (stops.length - 1) * 120;
      const handlingCost =
        quantity *
        ((completeCostRates.portHandling ?? 0) + (completeCostRates.pdi ?? 0));
      const totalCost = linehaulCost + handlingCost;
      const shares = apportion(
        totalCost,
        stops.map((s) => s.quantity),
      );
      stops.forEach((stop, i) => {
        stop.cost = shares[i];
      });
      trips.push({
        id: `SIM-${mode === "single" ? "S" : "D"}-${String(trips.length + 1).padStart(3, "0")}`,
        portId,
        portName: orderPorts[portId].name,
        quantity,
        capacity,
        stops,
        linehaulCost,
        handlingCost,
        totalCost,
        unitCost: totalCost / quantity,
      });
      stops = [];
      quantity = 0;
    }
    for (const entry of entries) {
      for (const order of entry.orders) {
        let remaining = order.allocated;
        while (remaining > 0) {
          if (
            quantity === capacity ||
            (stops.length === 3 &&
              !stops.some((s) => s.storeId === entry.store.id))
          )
            finish();
          let stop = stops.find((s) => s.storeId === entry.store.id);
          if (!stop) {
            stop = {
              storeId: entry.store.id,
              storeName: entry.store.name,
              city: entry.store.city,
              quantity: 0,
              cost: 0,
              orders: [],
            };
            stops.push(stop);
          }
          const amount = Math.min(capacity - quantity, remaining);
          stop.orders.push({
            orderId: order.id,
            model: order.model,
            quantity: amount,
          });
          stop.quantity += amount;
          quantity += amount;
          remaining -= amount;
        }
      }
    }
    finish();
  }
  return {
    mode,
    trips,
    quantity: trips.reduce((sum, t) => sum + t.quantity, 0),
    totalCost: trips.reduce((sum, t) => sum + t.totalCost, 0),
  };
}

export const vesselOrders = createVesselOrders(vesselOverview);
