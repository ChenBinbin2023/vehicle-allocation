import assert from "node:assert/strict";
import test from "node:test";
import { summarizeOrderLogistics } from "../src/lib/story/vessel-order-costs";
import {
  vesselOrders,
  type OrderStore,
  type OrderTransportPlan,
  type OrderTrip,
  type VesselOrder,
} from "../src/lib/story/vessel-orders";

const stores: OrderStore[] = [
  { ...vesselOrders.stores[0], id: "A", name: "A店", region: "中部" },
  { ...vesselOrders.stores[0], id: "B", name: "B店", region: "中部" },
  { ...vesselOrders.stores[0], id: "C", name: "C店", region: "北部" },
];
const orders: VesselOrder[] = [
  {
    id: "A-T",
    storeId: "A",
    model: "Camry",
    brand: "丰田",
    channel: "直营",
    type: "零售订单",
    quantity: 2,
    allocated: 2,
  },
  {
    id: "A-L",
    storeId: "A",
    model: "ES",
    brand: "雷克萨斯",
    channel: "直营",
    type: "零售订单",
    quantity: 6,
    allocated: 6,
  },
  {
    id: "B-T",
    storeId: "B",
    model: "Camry",
    brand: "丰田",
    channel: "直营",
    type: "零售订单",
    quantity: 5,
    allocated: 4,
  },
];
function fixturePlan(
  mode: "single" | "dual",
  costs: number[],
): OrderTransportPlan {
  const trips: OrderTrip[] = [
    {
      id: `${mode}-1`,
      portId: "P-W",
      portName: "吉达港",
      quantity: 10,
      capacity: 10,
      linehaulCost: costs[0] + costs[1],
      handlingCost: 0,
      totalCost: costs[0] + costs[1],
      unitCost: (costs[0] + costs[1]) / 10,
      stops: [
        {
          storeId: "A",
          storeName: "A店",
          city: "利雅得",
          quantity: 8,
          cost: costs[0],
          orders: [
            { orderId: "A-T", model: "Camry", quantity: 2 },
            { orderId: "A-L", model: "ES", quantity: 6 },
          ],
        },
        {
          storeId: "B",
          storeName: "B店",
          city: "利雅得",
          quantity: 2,
          cost: costs[1],
          orders: [{ orderId: "B-T", model: "Camry", quantity: 2 }],
        },
      ],
    },
    {
      id: `${mode}-2`,
      portId: "P-W",
      portName: "吉达港",
      quantity: 2,
      capacity: 10,
      linehaulCost: costs[2],
      handlingCost: 0,
      totalCost: costs[2],
      unitCost: costs[2] / 2,
      stops: [
        {
          storeId: "B",
          storeName: "B店",
          city: "利雅得",
          quantity: 2,
          cost: costs[2],
          orders: [{ orderId: "B-T", model: "Camry", quantity: 2 }],
        },
      ],
    },
  ];
  return {
    mode,
    trips,
    quantity: 12,
    totalCost: costs.reduce((a, b) => a + b, 0),
  };
}
const plans = {
  single: fixturePlan("single", [80, 20, 60]),
  dual: fixturePlan("dual", [48, 12, 40]),
};

test("store costs collect all unloading shares and use shipped vehicles as the denominator", () => {
  const result = summarizeOrderLogistics(stores, orders, plans);
  const a = result.stores.find((s) => s.id === "A")!;
  const b = result.stores.find((s) => s.id === "B")!;
  assert.deepEqual(a.single, { quantity: 8, totalCost: 80, unitCost: 10 });
  assert.deepEqual(a.dual, { quantity: 8, totalCost: 48, unitCost: 6 });
  assert.deepEqual(b.single, { quantity: 4, totalCost: 80, unitCost: 20 });
  assert.deepEqual(b.dual, { quantity: 4, totalCost: 52, unitCost: 13 });
  assert.deepEqual(result.change, { amount: 60, percent: 60 });
});

test("regional unit costs are weighted by vehicles rather than averaged over stores", () => {
  const result = summarizeOrderLogistics(stores, orders, plans);
  const central = result.regions.find((r) => r.name === "中部")!;
  assert.deepEqual(central.single, {
    quantity: 12,
    totalCost: 160,
    unitCost: 160 / 12,
  });
  assert.deepEqual(central.dual, {
    quantity: 12,
    totalCost: 100,
    unitCost: 100 / 12,
  });
});

test("brand filtering attributes only that brand's share without charging its truck twice", () => {
  const result = summarizeOrderLogistics(
    stores,
    orders.filter((o) => o.brand === "丰田"),
    plans,
  );
  assert.deepEqual(result.single, {
    quantity: 6,
    totalCost: 100,
    unitCost: 100 / 6,
  });
  assert.deepEqual(result.dual, {
    quantity: 6,
    totalCost: 64,
    unitCost: 64 / 6,
  });
  assert.deepEqual(result.change, { amount: 36, percent: 56.25 });
  const selected = summarizeOrderLogistics([stores[0]], orders, plans);
  assert.equal(selected.single.totalCost, 80);
  assert.equal(selected.dual.totalCost, 48);
  assert.equal(selected.single.quantity, 8);
});

test("no transported orders produce empty costs and no misleading unit price or percent", () => {
  const result = summarizeOrderLogistics(stores, [], plans);
  assert.deepEqual(result.single, {
    quantity: 0,
    totalCost: 0,
    unitCost: null,
  });
  assert.deepEqual(result.dual, { quantity: 0, totalCost: 0, unitCost: null });
  assert.deepEqual(result.change, { amount: 0, percent: null });
  assert.ok(
    result.stores.every(
      (s) => s.single.unitCost === null && s.dual.unitCost === null,
    ),
  );
  assert.deepEqual(summarizeOrderLogistics([], [], plans).regions, []);
});

test("a zero dual-port baseline does not divide by zero", () => {
  const result = summarizeOrderLogistics(stores, orders, {
    ...plans,
    dual: fixturePlan("dual", [0, 0, 0]),
  });
  assert.equal(result.change.amount, 160);
  assert.equal(result.change.percent, null);
});

test("full-network summaries preserve both existing transport plans' quantities and costs", () => {
  const result = summarizeOrderLogistics(
    vesselOrders.stores,
    vesselOrders.orders,
    vesselOrders.plans,
  );
  assert.equal(result.single.quantity, 1642);
  assert.equal(result.dual.quantity, 1642);
  for (const mode of ["single", "dual"] as const) {
    assert.equal(result[mode].totalCost, vesselOrders.plans[mode].totalCost);
    assert.equal(
      result.regions.reduce((sum, row) => sum + row[mode].totalCost, 0),
      result[mode].totalCost,
    );
    assert.equal(
      result.stores.reduce((sum, row) => sum + row[mode].quantity, 0),
      1642,
    );
  }
});
