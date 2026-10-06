import assert from "node:assert/strict";
import test from "node:test";
import { fourStoreAllocation as defaultAllocationScenario } from "./planning-fixture";
import { createCampaignState } from "../src/lib/story/seed";
import {
  startStoryRun,
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";
import { defaultDeliveryScenario } from "../src/lib/story/store-planning";

test("allocation starts directly in CUI and saves a computed simulation without publishing", () => {
  const base = createCampaignState();
  const run = startStoryRun("/vessel-allocation", "供给=1500", base);
  assert.equal(run.status, "running");
  assert.equal(run.planning?.kind, "allocation");
  if (run.planning?.kind !== "allocation") return;
  assert.equal(run.planning.result.summary.replenishment, 1500);
  const saved = applyStoryRunResult(
    { ...base, runs: [run] },
    advanceStoryRun(run, run.duration),
  );
  assert.equal(saved.version, base.version);
  assert.equal(saved.allocation, null);
  assert.match(saved.runs[0].answer ?? "", /1,500/);
  assert.match(saved.runs[0].answer ?? "", /1,212/);
});
test("delivery uses the specified allocation snapshot and GUI override, rather than canned totals", () => {
  const base = createCampaignState();
  const first = startStoryRun("/vessel-allocation", "", base, {
    input: defaultAllocationScenario(),
  });
  let state = applyStoryRunResult(base, advanceStoryRun(first, first.duration));
  const input = defaultAllocationScenario();
  input.supply = 1500;
  const second = startStoryRun("/vessel-allocation", "", state, { input });
  state = applyStoryRunResult(state, advanceStoryRun(second, second.duration));
  const shipping = defaultDeliveryScenario();
  shipping.stores[1].directEligible = true;
  shipping.stores[1].firstCapacity = 100;
  const delivery = startStoryRun("/delivery-plan", "", state, {
    input: shipping,
    allocationRunId: first.id,
  });
  assert.equal(delivery.planning?.kind, "delivery");
  if (delivery.planning?.kind !== "delivery") return;
  assert.equal(delivery.planning.allocationRunId, first.id);
  assert.equal(delivery.planning.result.single.summary.total, 1800);
  assert.equal(delivery.planning.result.single.summary.cost, 870900);
  const saved = applyStoryRunResult(
    state,
    advanceStoryRun(delivery, delivery.duration),
  );
  assert.equal(saved.deliveryPlan, null);
  assert.equal(
    startStoryRun("/arrival-execution", "", saved).status,
    "blocked",
  );
  const latest = startStoryRun("/delivery-plan", "", state);
  assert.equal(latest.planning?.kind, "delivery");
  if (latest.planning?.kind === "delivery")
    assert.equal(latest.planning.result.single.summary.total, 1500);
});
test("invalid GUI/CUI parameters return an actionable blocked result", () => {
  const state = createCampaignState();
  assert.equal(startStoryRun("/delivery-plan", "", state).status, "blocked");
  const invalid = startStoryRun("/vessel-allocation", "供给=-1", state);
  assert.equal(invalid.status, "blocked");
  assert.match(invalid.blockedReason ?? "", /供给/);
});
test("natural supply prompts and follow-up port comparisons retain the planning context", () => {
  const base = createCampaignState();
  const first = startStoryRun(
    "/vessel-allocation",
    "供给 1,500 台，先满足订单",
    base,
  );
  assert.equal(first.planning?.kind, "allocation");
  if (first.planning?.kind === "allocation")
    assert.equal(first.planning.result.summary.assigned, 1500);
  const baseline = startStoryRun("/vessel-allocation", "供给=1800", base, {
    input: defaultAllocationScenario(),
  });
  let state = applyStoryRunResult(
    base,
    advanceStoryRun(baseline, baseline.duration),
  );
  const delivery = startStoryRun("/delivery-plan", "单港 D2接车=100", state);
  state = applyStoryRunResult(
    state,
    advanceStoryRun(delivery, delivery.duration),
  );
  const compare = startStoryRun(
    "/delivery-plan",
    "双港对比，保留接车设置",
    state,
  );
  assert.equal(compare.planning?.kind, "delivery");
  if (compare.planning?.kind === "delivery") {
    assert.equal(compare.planning.result.input.mode, "dual");
    assert.equal(compare.planning.result.dual.rows[1].directQty, 100);
  }
});

test("source CUI accepts authorized L2 store IDs and rejects invalid explicit order quantities", () => {
  const base = createCampaignState();
  const run = startStoryRun(
    "/vessel-allocation",
    "雷克萨斯 MOCK-L2-038订单=10",
    base,
  );
  assert.equal(run.planning?.kind, "allocation");
  if (run.planning?.kind === "allocation")
    assert.equal(run.planning.result.summary.orders, 10);
  assert.equal(
    startStoryRun("/vessel-allocation", "MOCK-L2-038订单=-10", base).status,
    "blocked",
  );
});

test("CUI grouped order quantities stay intact and invalid comma groups are rejected", () => {
  const base = createCampaignState();
  const run = startStoryRun(
    "/vessel-allocation",
    "丰田 MOCK-D-001订单=1,000",
    base,
  );
  assert.equal(run.planning?.kind, "allocation");
  if (run.planning?.kind === "allocation")
    assert.equal(run.planning.result.summary.orders, 1000);
  assert.equal(
    startStoryRun("/vessel-allocation", "MOCK-D-001订单=1,00", base).status,
    "blocked",
  );
});
