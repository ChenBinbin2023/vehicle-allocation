import type {
  OrderPortMode,
  OrderStore,
  OrderTransportPlan,
  VesselOrder,
} from "./vessel-orders";

export type OrderCostMetrics = {
  quantity: number;
  totalCost: number;
  unitCost: number | null;
};
export type OrderStoreCosts = Pick<
  OrderStore,
  "id" | "name" | "shortName" | "region"
> & {
  single: OrderCostMetrics;
  dual: OrderCostMetrics;
};
export type OrderRegionCosts = {
  name: string;
  single: OrderCostMetrics;
  dual: OrderCostMetrics;
};
export type OrderLogisticsSummary = {
  stores: OrderStoreCosts[];
  regions: OrderRegionCosts[];
  single: OrderCostMetrics;
  dual: OrderCostMetrics;
  change: { amount: number; percent: number | null };
};

const emptyCost = (): OrderCostMetrics => ({
  quantity: 0,
  totalCost: 0,
  unitCost: null,
});
function completeCost(cost: OrderCostMetrics) {
  cost.unitCost = cost.quantity ? cost.totalCost / cost.quantity : null;
  return cost;
}

export function summarizeOrderLogistics(
  stores: OrderStore[],
  orders: VesselOrder[],
  plans: Record<OrderPortMode, OrderTransportPlan>,
): OrderLogisticsSummary {
  const selectedOrders = new Set(orders.map((order) => order.id));
  const byStore = new Map(
    stores.map((store) => [
      store.id,
      {
        id: store.id,
        name: store.name,
        shortName: store.shortName,
        region: store.region,
        single: emptyCost(),
        dual: emptyCost(),
      },
    ]),
  );
  for (const mode of ["single", "dual"] as const) {
    for (const trip of plans[mode].trips) {
      for (const stop of trip.stops) {
        const row = byStore.get(stop.storeId);
        if (!row || !stop.quantity) continue;
        const quantity = stop.orders.reduce(
          (sum, order) =>
            sum + (selectedOrders.has(order.orderId) ? order.quantity : 0),
          0,
        );
        row[mode].quantity += quantity;
        // Keep the existing manifest's cost shares; a filter does not reprice the truck.
        row[mode].totalCost += stop.cost * (quantity / stop.quantity);
      }
    }
  }
  const rows = [...byStore.values()].sort(
    (a, b) =>
      b.single.totalCost - a.single.totalCost || a.id.localeCompare(b.id),
  );
  const byRegion = new Map<string, OrderRegionCosts>();
  const single = emptyCost(),
    dual = emptyCost();
  for (const row of rows) {
    const region = byRegion.get(row.region) ?? {
      name: row.region,
      single: emptyCost(),
      dual: emptyCost(),
    };
    for (const mode of ["single", "dual"] as const) {
      completeCost(row[mode]);
      region[mode].quantity += row[mode].quantity;
      region[mode].totalCost += row[mode].totalCost;
      const total = mode === "single" ? single : dual;
      total.quantity += row[mode].quantity;
      total.totalCost += row[mode].totalCost;
    }
    byRegion.set(row.region, region);
  }
  const regions = [...byRegion.values()];
  for (const region of regions) {
    completeCost(region.single);
    completeCost(region.dual);
  }
  const amount = single.totalCost - dual.totalCost;
  return {
    stores: rows,
    regions,
    single: completeCost(single),
    dual: completeCost(dual),
    change: {
      amount,
      percent: dual.totalCost ? (amount / dual.totalCost) * 100 : null,
    },
  };
}
