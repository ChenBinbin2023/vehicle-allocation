import network from "../query-data.json";
import geography from "../query-map-data.json";
import economics from "../profit-data.json";

export type DispatchFilter = "all" | "new" | "waiting";
export type DispatchStore = {
  id: string;
  name: string;
  city: string;
  region: string;
  coordinates: number[];
  channel: string;
};
export type DispatchOrder = {
  id: string;
  storeId: string;
  model: string;
  trim: string;
  color: string;
  quantity: number;
  status: "new" | "waiting" | "cancelled";
  createdDate: string;
  dueHours: number;
  revenue: number;
  purchase: number;
  other: number;
};
export type DispatchSource = {
  id: string;
  name: string;
  type: "vpc" | "store" | "dealer";
  city: string;
  region: string;
  serviceRegions: string[];
  coordinates: number[];
};
export type DispatchInventory = {
  vin: string;
  sourceId: string;
  model: string;
  trim: string;
  color: string;
  available: boolean;
};
export type DispatchVehicle = {
  id: string;
  orderId: string;
  storeId: string;
  vin?: string;
  sourceId?: string;
  tripId?: string;
  logistics?: number;
  arrivalHours?: number;
};
export type DispatchTrip = {
  id: string;
  sourceId: string;
  mode: "small" | "consolidated";
  capacity: number;
  vehicleIds: string[];
  storeIds: string[];
  distance: number;
  departHours: number;
  arrivalHours: number;
  totalCost: number;
  comparison?: {
    quantity: number;
    smallCost: number;
    smallArrivalHours: number;
    consolidatedCost: number;
    consolidatedArrivalHours: number;
    reason: string;
  };
};
export type DispatchOption = {
  id: string;
  kind: "cross-region" | "local-dealer";
  sourceId: string;
  vin: string;
  mode: string;
  revenue: number;
  purchase: number;
  logistics: number;
  other: number;
  totalCost: number;
  profit: number;
  arrivalHours: number;
  onTime: boolean;
};
export type DispatchShortage = {
  vehicleId: string;
  options: DispatchOption[];
  recommendedId: string;
  requiresReview: boolean;
  reason: string;
};
export type DispatchSnapshot = {
  selections?: Record<string, string>;
  fulfillment?: import("./dispatch-fulfillment").DispatchFulfillment;
  date: string;
  yesterday: string;
  generatedAt: string;
  simulation: true;
  stores: DispatchStore[];
  orders: DispatchOrder[];
  sources: DispatchSource[];
  inventory: DispatchInventory[];
  vehicles: DispatchVehicle[];
  trips: DispatchTrip[];
  shortages: DispatchShortage[];
  summary: {
    newOrders: number;
    newVehicles: number;
    cancelledOrders: number;
    cancelledVehicles: number;
    waitingOrders: number;
    waitingVehicles: number;
    orders: number;
    vehicles: number;
    shortage: number;
    logistics: number;
  };
};

const coordinates = (city: string) =>
  (geography.cities as Record<string, { coordinates: number[] }>)[city]
    .coordinates;
const hubs = [
  { id: "JED", city: "吉达", region: "西部", serviceRegions: ["西部", "南部"] },
  {
    id: "RUH",
    city: "利雅得",
    region: "中部",
    serviceRegions: ["中部", "北部"],
  },
  { id: "DMM", city: "达曼", region: "东部", serviceRegions: ["东部"] },
];
const sourceIdFor = (region: string) =>
  hubs.find((h) => h.serviceRegions.includes(region))!.id;

// Road distance and tariffs below are explicit demo assumptions, independent of
// the historical port quotation tables and the legacy VIN inventory baseline.
function roadDistance(from: number[], to: number[]) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((to[1] - from[1]) * rad) / 2) ** 2 +
    Math.cos(from[1] * rad) *
      Math.cos(to[1] * rad) *
      Math.sin(((to[0] - from[0]) * rad) / 2) ** 2;
  return Math.max(18, Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 1.22));
}
function travelHours(km: number) {
  return Math.ceil(km / 60) + 3;
}

