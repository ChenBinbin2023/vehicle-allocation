import assert from "node:assert/strict";
import test from "node:test";
import { vesselOverview } from "../src/lib/story/vessel-overview";
import { vesselOrders } from "../src/lib/story/vessel-orders";
import { createCampaignState } from "../src/lib/story/seed";
import { startStoryRun } from "../src/lib/story/skill-runner";
import {
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";
import { defaultDeliveryScenario } from "../src/lib/story/store-planning";

async function engine() {
  try {
    return await import("../src/lib/story/vessel-replenishment");
  } catch (error) {
    if (
      ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      assert.fail(
        "Order-first replenishment with a reserved pool is not implemented",
      );
    throw error;
  }
}

test("the enlarged vessel is the same supply across overview, orders and reserved replenishment", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const result = calculateVesselReplenishment(defaultReplenishmentParameters());
  assert.equal(vesselOverview.summary.supply, 2500);
  assert.equal(result.summary.supply, 2500);
  assert.equal(result.summary.reserved, 250);
  assert.equal(result.summary.orders, vesselOrders.plans.dual.quantity);
  assert.equal(result.summary.orders, 1642);
  assert.equal(result.summary.budget, 608);
  assert.equal(result.stores.length, 79);
  assert.equal(
    result.summary.orders +
      result.summary.reserved +
      result.summary.replenishment +
      result.summary.retained,
    2500,
  );
  for (const model of result.models)
    assert.equal(
      model.orders + model.reserved + model.replenishment + model.retained,
      model.supply,
    );
});

test("increasing the reservation can reduce order fulfilment, and a fully reserved vessel does not allocate", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const params = defaultReplenishmentParameters();
  const result = calculateVesselReplenishment({ ...params, reserveRatio: 1 });
  assert.equal(result.summary.reserved, 2500);
  assert.equal(result.summary.orders, 0);
  assert.equal(result.summary.replenishment, 0);
  assert.equal(result.summary.orderShortage, 1694);
  const short = calculateVesselReplenishment({ ...params, supply: 0 });
  assert.equal(short.summary.supply, 0);
  assert.equal(short.summary.orders, 0);
});

test("store coefficients change effective velocity and targets without rewriting the source inventory", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const params = defaultReplenishmentParameters();
  params.directTargetFactor = 1.25;
  params.performanceTargetFactor = 1.2;
  params.storeFactors["MOCK-D-001"] = { salesFactor: 1.5, performance: true };
  const result = calculateVesselReplenishment(params);
  const store = result.stores.find((s) => s.id === "MOCK-D-001")!;
  assert.equal(store.weeklySales, 89);
  assert.equal(store.adjustedWeeklySales, 133.5);
  assert.equal(store.targetWeeks, 6);
  assert.equal(store.stock, vesselOverview.stores[0].stock);
  assert.equal(store.beforeSatisfaction, store.stock / 133.5 / 6);
  assert.equal(
    store.afterSatisfaction,
    (store.stock + store.replenishment) / 133.5 / 6,
  );
  assert.equal(store.directQty + store.vpcQty, store.replenishment);
});

test("each partial injection is a conserved prefix and never takes a car back from a store", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const params = defaultReplenishmentParameters();
  let previous = calculateVesselReplenishment(params, 0);
  assert.equal(previous.summary.replenishment, 0);
  for (const budget of [1, 8, 25, 79, 200, 400, 608]) {
    const next = calculateVesselReplenishment(params, budget);
    assert.equal(next.summary.injected, budget);
    assert.equal(
      next.summary.replenishment + next.summary.unallocatedInjection,
      budget,
    );
    assert.equal(
      next.summary.orders +
        next.summary.reserved +
        next.summary.replenishment +
        next.summary.retained,
      2500,
    );
    for (const store of next.stores) {
      const old = previous.stores.find((s) => s.id === store.id)!;
      assert.ok(store.replenishment >= old.replenishment, store.id);
      assert.ok(Number.isInteger(store.replenishment));
    }
    previous = next;
  }
});

test("model bundles consume real model pools and cannot assign a paired car without its hot-car quota", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const params = defaultReplenishmentParameters();
  const result = calculateVesselReplenishment(params);
  assert.ok(result.stores.some((s) => s.pairedQty > 0));
  for (const store of result.stores) {
    assert.ok(store.pairedQty <= Math.floor(store.hotQty / params.hotPerSlow));
    assert.equal(
      store.models.reduce((s, m) => s + m.replenishment, 0),
      store.replenishment,
    );
  }
  assert.ok(
    result.models.every(
      (m) => m.replenishment <= m.supply - m.reserved - m.orders,
    ),
  );
  const unpaired = calculateVesselReplenishment({
    ...params,
    pairingEnabled: false,
  });
  assert.ok(unpaired.stores.every((s) => s.pairedQty === 0));
});

