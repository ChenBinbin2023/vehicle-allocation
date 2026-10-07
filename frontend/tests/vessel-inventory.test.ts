import assert from "node:assert/strict";
import test from "node:test";
import { vesselOrders } from "../src/lib/story/vessel-orders";
import {
  calculateVesselReplenishment,
  defaultReplenishmentParameters,
  replenishmentOverview,
  replenishmentOrders,
} from "../src/lib/story/vessel-replenishment";
import { createCampaignState } from "../src/lib/story/seed";
import { startStoryRun } from "../src/lib/story/skill-runner";
import {
  hydrateVesselScenario,
  reviseVesselScenario,
} from "../src/lib/story/vessel-scenario";

test("opening store inventory covers 15–35% of the four-week target in both channels and agrees across all three tabs", () => {
  const result = calculateVesselReplenishment(defaultReplenishmentParameters());
  const overview = replenishmentOverview(result),
    orders = replenishmentOrders(result);
  for (const channel of ["直营", "授权"] as const) {
    const stores = result.stores.filter((s) => s.channel === channel);
    const withinRange = stores.filter(
      (s) => s.beforeSatisfaction! >= 0.15 && s.beforeSatisfaction! <= 0.35,
    );
    assert.ok(
      withinRange.length >= Math.ceil(stores.length * 0.9),
      `${channel}: ${withinRange.length}/${stores.length} in range`,
    );
  }
  for (const store of result.stores) {
    assert.equal(
      store.stock,
      overview.stores.find((s) => s.id === store.id)!.stock,
    );
    assert.equal(
      store.stock,
      orders.stores.find((s) => s.id === store.id)!.stock,
    );
    assert.equal(
      store.stock,
      store.models.reduce((n, m) => n + m.stock, 0),
    );
  }
  for (const model of overview.models)
    for (const channel of ["直营", "授权"] as const) {
      assert.equal(
        model[channel === "直营" ? "directStock" : "authorizedStock"],
        result.stores
          .filter((s) => s.channel === channel)
          .reduce(
            (n, s) =>
              n + (s.models.find((m) => m.model === model.model)?.stock ?? 0),
            0,
          ),
        `${channel} ${model.model} inventory disagrees`,
      );
    }
  assert.ok(overview.summary.storeStock < 3000);
  assert.equal(
    overview.summary.storeStock,
    result.stores.reduce((n, s) => n + s.stock, 0),
  );
  assert.equal(overview.summary.vpcStock, 1060);
  assert.equal(overview.summary.orders, 1694);
  assert.equal(overview.summary.supply, 2500);
  assert.equal(
    overview.stores.find((s) => s.id === "MOCK-D-001")!.weeklySales,
    89,
  );
  assert.deepEqual(orders.orders, vesselOrders.orders);
});

test("saved scenarios rebase stale opening inventory once while keeping selected version and edited parameters", () => {
  const initial = startStoryRun(
    "/vessel-allocation",
    "补库存 总量=2500",
    createCampaignState(),
  );
  assert.equal(initial.planning?.kind, "allocation");
  if (initial.planning?.kind !== "allocation") return;
  const parameters = structuredClone(
    initial.planning.replenishment!.parameters,
  );
  parameters.channelGap = 0.05;
  const old = reviseVesselScenario(initial, parameters, "渠道调整");
  if (old.planning?.kind !== "allocation") return;
  const snapshot = old.planning;
  const versions = structuredClone(snapshot.versions);
  // A persisted snapshot produced before this opening-stock revision.
  snapshot.replenishment!.sourceVersion = "old-high-inventory";
  snapshot.replenishment!.stores.forEach((s) => {
    s.stock = Math.round(s.weeklySales * 3);
  });
  snapshot.result.rows.forEach((s) => {
    s.effectiveStock = Math.round(s.weeklySales * 3);
  });
  const next = hydrateVesselScenario(old);
  if (next.planning?.kind !== "allocation")
    assert.fail("Allocation snapshot lost");
  const fresh = next.planning.replenishment!;
  assert.ok(fresh.stores.every((s) => s.stock / s.weeklySales / 4 <= 0.35));
  assert.equal(next.id, old.id);
  assert.equal(next.planning.versionId, "V2");
  assert.deepEqual(next.planning.versions, versions);
  assert.deepEqual(fresh.parameters, parameters);
  assert.deepEqual(
    next.planning.result.rows.map((s) => s.effectiveStock),
    fresh.stores.map((s) => s.stock),
  );
  assert.equal(
    next.planning.commercial!.profit.summary.quantity,
    fresh.summary.replenishment,
  );
  assert.equal(
    hydrateVesselScenario(next),
    next,
    "An up-to-date snapshot must not rebase repeatedly",
  );
  assert.ok(
    old.planning.replenishment!.stores.some(
      (s) => s.stock / s.weeklySales / 4 > 0.35,
    ),
    "Hydration must not mutate the saved input",
  );
});
