import assert from "node:assert/strict";
import test from "node:test";
import { vesselOverview } from "../src/lib/story/vessel-overview";
import { vesselOrders, planOrderTrips } from "../src/lib/story/vessel-orders";
import { createCampaignState } from "../src/lib/story/seed";
import { startStoryRun } from "../src/lib/story/skill-runner";

test("order details preserve all overview model/channel commitments and shortages", () => {
  assert.equal(vesselOrders.stores.length, 79);
  assert.equal(
    vesselOrders.orders.reduce((s, o) => s + o.quantity, 0),
    1694,
  );
  assert.equal(
    vesselOrders.orders.reduce((s, o) => s + o.allocated, 0),
    1642,
  );
  assert.equal(
    new Set(vesselOrders.orders.map((o) => o.id)).size,
    vesselOrders.orders.length,
  );
  for (const model of vesselOverview.models) {
    for (const channel of ["直营", "授权"] as const) {
      const orders = vesselOrders.orders.filter(
        (o) => o.model === model.model && o.channel === channel,
      );
      assert.equal(
        orders.reduce((s, o) => s + o.quantity, 0),
        channel === "直营" ? model.directOrders : model.authorizedOrders,
      );
      assert.equal(
        orders.reduce((s, o) => s + o.quantity - o.allocated, 0),
        channel === "直营"
          ? model.directOrderShortage
          : model.authorizedOrderShortage,
      );
    }
  }
});

test("each port scenario ships allocated orders exactly once, with bounded loads and conserved stop costs", () => {
  for (const mode of ["single", "dual"] as const) {
    const plan = vesselOrders.plans[mode];
    assert.equal(plan.quantity, 1642);
    assert.ok(plan.trips.some((t) => t.stops.length > 1));
    assert.ok(plan.trips.every((t) => t.quantity > 0 && t.quantity <= 8));
    assert.ok(plan.trips.every((t) => mode === "dual" || t.portId === "P-W"));
    if (mode === "dual") assert.ok(plan.trips.some((t) => t.portId === "P-E"));
    for (const order of vesselOrders.orders) {
      const shipped = plan.trips
        .flatMap((t) => t.stops)
        .flatMap((s) => s.orders)
        .filter((o) => o.orderId === order.id);
      assert.equal(
        shipped.reduce((s, o) => s + o.quantity, 0),
        order.allocated,
      );
    }
    for (const trip of plan.trips) {
      assert.equal(
        trip.stops.reduce((s, stop) => s + stop.quantity, 0),
        trip.quantity,
      );
      assert.equal(
        trip.stops.reduce((s, stop) => s + stop.cost, 0),
        trip.totalCost,
      );
      assert.equal(trip.unitCost, trip.totalCost / trip.quantity);
    }
  }
  assert.ok(
    vesselOrders.plans.dual.totalCost < vesselOrders.plans.single.totalCost,
  );
});

test("partial trucks charge a whole trip and split order references without duplicating vehicles", () => {
  const store = vesselOrders.stores.find((s) => s.city === "吉达")!;
  const plan = planOrderTrips(
    [store],
    [
      {
        id: "ORDER-1",
        storeId: store.id,
        model: "Camry",
        brand: "丰田",
        channel: store.channel,
        type: "零售订单",
        quantity: 11,
        allocated: 11,
      },
    ],
    "single",
  );
  assert.deepEqual(
    plan.trips.map((t) => t.quantity),
    [8, 3],
  );
  // 吉达整趟报价 508 SAR，港口处理 150 + PDI 250 SAR / 台。
  assert.deepEqual(
    plan.trips.map((t) => t.totalCost),
    [3708, 1708],
  );
  assert.equal(plan.quantity, 11);
  assert.equal(plan.totalCost, 5416);
  assert.equal(planOrderTrips([store], [], "single").trips.length, 0);
});

test("order CUI exposes statistics and selectable logistics advice backed by its result totals", () => {
  const run = startStoryRun(
    "/order-allocation",
    "订单分车 物流建议 双港",
    createCampaignState(),
  );
  const orderEvent = run.events.find(
    (e) => e.operation === "vessel.orders.read",
  );
  assert.equal(orderEvent?.planningTab, "graph");
  assert.match(orderEvent?.detail ?? "", /1,694/);
  const logistics = run.events.find(
    (e) => e.operation === "vessel.orders.logistics",
  );
  assert.equal(logistics?.planningNode, "LOGISTICS-DUAL");
  assert.match(logistics?.detail ?? "", /1,642/);
});
