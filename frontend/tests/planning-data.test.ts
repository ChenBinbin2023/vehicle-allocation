import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultAllocationScenario,
  calculateStoreAllocation,
} from "../src/lib/story/store-planning";

test("product planning reads all Toyota stores and source sales/inventory instead of four invented stores", () => {
  const input = defaultAllocationScenario();
  assert.equal(input.stores.length, 79);
  assert.equal(input.stores.filter((r) => r.channel === "直营").length, 34);
  assert.equal(input.stores.filter((r) => r.channel === "授权").length, 45);
  const first = input.stores.find((r) => r.id === "MOCK-D-001")!;
  assert.equal(first.weeklySales, 68.5);
  assert.equal(first.availableStock, 55);
  assert.equal(first.orders, 0);
  assert.equal(first.transit, 48);
  assert.equal(input.targetDirect, 3);
  assert.equal(input.targetAuthorized, 4);
  assert.equal(input.source?.stockDate, "2026-09-29");
});
test("brands remain separate and unconfirmed transit is excluded until explicitly assumed on-time", () => {
  const lexus = defaultAllocationScenario("雷克萨斯");
  assert.equal(lexus.stores.length, 20);
  assert.ok(lexus.stores.every((r) => r.brand === "雷克萨斯"));
  const input = defaultAllocationScenario();
  assert.equal(calculateStoreAllocation(input).rows[0].effectiveStock, 55);
  input.includeTransit = true;
  assert.equal(calculateStoreAllocation(input).rows[0].effectiveStock, 103);
});
test("channel offsets delay authorized filling and a partial supply recomputes the actual waterline", () => {
  const input = defaultAllocationScenario();
  input.stores = [
    {
      ...input.stores[0],
      id: "D1",
      channel: "直营",
      weeklySales: 100,
      availableStock: 0,
      orders: 0,
    },
    {
      ...input.stores[0],
      id: "A1",
      channel: "授权",
      weeklySales: 100,
      availableStock: 0,
      orders: 0,
    },
  ];
  input.targetDirect = 4;
  input.targetAuthorized = 4;
  input.offsetAuthorized = 0.3;
  input.supply = 100;
  const first = calculateStoreAllocation(input);
  assert.deepEqual(
    first.rows.map((r) => r.replenishment),
    [100, 0],
  );
  input.supply = 200;
  assert.deepEqual(
    calculateStoreAllocation(input).rows.map((r) => r.replenishment),
    [160, 40],
  );
  assert.equal(first.summary.assigned, 100);
});

test("all progressive water budgets preserve orders, integer stock limits and total quantity", () => {
  const input = defaultAllocationScenario();
  input.stores[0].orders = 100;
  input.offsetAuthorized = 0.3;
  for (let water = 0; water <= 1700; water += 17) {
    const result = calculateStoreAllocation({ ...input, supply: 100 + water });
    assert.equal(result.summary.orders, 100);
    assert.equal(
      result.summary.assigned + result.summary.retained,
      100 + water,
    );
    assert.ok(
      result.rows.every(
        (r) => Number.isInteger(r.replenishment) && r.replenishment >= 0,
      ),
    );
    assert.ok(
      result.rows.every(
        (r) =>
          r.replenishment <=
          Math.max(
            0,
            Math.ceil(r.weeklySales * r.targetWeeks) - r.effectiveStock,
          ),
      ),
    );
  }
});

test("progressive injection never takes a car back from an earlier store allocation", () => {
  for (const [brand, before, after] of [
    ["丰田", 420, 421],
    ["雷克萨斯", 32, 33],
  ] as const) {
    const input = defaultAllocationScenario(brand);
    const first = calculateStoreAllocation({ ...input, supply: before });
    const next = calculateStoreAllocation({ ...input, supply: after });
    assert.ok(
      first.rows.every((r, i) => next.rows[i].replenishment >= r.replenishment),
      brand + " reduced a store while adding supply",
    );
  }
});
