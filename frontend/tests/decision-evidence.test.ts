import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignState } from "../src/lib/story/seed";
import { allocateVessel } from "../src/lib/story/allocation-engine";
import { dailyCampaign, publishedCampaign } from "./legacy-campaign-fixture";
import {
  buildDecisionEvidence,
  simulateAllocation,
  simulateCapacity,
  evaluateOrderSources,
} from "../src/lib/story/decision-evidence";
import {
  startStoryRun,
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";

test("skills link streamed events to evidence steps or saved planning inputs", () => {
  let state = createCampaignState();
  for (const command of [
    "/crisis-brief",
    "/vessel-allocation",
    "/delivery-plan",
    "/arrival-execution",
    "/daily-rebalance",
  ] as const) {
    const run = startStoryRun(command, "", state);
    if (command === "/arrival-execution") state = publishedCampaign();
    if (command === "/daily-rebalance") state = dailyCampaign();
    const current =
      command === "/arrival-execution" || command === "/daily-rebalance"
        ? startStoryRun(command, "", state)
        : run;
    assert.ok(current.planning || current.evidence);
    if (current.evidence)
      assert.equal(current.events.length, current.evidence.steps.length);
    assert.ok(
      current.events.every((event) => event.operation && event.sources?.length),
    );
    state = applyStoryRunResult(
      state,
      advanceStoryRun(current, current.duration),
    );
  }
});

test("a store logistics simulation cannot publish or start arrival execution", () => {
  let state = createCampaignState();
  state.planningParameters.dammamSafetyStock = 120;
  for (const command of [
    "/crisis-brief",
    "/vessel-allocation",
    "/delivery-plan",
  ] as const) {
    const run = startStoryRun(command, "", state);
    state = applyStoryRunResult(state, advanceStoryRun(run, run.duration));
  }
  assert.equal(state.deliveryPlan, null);
  assert.equal(
    startStoryRun("/arrival-execution", "", state).status,
    "blocked",
  );
});

test("allocation evidence explains the real protected pool, replenishment gap and VIN assignment", () => {
  const state = createCampaignState();
  const evidence = buildDecisionEvidence("/vessel-allocation", state, "T-10");
  assert.equal(evidence.kind, "allocation");
  assert.ok(evidence.steps.some((step) => step.output.includes("620")));
  const rows = evidence.replenishment!;
  assert.equal(
    rows.reduce((sum, row) => sum + row.gap, 0),
    780,
  );
  assert.ok(
    rows.every(
      (row) =>
        row.gap ===
        Math.max(0, row.target - row.available - row.inbound + row.orders),
    ),
  );
  assert.ok(evidence.steps.every((step) => step.rule && step.sources.length));
  const before = JSON.stringify(state);
  const simulation = simulateAllocation(state, 120);
  assert.equal(simulation.vpcs.DMM, 120);
  assert.equal(simulation.vpcs.RUH, 660);
  assert.equal(simulation.protected, 620);
  assert.equal(JSON.stringify(state), before);
});

test("logistics capacity simulation exposes affected VINs while preserving reserved orders", () => {
  const state = createCampaignState();
  state.allocation = allocateVessel(state);
  const simulation = simulateCapacity(state, 570);
  assert.equal(simulation.affected.length, 80);
  assert.equal(simulation.protectedAffected, 0);
  assert.equal(simulation.plan.status, "blocked");
  assert.equal(simulateCapacity(state, 650).affected.length, 0);
});

test("daily source explanations expose economic comparison and reject unconfirmed ownership", () => {
  const state = dailyCampaign();
  const evidence = buildDecisionEvidence("/daily-rebalance", state, "T+4");
  const plan = evidence.dailyPlan!;
  const premium = plan.orders.find((order) => order.type === "premium")!;
  const candidates = evaluateOrderSources(plan, premium.id);
  assert.equal(
    candidates.find((item) => item.sourceType === "store")!.netContribution,
    45_200,
  );
  const dealer = candidates.find((item) => item.sourceType === "dealer")!;
  assert.equal(dealer.eligible, false);
  assert.match(dealer.exclusionReason, /权属/);
});
