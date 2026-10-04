import assert from "node:assert/strict";
import test from "node:test";

import { allocateVessel } from "../src/lib/story/allocation-engine";
import { planDelivery } from "../src/lib/story/delivery-engine";
import {
  applyExecutionEvent,
  closeArrivalExecution,
} from "../src/lib/story/execution-engine";
import {
  approveDailyDecision,
  rebalanceDailyOrders,
} from "../src/lib/story/rebalance-engine";
import { createCampaignState } from "../src/lib/story/seed";
import type { CampaignState } from "../src/lib/story/types";

function dailyCampaign(): CampaignState {
  const base = createCampaignState();
  const allocated = { ...base, allocation: allocateVessel(base) };
  let state: CampaignState = {
    ...allocated,
    deliveryPlan: planDelivery(allocated),
  };
  const ids = state.vessel.vehicles.map((vehicle) => vehicle.id);
  state = applyExecutionEvent(state, { id: "ARRIVE", type: "arrive", day: 0 });
  state = applyExecutionEvent(state, {
    id: "CLEAR",
    type: "clear",
    day: 0,
    vehicleIds: ids,
  });
  state = applyExecutionEvent(state, {
    id: "PDI",
    type: "pdi",
    day: 1,
    vehicleIds: ids,
  });
  for (const batch of state.deliveryPlan!.batches) {
    state = applyExecutionEvent(state, {
      id: `SHIP-${batch.id}`,
      type: "ship",
      day: batch.departDay,
      batchId: batch.id,
    });
    state = applyExecutionEvent(state, {
      id: `RECEIVE-${batch.id}`,
      type: "receive",
      day: batch.arrivalDay,
      batchId: batch.id,
    });
  }
  return { ...state, phase: "daily", inventoryBaseline: closeArrivalExecution(state) };
}

test("daily rebalance prioritizes local stock and combines enterprise sources", () => {
  const state = dailyCampaign();
  const plan = rebalanceDailyOrders(state, "T+4");
  const enterprise = plan.decisions.find(
    (decision) => decision.orderId === "DAY4-ENT-001",
  )!;
  const enterpriseSources = enterprise.recommendedCandidateIds.map((id) =>
    plan.candidates.find((candidate) => candidate.id === id)!,
  );
  const retail = plan.decisions.find(
    (decision) => decision.orderId === "DAY4-RET-001",
  )!;
  const retailSource = plan.candidates.find(
    (candidate) => candidate.id === retail.recommendedCandidateIds[0],
  )!;
  const remote = plan.decisions.find(
    (decision) => decision.orderId === "DAY4-REM-001",
  )!;

  assert.equal(plan.orders.length, 4);
  assert.equal(enterpriseSources[0].sourceType, "local_vpc");
  assert.equal(
    enterpriseSources.reduce((sum, source) => sum + source.vehicleIds.length, 0),
    80,
  );
  assert.equal(retailSource.sourceType, "local_vpc");
  assert.match(retailSource.location, /DMM/);
  assert.ok(retailSource.cost < plan.orders.find((item) => item.id === retail.orderId)!.margin);
  assert.match(remote.rationale, /拼单/);
});

test("source store safety is preserved for a high-margin low-interference transfer", () => {
  const plan = rebalanceDailyOrders(dailyCampaign(), "T+4");
  const premium = plan.decisions.find(
    (decision) => decision.orderId === "DAY4-LUX-001",
  )!;
  const source = plan.candidates.find(
    (candidate) => candidate.id === premium.recommendedCandidateIds[0],
  )!;

  assert.equal(source.sourceType, "store");
  assert.equal(source.vehicleIds.length, 1);
  assert.ok(source.sourceCoverAfter >= 3);
  assert.equal(source.executable, true);
  assert.equal(premium.status, "approval_required");
});