test("invalid coefficients and ratios fail with actionable messages", async () => {
  const { defaultReplenishmentParameters, calculateVesselReplenishment } =
    await engine();
  const params = defaultReplenishmentParameters();
  for (const ratio of [-0.1, 1.01, NaN])
    assert.throws(
      () => calculateVesselReplenishment({ ...params, reserveRatio: ratio }),
      /预留/,
    );
  assert.throws(
    () => calculateVesselReplenishment({ ...params, baseWos: 0 }),
    /WoS/,
  );
  assert.throws(
    () =>
      calculateVesselReplenishment({
        ...params,
        storeFactors: { "MOCK-D-001": { salesFactor: 0, performance: false } },
      }),
    /销速/,
  );
});

test("CUI replenishment saves the same reserve and allocation snapshot used by the GUI", () => {
  const run = startStoryRun(
    "/vessel-allocation",
    "补库存 总量=2500 预留比例=20% 级差=30%",
    createCampaignState(),
  );
  assert.equal(run.planning?.kind, "allocation");
  if (run.planning?.kind !== "allocation") return;
  assert.equal(run.planning.replenishment?.summary.reserved, 500);
  assert.equal(run.planning.replenishment?.summary.budget, 358);
  assert.match(run.planningSummary ?? "", /预留 500/);
  assert.equal(
    run.events.find((e) => e.operation === "stock.waterfill")?.planningTab,
    "water",
  );
});

test("changed supply and reservation flow into the overview and order logistics consumers", async () => {
  const {
    defaultReplenishmentParameters,
    calculateVesselReplenishment,
    replenishmentOverview,
    replenishmentOrders,
  } = await engine();
  const result = calculateVesselReplenishment({
    ...defaultReplenishmentParameters(),
    supply: 2000,
  });
  const overview = replenishmentOverview(result),
    orders = replenishmentOrders(result);
  assert.equal(overview.summary.supply, 2000);
  assert.equal(overview.summary.orderShortage, 171);
  assert.equal(orders.plans.dual.quantity, 1523);
  assert.equal(orders.plans.single.quantity, 1523);
  assert.equal(
    overview.models.reduce((n, m) => n + m.supply, 0),
    2000,
  );
  const run = startStoryRun(
    "/vessel-allocation",
    "补庫 总量=2000",
    createCampaignState(),
  );
  assert.match(
    run.events.find((e) => e.operation === "vessel.overview.read")?.detail ??
      "",
    /2,000/,
  );
  assert.match(
    run.events.find((e) => e.operation === "vessel.orders.logistics")?.detail ??
      "",
    /1,523/,
  );
});

test("new replenishment snapshots carry August parking inventory into the next logistics simulation", async () => {
  const {
    defaultReplenishmentParameters,
    calculateVesselReplenishment,
    replenishmentAllocation,
  } = await engine();
  const allocation = replenishmentAllocation(
    calculateVesselReplenishment(defaultReplenishmentParameters()),
  );
  const input = defaultDeliveryScenario(allocation);
  const store = allocation.rows.find((s) => s.id === "MOCK-D-001")!;
  const receiving = input.stores.find((s) => s.id === store.id)!;
  assert.ok((store.parkingCapacity ?? 0) > 0);
  assert.equal(
    receiving.firstCapacity,
    Math.min(
      store.parkingCapacity! - store.effectiveStock,
      Math.ceil(store.weeklySales / 2),
    ),
  );
  assert.ok(input.stores.some((s) => s.firstCapacity > 0));
});

test("an explicit historical brand request cannot retain invisible replenishment parameters", () => {
  let state = createCampaignState();
  const initial = startStoryRun("/vessel-allocation", "基本统计", state);
  state = applyStoryRunResult(
    state,
    advanceStoryRun(initial, initial.duration),
  );
  const historical = startStoryRun(
    "/vessel-allocation",
    "丰田 供给=1800 直营WoS=3 授权WoS=4",
    state,
  );
  assert.equal(historical.planning?.kind, "allocation");
  if (historical.planning?.kind !== "allocation") return;
  assert.equal(historical.planning.result.input.replenishment, undefined);
  const rerun = startStoryRun("/vessel-allocation", "GUI 参数调整", state, {
    input: { ...historical.planning.result.input, supply: 100 },
  });
  if (rerun.planning?.kind !== "allocation")
    assert.fail("Historical rerun blocked");
  assert.equal(rerun.planning.result.input.supply, 100);
  assert.equal(rerun.planning.result.summary.replenishment, 100);
});

test("CUI store coefficients accept the readable space between store ID and coefficient", () => {
  const run = startStoryRun(
    "/vessel-allocation",
    "MOCK-D-001 销速系数=2",
    createCampaignState(),
  );
  if (run.planning?.kind !== "allocation")
    assert.fail("Coefficient scenario blocked");
  const store = run.planning.replenishment?.stores.find(
    (s) => s.id === "MOCK-D-001",
  );
  assert.equal(store?.adjustedWeeklySales, 178);
});