export function dispatchDemand(
  data: DispatchSnapshot,
  filter: DispatchFilter,
  storeId?: string,
) {
  return data.orders.filter(
    (o) =>
      o.status !== "cancelled" &&
      (filter === "all" || o.status === filter) &&
      (!storeId || o.storeId === storeId),
  );
}

export function createDispatchSnapshot(): DispatchSnapshot {
  const date = "2026-10-07",
    yesterday = "2026-10-06";
  const selectedIds = [
    "MOCK-D-001",
    "MOCK-D-002",
    "MOCK-D-007",
    "MOCK-D-008",
    "MOCK-D-012",
    "MOCK-D-015",
    "MOCK-D-017",
    "MOCK-D-019",
    "MOCK-D-023",
    "MOCK-D-026",
    "MOCK-D-027",
    "MOCK-D-028",
    "MOCK-D-030",
    "MOCK-D-031",
    "MOCK-D-033",
    "MOCK-D-034",
  ];
  const stores: DispatchStore[] = selectedIds.map((id) => {
    const store = network.stores.find((s) => s.id === id)!;
    return {
      id,
      name: store.name.replace("模拟直营·", "").replace(/·(\d+)店/, " $1店"),
      city: store.city,
      region: store.region,
      coordinates: coordinates(store.city),
      channel: store.channel,
    };
  });
  const sources: DispatchSource[] = hubs.map((hub) => ({
    ...hub,
    name: `${hub.city} VPC`,
    type: "vpc",
    coordinates: coordinates(hub.city),
  }));
  for (const region of [...new Set(stores.map((s) => s.region))]) {
    const store = stores.find((s) => s.region === region)!;
    sources.push({
      id: `STORE-${region}`,
      name: `${store.city}北环库存店`,
      type: "store",
      city: store.city,
      region,
      serviceRegions: [region],
      coordinates: store.coordinates,
    });
    sources.push({
      id: `DEALER-${region}`,
      name: `${store.city}本区授权店`,
      type: "dealer",
      city: store.city,
      region,
      serviceRegions: [region],
      coordinates: store.coordinates,
    });
  }
  const special: Record<
    string,
    { model: string; trim: string; color: string }
  > = {
    中部: { model: "LX", trim: "VIP 四座版", color: "珍珠白" },
    西部: { model: "RX", trim: "F SPORT", color: "曜石黑" },
    东部: { model: "ES", trim: "行政版", color: "钛银" },
    北部: { model: "海拉克斯", trim: "柴油双排 4×4", color: "珍珠白" },
    南部: { model: "兰德酷路泽300", trim: "GR SPORT", color: "曜石黑" },
  };
  const seenRegions = new Set<string>();
  const orders: DispatchOrder[] = [];
  stores.forEach((store, i) => {
    const supported = economics.models.filter((m) =>
      network.stores.find((s) => s.id === store.id)!.brands.includes(m.brand),
    );
    for (let j = 0; j < 3; j++) {
      const regionalShortage = j === 2 && !seenRegions.has(store.region);
      const config = regionalShortage
        ? special[store.region]
        : {
            model: supported[(i + j) % supported.length].model,
            trim: j % 2 ? "豪华版" : "标准版",
            color: (i + j) % 2 ? "珍珠白" : "钛银",
          };
      const price = economics.models.find((m) => m.model === config.model)!;
      orders.push({
        ...config,
        id: `SIM-DAY-${String(orders.length + 1).padStart(3, "0")}`,
        storeId: store.id,
        quantity: regionalShortage
          ? store.region === "中部"
            ? 2
            : 1
          : i === 0
            ? [5, 3, 2][j]
            : i === 5 && j === 0
              ? 1
              : 1 + ((i + j) % 3),
        status: j === 1 ? "waiting" : "new",
        createdDate: j === 1 ? "2026-10-05" : yesterday,
        dueHours: regionalShortage
          ? ["中部", "南部"].includes(store.region)
            ? 24
            : 96
          : i === 5 && j === 0
            ? 8
            : 72,
        revenue: price.unitPrice - price.discount,
        purchase: price.purchase,
        other:
          price.other +
          Math.round(
            ((price.unitPrice - price.discount) * price.commissionPct) / 100,
          ),
      });
    }
    seenRegions.add(store.region);
    if (i % 4 === 0) {
      const order = orders.at(-3)!;
      orders.push({
        ...order,
        id: `SIM-DAY-${String(orders.length + 1).padStart(3, "0")}`,
        quantity: 1 + (i % 3),
        status: "cancelled",
        createdDate: yesterday,
      });
    }
  });
  const inventory: DispatchInventory[] = [];
  const vehicles: DispatchVehicle[] = [];
  const active = orders.filter((o) => o.status !== "cancelled");
  for (const order of active) {
    const store = stores.find((s) => s.id === order.storeId)!;
    for (let n = 0; n < order.quantity; n++) {
      vehicles.push({
        id: `${order.id}-CAR-${n + 1}`,
        orderId: order.id,
        storeId: store.id,
      });
      if (order.trim === special[store.region].trim) continue;
      const sourceId =
        n % 3 === 2 || order.status === "waiting"
          ? `STORE-${store.region}`
          : sourceIdFor(store.region);
      inventory.push({
        vin: `SIM-${sourceId}-${String(inventory.length + 1).padStart(4, "0")}`,
        sourceId,
        model: order.model,
        trim: order.trim,
        color: order.color,
        available: true,
      });
    }
  }
  // A locked car with a matching configuration must never be counted as available.
  inventory.push({ ...inventory[0], vin: "SIM-LOCKED-0001", available: false });
  const used = new Set<string>();
  for (const vehicle of vehicles) {
    const order = orders.find((o) => o.id === vehicle.orderId)!;
    const store = stores.find((s) => s.id === order.storeId)!;
    const candidates = inventory
      .filter((unit) => {
        const source = sources.find((s) => s.id === unit.sourceId)!;
        return (
          unit.available &&
          !used.has(unit.vin) &&
          source.type !== "dealer" &&
          source.serviceRegions.includes(store.region) &&
          unit.model === order.model &&
          unit.trim === order.trim &&
          unit.color === order.color
        );
      })
      .sort((a, b) => {
        const sa = sources.find((s) => s.id === a.sourceId)!,
          sb = sources.find((s) => s.id === b.sourceId)!;
        return (
          roadDistance(sa.coordinates, store.coordinates) -
          roadDistance(sb.coordinates, store.coordinates)
        );
      });
    if (candidates[0]) {
      used.add(candidates[0].vin);
      vehicle.vin = candidates[0].vin;
      vehicle.sourceId = candidates[0].sourceId;
    }
  }
  const trips: DispatchTrip[] = [];
  const grouped = new Map<string, DispatchVehicle[]>();
  for (const vehicle of vehicles.filter((v) => v.vin)) {
    const order = orders.find((o) => o.id === vehicle.orderId)!;
    const store = stores.find((s) => s.id === vehicle.storeId)!;
    // Urgent orders depart separately; consolidation stays within a regional corridor.
    const key = `${vehicle.sourceId}|${store.region}|${order.dueHours < 24 ? order.id : "shared"}`;
    grouped.set(key, [...(grouped.get(key) ?? []), vehicle]);
  }
  for (const cars of grouped.values()) {
    let pending = [...cars];
    while (pending.length) {
      const load: DispatchVehicle[] = [];
      const stops = new Set<string>();
      for (const car of pending) {
        if (load.length >= 8 || (!stops.has(car.storeId) && stops.size >= 3))
          break;
        load.push(car);
        stops.add(car.storeId);
      }
      pending = pending.slice(load.length);
      const source = sources.find((s) => s.id === load[0].sourceId)!;
      const destinations = [...stops].map((id) =>
        stores.find((s) => s.id === id)!,
      );
      const distance = Math.max(
        ...destinations.map((s) =>
          roadDistance(source.coordinates, s.coordinates),
        ),
      );
      const urgent = load.some(
        (v) => orders.find((o) => o.id === v.orderId)!.dueHours < 24,
      );
      const direct = destinations.flatMap((destination) => {
        const cars = load.filter((v) => v.storeId === destination.id);
        const km = roadDistance(source.coordinates, destination.coordinates);
        return Array.from({ length: Math.ceil(cars.length / 2) }, (_, i) => ({
          cars: cars.slice(i * 2, i * 2 + 2),
          distance: km,
          arrivalHours: 1 + travelHours(km),
          totalCost: Math.round(240 + km * 2.4),
        }));
      });
      const smallCost = direct.reduce((n, t) => n + t.totalCost, 0);
      const consolidatedCost = Math.round(
        900 + distance * 3.2 + (stops.size - 1) * 120,
      );
      const consolidatedArrivalHours =
        6 + travelHours(distance) + (stops.size - 1) * 2;
      const canConsolidate = load.every(
        (v) =>
          orders.find((o) => o.id === v.orderId)!.dueHours >=
          consolidatedArrivalHours,
      );
      const chooseSmall =
        urgent ||
        load.length <= 2 ||
        !canConsolidate ||
        smallCost <= consolidatedCost;
      const comparison = {
        quantity: load.length,
        smallCost,
        smallArrivalHours: Math.max(...direct.map((t) => t.arrivalHours)),
        consolidatedCost,
        consolidatedArrivalHours,
        reason:
          urgent || !canConsolidate
            ? "小车直送优先满足订单交期。"
            : chooseSmall
              ? "小车组合成本更低或相同，且到店更快，采用小车直送。"
              : "两种方式均按期；大车拼载成本更低，采用合并配送。",
      };
      const selected = chooseSmall
        ? direct
        : [
            {
              cars: load,
              distance,
              arrivalHours: consolidatedArrivalHours,
              totalCost: consolidatedCost,
            },
          ];
      for (const selectedLoad of selected) {
        const trip: DispatchTrip = {
          id: `DSP-${String(trips.length + 1).padStart(3, "0")}`,
          sourceId: source.id,
          mode: chooseSmall ? "small" : "consolidated",
          capacity: chooseSmall ? 2 : 8,
          vehicleIds: selectedLoad.cars.map((v) => v.id),
          storeIds: [...new Set(selectedLoad.cars.map((v) => v.storeId))],
          distance: selectedLoad.distance,
          departHours: chooseSmall ? 1 : 6,
          arrivalHours: selectedLoad.arrivalHours,
          totalCost: selectedLoad.totalCost,
          comparison,
        };
        trips.push(trip);
        selectedLoad.cars.forEach((vehicle, i) => {
          vehicle.tripId = trip.id;
          vehicle.arrivalHours = trip.arrivalHours;
          vehicle.logistics =
            Math.floor(trip.totalCost / selectedLoad.cars.length) +
            (i < trip.totalCost % selectedLoad.cars.length ? 1 : 0);
        });
      }
    }
  }
  const shortages: DispatchShortage[] = vehicles
    .filter((v) => !v.vin)
    .map((vehicle, index) => {
      const order = orders.find((o) => o.id === vehicle.orderId)!;
      const store = stores.find((s) => s.id === vehicle.storeId)!;
      const crossSource = sources
        .filter(
          (s) => s.type === "vpc" && !s.serviceRegions.includes(store.region),
        )
        .sort(
          (a, b) =>
            roadDistance(a.coordinates, store.coordinates) -
            roadDistance(b.coordinates, store.coordinates),
        )[0];
      const dealer = sources.find((s) => s.id === `DEALER-${store.region}`)!;
      const options: DispatchOption[] = [crossSource, dealer].map(
        (source, i) => {
          const cross = i === 0;
          const km = roadDistance(source.coordinates, store.coordinates);
          const logistics = Math.round(cross ? 600 + km * 2.4 : 240 + km * 2.4);
          const arrivalHours = cross
            ? 24 + travelHours(km)
            : 2 + travelHours(km);
          const purchase =
            order.purchase + (cross ? 0 : Math.round(order.purchase * 0.035));
          const other = order.other + (cross ? 180 : 350);
          const vin = `SIM-ALT-${String(index + 1).padStart(3, "0")}-${cross ? "VPC" : "DEALER"}`;
          inventory.push({
            vin,
            sourceId: source.id,
            model: order.model,
            trim: order.trim,
            color: order.color,
            available: true,
          });
          return {
            id: `${vehicle.id}-${cross ? "CROSS" : "LOCAL"}`,
            kind: cross ? "cross-region" : "local-dealer",
            sourceId: source.id,
            vin,
            mode: cross ? "跨区班次拼载 + 到店配送" : "授权店采购 + 小车直送",
            revenue: order.revenue,
            purchase,
            logistics,
            other,
            totalCost: purchase + logistics + other,
            profit: order.revenue - purchase - logistics - other,
            arrivalHours,
            onTime: arrivalHours <= order.dueHours,
          };
        },
      );
      const sorted = [...options].sort(
        (a, b) =>
          Number(b.onTime) - Number(a.onTime) ||
          b.profit - a.profit ||
          a.arrivalHours - b.arrivalHours,
      );
      const recommended = sorted[0],
        alternative = sorted[1];
      const requiresReview = recommended.profit < 0 || !recommended.onTime;
      const reason =
        recommended.profit < 0
          ? `两种方案均亏损；跨区调拨亏损较少，暂列成本更低的备选，建议复核采购报价或销售条件后再决定。`
          : !recommended.onTime
            ? "两种方案均无法按期到店，建议先确认客户可接受的交期，再决定车源。"
            : !alternative.onTime && recommended.onTime
              ? `订单需 ${order.dueHours} 小时内到店；跨区方案需 ${alternative.arrivalHours} 小时，推荐本区采购，优先保住交付承诺。`
              : `两种方案均可按期到店；${recommended.kind === "cross-region" ? "跨区调拨" : "本区采购"}单车贡献利润高 ${Math.abs(recommended.profit - alternative.profit).toLocaleString("en-US")} SAR，优先选择利润更高的方案。`;
      return {
        vehicleId: vehicle.id,
        options,
        recommendedId: recommended.id,
        requiresReview,
        reason,
      };
    });
  const count = (status: DispatchOrder["status"]) =>
    orders.filter((o) => o.status === status);
  const quantity = (rows: DispatchOrder[]) =>
    rows.reduce((n, o) => n + o.quantity, 0);
  return {
    date,
    yesterday,
    generatedAt: `${date}T08:30:00+03:00`,
    simulation: true,
    stores,
    orders,
    sources,
    inventory,
    vehicles,
    trips,
    shortages,
    summary: {
      newOrders: count("new").length,
      newVehicles: quantity(count("new")),
      cancelledOrders: count("cancelled").length,
      cancelledVehicles: quantity(count("cancelled")),
      waitingOrders: count("waiting").length,
      waitingVehicles: quantity(count("waiting")),
      orders: active.length,
      vehicles: vehicles.length,
      shortage: shortages.length,
      logistics: trips.reduce((n, t) => n + t.totalCost, 0),
    },
  };
}

export function dispatchArrival(data: DispatchSnapshot, hours: number) {
  const time = new Date(new Date(data.generatedAt).getTime() + hours * 3600000);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Riyadh",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(time);
}
