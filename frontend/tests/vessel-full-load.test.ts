import assert from "node:assert/strict";
import test from "node:test";
import { calculateCommercial } from "../src/lib/story/vessel-commercial";
import {
  calculateVesselReplenishment,
  defaultReplenishmentParameters,
} from "../src/lib/story/vessel-replenishment";
import {
  createVesselScenario,
  hydrateVesselScenario,
} from "../src/lib/story/vessel-scenario";
import { createCampaignState } from "../src/lib/story/seed";
import { startStoryRun } from "../src/lib/story/skill-runner";

function allocation(capacity = 8) {
  return calculateVesselReplenishment({
    ...defaultReplenishmentParameters(),
    truckCapacity: capacity,
  });
}

test("every underfilled replenishment trip waits for a full load at capacities 8, 9 and 10", () => {
  for (const capacity of [8, 9, 10]) {
    const source = allocation(capacity);
    const original = structuredClone(source);
    const result = calculateCommercial(source);
    const waiting = result.logistics.trips.filter((t) => t.quantity < capacity);
    assert.ok(waiting.length > 0);
    for (const trip of waiting) {
      assert.equal(trip.dispatchStatus, "awaiting-load", trip.id);
      assert.equal(trip.missingToFull, capacity - trip.quantity);
    }
    for (const trip of result.logistics.trips.filter(
      (t) => t.quantity === capacity,
    )) {
      assert.equal(
        trip.dispatchStatus,
        trip.stage === "last-mile" ? "awaiting-order" : "ready",
      );
      assert.equal(trip.missingToFull, 0);
    }
    assert.equal(
      result.logistics.trips
        .filter((t) => t.stage !== "last-mile")
        .reduce((n, t) => n + t.quantity, 0),
      source.summary.replenishment,
    );
    assert.equal(
      result.logistics.trips
        .filter((t) => t.stage === "last-mile")
        .reduce((n, t) => n + t.quantity, 0),
      source.summary.vpc,
    );
    assert.ok(
      Math.abs(
        result.logistics.trips.reduce((n, t) => n + t.cost, 0) -
          result.logistics.totalCost,
      ) < 0.01,
    );
    assert.deepEqual(source, original);
  }
});

test("one car pools with seven cars from another store on the same route", () => {
  const source = allocation();
  const first = source.stores[0];
  const peer = source.stores.find(
    (s) => s.id !== first.id && s.city === first.city,
  )!;
  assert.ok(peer);
  for (const store of source.stores) {
    store.replenishment =
      store.id === first.id ? 1 : store.id === peer.id ? 7 : 0;
    store.directQty = store.replenishment;
    store.vpcQty = 0;
    store.models.forEach((m, index) => {
      m.replenishment = index === 0 ? store.replenishment : 0;
    });
  }
  source.summary.replenishment = source.summary.direct = 8;
  source.summary.vpc = 0;
  const trips = calculateCommercial(source).logistics.trips;
  assert.equal(trips.length, 1);
  assert.equal(trips[0].quantity, 8);
  assert.equal(trips[0].dispatchStatus, "ready");
  assert.deepEqual(
    trips[0].parts.map((p) => [p.storeId, p.quantity]),
    [
      [first.id, 1],
      [peer.id, 7],
    ],
  );
});

test("a one-car last-mile batch remains allocated but cannot depart", () => {
  const result = calculateCommercial(allocation());
  const trip = result.logistics.trips.find(
    (t) => t.stage === "last-mile" && t.quantity === 1,
  );
  assert.ok(trip, "reproduce the one-car batch from the logistics view");
  assert.equal(trip.dispatchStatus, "awaiting-load");
  assert.equal(trip.missingToFull, 7);
  assert.equal(
    trip.parts.reduce((n, p) => n + p.quantity, 0),
    1,
  );
  assert.equal(trip.trigger, "订单触发");
});

test("saved snapshots from before full-load enforcement refresh dispatch states without adding versions", () => {
  const run = startStoryRun(
    "/vessel-allocation",
    "补库存 总量=2500",
    createCampaignState(),
  );
  run.planning = createVesselScenario(allocation());
  const commercial = run.planning.commercial!;
  commercial.calculationVersion = "CAPACITY_BUDGET_V1";
  for (const trip of commercial.logistics.trips) {
    delete (trip as unknown as Record<string, unknown>).dispatchStatus;
    delete (trip as unknown as Record<string, unknown>).missingToFull;
  }
  const versions = structuredClone(run.planning.versions);
  const next = hydrateVesselScenario(run);
  assert.equal(next.planning?.kind, "allocation");
  if (next.planning?.kind !== "allocation") assert.fail("Missing allocation");
  assert.ok(
    next.planning
      .commercial!.logistics.trips.filter((t) => t.quantity < t.capacity)
      .every((t) => t.dispatchStatus === "awaiting-load"),
  );
  assert.deepEqual(next.planning.versions, versions);
  assert.equal(next.planning.versionId, "V1");
  assert.equal(hydrateVesselScenario(next), next);
  assert.equal(commercial.logistics.trips[0].dispatchStatus, undefined);
});
