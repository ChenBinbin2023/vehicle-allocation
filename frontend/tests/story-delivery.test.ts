import assert from "node:assert/strict";
import test from "node:test";

import { allocateVessel } from "../src/lib/story/allocation-engine";
import {
  markAllocationFromDelivery,
  planDelivery,
  validateDelivery,
} from "../src/lib/story/delivery-engine";
import { createCampaignState } from "../src/lib/story/seed";
import type { RouteId } from "../src/lib/story/types";

function readyCampaign() {
  const state = createCampaignState();
  return { ...state, allocation: allocateVessel(state) };
}

function routeCounts(assignments: Array<{ route: RouteId }>) {
  return assignments.reduce<Record<RouteId, number>>(
    (counts, assignment) => {
      counts[assignment.route] += 1;
      return counts;
    },
    {
      west: 0,
      riyadh: 0,
      eastDirect: 0,
      riyadhIntercept: 0,
      dammamSafety: 0,
    },
  );
}

test("builds five single-port routes without losing a VIN", () => {
  const plan = planDelivery(readyCampaign());

  assert.deepEqual(routeCounts(plan.assignments), {
    west: 520,
    riyadh: 650,
    eastDirect: 360,
    riyadhIntercept: 170,
    dammamSafety: 100,
  });
  assert.equal(plan.assignments.length, 1800);
  assert.equal(new Set(plan.assignments.map((item) => item.vehicleId)).size, 1800);
  assert.equal(plan.status, "ready");
  assert.equal(validateDelivery(plan).length, 0);
  assert.ok(plan.batches.every((batch) => batch.vehicleIds.length <= 8));
});

test("sends east orders direct and transition demand through Riyadh", () => {
  const state = readyCampaign();
  const plan = planDelivery(state);
  const allocationByVin = new Map(
    state.allocation!.assignments.map((item) => [item.vehicleId, item]),
  );

  const eastOrders = plan.assignments.filter((item) =>
    allocationByVin.get(item.vehicleId)?.destination.startsWith("东部"),
  );
  const transition = plan.assignments.filter((item) =>
    allocationByVin.get(item.vehicleId)?.destination.startsWith("中东部"),
  );

  assert.equal(eastOrders.length, 360);
  assert.ok(eastOrders.every((item) => item.route === "eastDirect"));
  assert.equal(transition.length, 170);
  assert.ok(transition.every((item) => item.route === "riyadhIntercept"));
  assert.ok(
    plan.assignments
      .filter((item) => item.route === "eastDirect")
      .every((item) => item.handlingCount === 1),
  );
});

test("creates a capacity blocker and marks low-priority inventory for adjustment", () => {
  const state = readyCampaign();
  const plan = planDelivery(state, {
    routeCapacity: { riyadhIntercept: 100 },
  });
  const issue = plan.issues.find(
    (candidate) => candidate.id === "route-capacity-riyadhIntercept",
  );
  const allocationByVin = new Map(
    state.allocation!.assignments.map((item) => [item.vehicleId, item]),
  );

  assert.equal(plan.status, "blocked");
  assert.equal(issue?.severity, "blocking");
  assert.equal(issue?.vehicleIds?.length, 70);
  assert.ok(
    issue?.vehicleIds?.every(
      (vehicleId) => allocationByVin.get(vehicleId)?.pool === "inventory",
    ),
  );
  assert.equal(plan.assignments.length, 1800);
  assert.equal(markAllocationFromDelivery(state.allocation!, plan).status, "blocked");
});
