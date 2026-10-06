import data from "../store-planning-data.json";
import type { StoreAllocation, StoreDelivery } from "./store-planning";
export function deliveryNetwork(
  allocation: StoreAllocation,
  delivery: StoreDelivery,
  mode: "single" | "dual",
) {
  const port = delivery[mode];
  const routeIds = new Set(
    data.mapping
      .filter(
        (m) =>
          allocation.rows.some((s) => s.id === m.store) &&
          (mode === "dual" ? m.dual === "是" : m.west === "是"),
      )
      .map((m) => m.route),
  );
  const metadata =
    port.network ??
    [...routeIds].map((id) => {
      const route = data.routes.find((r) => r.id === id)!;
      const scenario = data.scenarioRoutes.find(
        (r) =>
          r.id === id &&
          r.scenario === (mode === "dual" ? "SC-DUAL" : "SC-WEST"),
      );
      return {
        ...route,
        capacity: scenario?.capacity ?? 0,
        quote: scenario?.cost ?? route.tripCost ?? 0,
        storeIds: data.mapping
          .filter(
            (m) =>
              m.route === id &&
              (mode === "dual" ? m.dual === "是" : m.west === "是"),
          )
          .map((m) => m.store),
      };
    });
  return metadata.map((route) => {
    const ids = new Set(route.storeIds);
    const rows = port.rows.filter((r) => ids.has(r.storeId));
    const batches = port.batches.filter((b) => ids.has(b.storeId));
    const sum = (
      key:
        | "total"
        | "directQty"
        | "viaVpcQty"
        | "unroutedQty"
        | "pendingScheduleQty",
    ) => rows.reduce((s, r) => s + r[key], 0);
    return {
      ...route,
      total: sum("total"),
      routed: sum("directQty") + sum("viaVpcQty"),
      direct: sum("directQty"),
      via: sum("viaVpcQty"),
      unrouted: sum("unroutedQty"),
      pending: sum("pendingScheduleQty"),
      linehaul: batches.reduce((s, b) => s + b.cost, 0),
      rows,
      batches,
    };
  });
}
export type DeliveryNetworkRoute = ReturnType<typeof deliveryNetwork>[number];
