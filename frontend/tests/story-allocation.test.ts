import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignState } from "../src/lib/story/seed";
import { analyzeCrisis } from "../src/lib/story/crisis-engine";
import {
  allocateVessel,
  validateAllocation,
} from "../src/lib/story/allocation-engine";

test("identifies Dammam closure and eastbound pressure", () => {
  const result = analyzeCrisis(createCampaignState());
  assert.equal(result.dammamPortAvailable, false);
  assert.equal(result.vesselQuantity, 1800);
  assert.equal(result.eastboundPressure, 630);
  assert.ok(result.risks.some((risk) => risk.id === "legacy-detour"));
  assert.ok(result.comparison.optimized.some((line) => line.includes("利雅得")));
});

test("allocates every VIN once while preserving the two pools", () => {
  const state = createCampaignState();
  const plan = allocateVessel(state);
  assert.equal(plan.assignments.length, 1800);
  assert.equal(
    new Set(plan.assignments.map((assignment) => assignment.vehicleId)).size,
    1800,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.pool === "reserved")
      .length,
    620,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.pool === "inventory")
      .length,
    1180,
  );
  assert.equal(plan.status, "ready");
});

test("preserves approved demand categories and VPC inventory destinations", () => {
  const state = createCampaignState();
  const plan = allocateVessel(state);
  for (const demand of state.demand) {
    assert.equal(
      plan.assignments.filter(
        (assignment) => assignment.demandId === demand.id,
      ).length,
      demand.quantity,
    );
  }
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "JED")
      .length,
    400,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "RUH")
      .length,
    680,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "DMM")
      .length,
    100,
  );
});

test("rebalances VPC replenishment when the Dammam safety parameter changes", () => {
  const state = createCampaignState();
  const plan = allocateVessel(state, { dammamSafetyStock: 120 });

  assert.equal(plan.assignments.length, 1800);
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "JED").length,
    400,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "RUH").length,
    660,
  );
  assert.equal(
    plan.assignments.filter((assignment) => assignment.targetVpc === "DMM").length,
    120,
  );
});

test("rejects duplicate VIN assignments", () => {
  const plan = allocateVessel(createCampaignState());
  plan.assignments[1] = {
    ...plan.assignments[1],
    vehicleId: plan.assignments[0].vehicleId,
  };
  const issues = validateAllocation(plan);
  assert.ok(
    issues.some(
      (issue) =>
        issue.severity === "blocking" && issue.id === "duplicate-vin",
    ),
  );
});
