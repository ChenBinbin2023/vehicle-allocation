import assert from "node:assert/strict";
import test from "node:test";
import sourceData from "../src/lib/store-planning-data.json";
import {
  calculateStoreAllocation,
  calculateStoreDelivery,
  defaultAllocationScenario,
  defaultDeliveryScenario,
} from "../src/lib/story/store-planning";
import {
  completeCostRates,
  costBreakdown,
} from "../src/lib/story/logistics-cost";
import { deliveryNetwork } from "../src/lib/story/delivery-network";
import {
  calculateProfit,
  defaultProfitScenario,
} from "../src/lib/story/profit-analysis";

function fixture() {
  const allocation = calculateStoreAllocation(defaultAllocationScenario());
  const delivery = calculateStoreDelivery(
    allocation,
    defaultDeliveryScenario(allocation),
  );
  return { allocation, delivery };
}
test("historical route metadata and quotations remain bound to the saved delivery snapshot", () => {
  const { allocation, delivery } = fixture();
  const before = deliveryNetwork(allocation, delivery, "dual");
  const id = before[0].id;
  const quote = sourceData.scenarioRoutes.find(
    (r) => r.id === id && r.scenario === "SC-DUAL",
  )!;
  const saved = { ...quote };
  try {
    quote.cost = 999999;
    quote.capacity = 999999;
    const after = deliveryNetwork(allocation, delivery, "dual");
    assert.equal(after[0].quote, before[0].quote);
    assert.equal(after[0].capacity, before[0].capacity);
  } finally {
    Object.assign(quote, saved);
  }
});
test("supplemental fees apply to routed quantities; unknown costs are never zero", () => {
  const known = costBreakdown(1000, 10, 6, completeCostRates);
  assert.equal(known.total, 1000 + 10 * (150 + 250 + 300) + 6 * (150 + 30 * 3));
  const missing = costBreakdown(1000, 10, 6, {
    ...completeCostRates,
    pdi: null,
  });
  assert.equal(missing.total, null);
  assert.ok(missing.missing.includes("整备 PDI"));
  assert.equal(
    costBreakdown(1000, 10, 0, {
      ...completeCostRates,
      vpcHandling: null,
      storageDaily: null,
      storageDays: null,
    }).total,
    8000,
  );
  assert.equal(
    costBreakdown(1000, 10, 6, {
      ...completeCostRates,
      storageDaily: 0,
      storageDays: null,
    }).storage,
    0,
  );
  assert.throws(
    () => costBreakdown(0, 1, 0, { ...completeCostRates, pdi: -1 }),
    /费用/,
  );
});
test("source logistics adds all declared fees and never prices unrouted vehicles as zero", () => {
  const { allocation, delivery } = fixture();
  const result = calculateStoreDelivery(allocation, {
    ...delivery.input,
    costRates: { ...completeCostRates },
  });
  assert.equal(result.dual.costs?.linehaul, delivery.dual.costs?.linehaul);
  assert.equal(result.dual.summary.cost, 1992316);
  assert.equal(result.single.summary.cost, null);
  assert.ok(result.single.costs?.missing.includes("未落实路线"));
  assert.ok(result.single.summary.knownCost > result.single.costs!.linehaul);
  assert.equal(delivery.dual.summary.cost, null);
});
test("map aggregates shared city routes exactly once and matches saved plan batches", () => {
  const { allocation, delivery } = fixture();
  const routes = deliveryNetwork(allocation, delivery, "dual");
  assert.equal(new Set(routes.map((r) => r.id)).size, routes.length);
  assert.equal(
    routes.reduce((s, r) => s + r.routed, 0),
    delivery.dual.summary.direct + delivery.dual.summary.viaVpc,
  );
  assert.equal(
    routes.reduce((s, r) => s + r.unrouted, 0),
    delivery.dual.summary.unrouted,
  );
  const totalCost = routes.reduce((s, r) => s + r.linehaul, 0);
  assert.ok(Math.abs(totalCost - delivery.dual.summary.knownCost) < 0.001);
  for (const r of routes) {
    assert.equal(
      r.routed,
      r.batches.reduce((s, b) => s + b.qty, 0),
    );
    assert.ok(r.routed <= r.capacity);
  }
});
test("order, model and store profits conserve money and use weighted margins", () => {
  const { allocation, delivery } = fixture();
  const input = defaultProfitScenario(allocation, delivery);
  const first = input.orders[0];
  input.orders = [
    {
      ...first,
      id: "SALE-A",
      qty: 2,
      unitPrice: 100000,
      discount: 1000,
      purchase: 80000,
      commissionPct: 2,
      other: 100,
    },
    {
      ...first,
      id: "SALE-B",
      qty: 1,
      unitPrice: 10000,
      discount: 0,
      purchase: 12000,
      commissionPct: 0,
      other: 0,
    },
  ];
  const result = calculateProfit(allocation, delivery, input);
  const unit = delivery[input.mode].rows.find(
    (r) => r.storeId === first.storeId,
  )!;
  const expectedLogistics =
    (costBreakdown(
      unit.knownCost,
      unit.directQty + unit.viaVpcQty,
      unit.viaVpcQty,
      input.costRates,
    ).total! /
      (unit.directQty + unit.viaVpcQty)) *
    3;
  assert.equal(result.summary.revenue, 208000);
  assert.equal(result.summary.purchase, 172000);
  assert.equal(result.summary.commission, 3960);
  assert.ok(
    Math.abs(
      result.summary.profit! -
        (208000 - 172000 - 3960 - 200 - expectedLogistics),
    ) < 0.001,
  );
  assert.equal(result.summary.negativeOrders, 1);
  for (const groups of [result.models, result.stores]) {
    assert.equal(
      groups.reduce((s, g) => s + g.revenue!, 0),
      result.summary.revenue,
    );
    assert.ok(
      Math.abs(
        groups.reduce((s, g) => s + g.profit!, 0) - result.summary.profit!,
      ) < 0.001,
    );
    assert.equal(groups[0].margin, groups[0].profit! / groups[0].revenue!);
  }
  const saved = JSON.stringify(delivery);
  input.orders[0].purchase = null;
  assert.equal(
    calculateProfit(allocation, delivery, input).summary.profit,
    null,
  );
  input.orders[0].purchase = 80000;
  input.costRates.pdi = null;
  assert.equal(
    calculateProfit(allocation, delivery, input).summary.profit,
    null,
  );
  assert.equal(JSON.stringify(delivery), saved);
});
test("profit validates store, brand, IDs and sales quantity instead of treating replenishment as sold", () => {
  const { allocation, delivery } = fixture();
  const input = defaultProfitScenario(allocation, delivery);
  assert.ok(
    input.orders.reduce((s, o) => s + o.qty, 0) < allocation.summary.assigned,
  );
  assert.throws(
    () =>
      calculateProfit(allocation, delivery, {
        ...input,
        orders: [input.orders[0], input.orders[0]],
      }),
    /重复/,
  );
  assert.throws(
    () =>
      calculateProfit(allocation, delivery, {
        ...input,
        orders: [{ ...input.orders[0], storeId: "unknown" }],
      }),
    /门店/,
  );
  assert.throws(
    () =>
      calculateProfit(allocation, delivery, {
        ...input,
        orders: [{ ...input.orders[0], qty: 100000 }],
      }),
    /分车/,
  );
  assert.throws(
    () =>
      calculateProfit(allocation, delivery, {
        ...input,
        orders: [{ ...input.orders[0], brand: "雷克萨斯" }],
      }),
    /品牌/,
  );
  assert.throws(
    () =>
      calculateProfit(allocation, delivery, {
        ...input,
        orders: [{ ...input.orders[0], qty: 1.5 }],
      }),
    /数量/,
  );
});
