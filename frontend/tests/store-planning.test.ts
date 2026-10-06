import assert from "node:assert/strict";
import test from "node:test";
import { fourStoreAllocation as defaultAllocationScenario } from "./planning-fixture";
import {
  calculateStoreAllocation,
  calculateStoreDelivery,
  defaultDeliveryScenario,
} from "../src/lib/story/store-planning";

test("order-first waterfill reaches the hand-calculated store allocations", () => {
  const result = calculateStoreAllocation(defaultAllocationScenario());
  assert.deepEqual(
    result.rows.map((r) => [r.id, r.orderAllocated, r.replenishment, r.total]),
    [
      ["D1", 300, 407, 707],
      ["D2", 250, 171, 421],
      ["A1", 200, 322, 522],
      ["A2", 150, 0, 150],
    ],
  );
  assert.deepEqual(result.summary, {
    orders: 900,
    replenishment: 900,
    assigned: 1800,
    retained: 0,
    orderShortage: 0,
    replenishmentGap: 100,
  });
});
test("less supply and excess supply do not dilute orders or overfill stock", () => {
  for (const [supply, replenishments, retained, gap] of [
    [1500, [278, 86, 236, 0], 0, 400],
    [2000, [450, 200, 350, 0], 100, 0],
  ] as const) {
    const result = calculateStoreAllocation({
      ...defaultAllocationScenario(),
      supply,
    });
    assert.deepEqual(
      result.rows.map((r) => r.replenishment),
      replenishments,
    );
    assert.equal(result.summary.orders, 900);
    assert.equal(result.summary.retained, retained);
    assert.equal(result.summary.replenishmentGap, gap);
  }
});
test("short supply is spent on orders before replenishment", () => {
  const result = calculateStoreAllocation({
    ...defaultAllocationScenario(),
    supply: 500,
  });
  assert.equal(result.summary.orders, 500);
  assert.equal(result.summary.orderShortage, 400);
  assert.equal(result.summary.replenishment, 0);
  assert.equal(result.summary.assigned, 500);
});
test("integer waterfill breaks equal normalized levels by store ID", () => {
  const input = defaultAllocationScenario();
  input.supply = 1;
  input.stores = [
    {
      ...input.stores[0],
      id: "D1",
      orders: 0,
      weeklySales: 100,
      availableStock: 0,
    },
    {
      ...input.stores[2],
      id: "A1",
      orders: 0,
      weeklySales: 1,
      availableStock: 0,
    },
  ];
  const result = calculateStoreAllocation(input);
  assert.deepEqual(
    result.rows.map((r) => r.replenishment),
    [0, 1],
  );
});
test("zero sales and store total caps cannot produce invalid WoS or overflow", () => {
  const input = defaultAllocationScenario();
  input.stores[0].allocationCap = 600;
  const capped = calculateStoreAllocation(input);
  assert.equal(capped.rows[0].total, 600);
  assert.equal(capped.summary.replenishment, 850);
  assert.equal(capped.summary.retained, 50);
  input.stores.forEach((s) => {
    s.weeklySales = 0;
  });
  const zero = calculateStoreAllocation(input);
  assert.ok(
    zero.rows.every((r) => r.afterWos === null && r.replenishment === 0),
  );
  assert.equal(zero.summary.retained, 900);
});
test("negative or nonfinite scenario inputs are rejected", () => {
  assert.throws(
    () =>
      calculateStoreAllocation({ ...defaultAllocationScenario(), supply: -1 }),
    /供给/,
  );
  const input = defaultAllocationScenario();
  input.stores[0].weeklySales = NaN;
  assert.throws(() => calculateStoreAllocation(input), /销速/);
});
test("parking capability splits the same store between direct and VPC batches", () => {
  const allocation = calculateStoreAllocation(defaultAllocationScenario());
  const result = calculateStoreDelivery(allocation, defaultDeliveryScenario());
  assert.equal(result.single.summary.direct, 650);
  assert.equal(result.single.summary.viaVpc, 1150);
  assert.equal(result.single.summary.capacityOverflow, 579);
  assert.equal(result.single.rows[0].directQty, 400);
  assert.equal(result.single.rows[0].viaVpcQty, 307);
  assert.equal(result.single.rows[2].directQty, 250);
  assert.equal(result.single.rows[2].viaVpcQty, 272);
  assert.equal(result.single.summary.total, 1800);
});
test("single and dual ports preserve store ownership but change cost and on-time orders", () => {
  const result = calculateStoreDelivery(
    calculateStoreAllocation(defaultAllocationScenario()),
    defaultDeliveryScenario(),
  );
  assert.equal(result.dual.summary.cost, 609460);
  assert.equal(result.single.summary.cost, 880900);
  assert.equal(result.saving, 271440);
  assert.equal(result.dual.summary.orderOnTime, 900);
  assert.equal(result.single.summary.orderOnTime, 700);
  assert.equal(result.single.summary.orderLate, 200);
  assert.deepEqual(
    result.single.rows.map((r) => r.total),
    [707, 421, 522, 150],
  );
  assert.deepEqual(
    result.dual.rows.map((r) => r.total),
    [707, 421, 522, 150],
  );
  assert.equal(result.single.rows[2].lastArrival, 13);
  assert.equal(result.dual.rows[2].lastArrival, 10);
});
test("a new 100-slot store parking option converts only 100 vehicles to direct", () => {
  const input = defaultDeliveryScenario();
  input.stores[1].directEligible = true;
  input.stores[1].firstCapacity = 100;
  const result = calculateStoreDelivery(
    calculateStoreAllocation(defaultAllocationScenario()),
    input,
  );
  assert.equal(result.single.rows[1].directQty, 100);
  assert.equal(result.single.rows[1].viaVpcQty, 321);
  assert.equal(result.single.summary.cost, 870900);
});
test("VPC capacity shortages stay unrouted and missing receiving slots keep ETA unknown", () => {
  const input = defaultDeliveryScenario();
  input.vpcCapacity.JED = 100;
  input.stores[2].schedule = [];
  const result = calculateStoreDelivery(
    calculateStoreAllocation(defaultAllocationScenario()),
    input,
  );
  assert.equal(result.single.rows[0].unroutedQty, 207);
  assert.equal(result.single.rows[2].pendingScheduleQty, 272);
  assert.equal(result.single.rows[2].lastArrival, null);
  assert.equal(result.single.summary.unrouted, 207);
  assert.equal(result.single.summary.pendingSchedule, 272);
  assert.equal(result.single.summary.cost, null);
  assert.equal(
    result.single.summary.direct +
      result.single.summary.viaVpc +
      result.single.summary.unrouted,
    1800,
  );
});
test("existing VPC stock is a separate supply and never gets a fabricated port leg", () => {
  const input = defaultDeliveryScenario();
  input.includeVpcStock = true;
  const result = calculateStoreDelivery(
    calculateStoreAllocation(defaultAllocationScenario()),
    input,
  );
  assert.equal(result.single.summary.total, 1800);
  assert.equal(result.vpcStock.qty, 20);
  assert.equal(result.vpcStock.cost, 2000);
  assert.equal(result.vpcStock.batches[0].routeClass, "vpc_origin");
  assert.equal(result.vpcStock.batches[0].origin, "RUH VPC");
});
test("capacity-driven VPC quantities only include vehicles with allocated VPC space", () => {
  const input = defaultDeliveryScenario();
  input.vpcCapacity = { JED: 0, RUH: 0, DMM: 0 };
  const result = calculateStoreDelivery(
    calculateStoreAllocation(defaultAllocationScenario()),
    input,
  );
  assert.equal(result.single.summary.viaVpc, 0);
  assert.equal(result.single.summary.unrouted, 1150);
  assert.equal(result.single.summary.capacityOverflow, 0);
});