test("buyback ownership must be confirmed before an external vehicle is approved", () => {
  const state = dailyCampaign();
  const plan = rebalanceDailyOrders(state, "T+4");
  const dealer = plan.candidates.find(
    (candidate) => candidate.sourceType === "dealer",
  )!;
  const premium = plan.decisions.find(
    (decision) => decision.orderId === "DAY4-LUX-001",
  )!;
  const forcedDealerPlan = {
    ...plan,
    decisions: plan.decisions.map((decision) =>
      decision.id === premium.id
        ? { ...decision, recommendedCandidateIds: [dealer.id] }
        : decision,
    ),
  };
  const withPlan = { ...state, dailyOperations: [forcedDealerPlan] };
  const attempted = approveDailyDecision(withPlan, premium.id);

  assert.equal(dealer.ownershipConfirmed, false);
  assert.equal(dealer.executable, false);
  assert.match(dealer.reason, /权属/);
  assert.equal(
    attempted.dailyOperations[0].decisions.find(
      (decision) => decision.id === premium.id,
    )?.status,
    "approval_required",
  );
});

test("successive business days have unique decisions and cannot reuse locked VINs", () => {
  const state = dailyCampaign();
  const first = rebalanceDailyOrders(state, "T+4");
  const firstEnterprise = first.decisions.find((decision) =>
    first.orders.find((order) => order.id === decision.orderId)?.type === "enterprise",
  )!;
  const withFirst = { ...state, dailyOperations: [first] };
  const approved = approveDailyDecision(withFirst, firstEnterprise.id);
  const locked = new Set(
    approved.inventoryBaseline!.positions
      .filter((position) => position.status === "locked")
      .map((position) => position.vehicleId),
  );
  const second = rebalanceDailyOrders(approved, "T+5");
  const secondEnterprise = second.decisions.find((decision) =>
    second.orders.find((order) => order.id === decision.orderId)?.type === "enterprise",
  )!;
  const secondVehicleIds = secondEnterprise.recommendedCandidateIds.flatMap(
    (candidateId) =>
      second.candidates.find((candidate) => candidate.id === candidateId)?.vehicleIds ?? [],
  );

  assert.notEqual(first.id, second.id);
  assert.notEqual(firstEnterprise.id, secondEnterprise.id);
  assert.equal(
    first.orders.some((order) => second.orders.some((item) => item.id === order.id)),
    false,
  );
  assert.equal(secondVehicleIds.some((vehicleId) => locked.has(vehicleId)), false);
  assert.equal(
    approved.dailyOperations[0].decisions.find((decision) => decision.id === firstEnterprise.id)?.status,
    "approved",
  );
});

test("approval rejects incomplete recommended vehicle quantities", () => {
  const state = dailyCampaign();
  const plan = rebalanceDailyOrders(state, "T+4");
  const decision = plan.decisions.find((item) =>
    plan.orders.find((order) => order.id === item.orderId)?.type === "enterprise",
  )!;
  const candidateId = decision.recommendedCandidateIds[0];
  const incomplete = {
    ...plan,
    candidates: plan.candidates.map((candidate) =>
      candidate.id === candidateId
        ? { ...candidate, vehicleIds: candidate.vehicleIds.slice(0, 1) }
        : candidate,
    ),
  };
  const before = { ...state, dailyOperations: [incomplete] };
  const attempted = approveDailyDecision(before, decision.id);

  assert.equal(attempted, before);
});

test("store vehicles already released on a prior day cannot be approved again", () => {
  const state = dailyCampaign();
  const first = rebalanceDailyOrders(state, "T+4");
  const firstPremium = first.decisions.find((decision) =>
    first.orders.find((order) => order.id === decision.orderId)?.type === "premium",
  )!;
  const approved = approveDailyDecision(
    { ...state, dailyOperations: [first] },
    firstPremium.id,
  );
  const second = rebalanceDailyOrders(approved, "T+5");
  const secondPremium = second.decisions.find((decision) =>
    second.orders.find((order) => order.id === decision.orderId)?.type === "premium",
  )!;
  const store = second.candidates.find((candidate) =>
    secondPremium.recommendedCandidateIds.includes(candidate.id),
  )!;
  const withSecond = { ...approved, dailyOperations: [...approved.dailyOperations, second] };

  assert.equal(store.vehicleIds[0], "STORE-LX-0001");
  assert.equal(store.executable, false);
  assert.match(store.unmetConditions.join(" "), /占用/);
  assert.equal(approveDailyDecision(withSecond, secondPremium.id), withSecond);
});
