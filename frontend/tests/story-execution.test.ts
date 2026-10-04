import assert from "node:assert/strict";
import test from "node:test";

import { allocateVessel } from "../src/lib/story/allocation-engine";
import { planDelivery } from "../src/lib/story/delivery-engine";
import {
  applyExecutionEvent,
  closeArrivalExecution,
  executionConservation,
} from "../src/lib/story/execution-engine";
import { createCampaignState } from "../src/lib/story/seed";
import type { CampaignState } from "../src/lib/story/types";

function readyCampaign(): CampaignState {
  const base = createCampaignState();
  const allocated = { ...base, allocation: allocateVessel(base) };
  return { ...allocated, deliveryPlan: planDelivery(allocated) };
}

function prepareAll(state: CampaignState) {
  const ids = state.vessel.vehicles.map((vehicle) => vehicle.id);
  let next = applyExecutionEvent(state, { id: "EV-ARRIVE", type: "arrive", day: 0 });
  next = applyExecutionEvent(next, {
    id: "EV-CLEAR-ALL",
    type: "clear",
    day: 0,
    vehicleIds: ids,
  });
  return applyExecutionEvent(next, {
    id: "EV-PDI-ALL",
    type: "pdi",
    day: 1,
    vehicleIds: ids,
  });
}

function receiveAll(state: CampaignState) {
  let next = prepareAll(state);
  for (const batch of next.deliveryPlan!.batches) {
    next = applyExecutionEvent(next, {
      id: `EV-SHIP-${batch.id}`,
      type: "ship",
      day: batch.departDay,
      batchId: batch.id,
    });
    next = applyExecutionEvent(next, {
      id: `EV-RECEIVE-${batch.id}`,
      type: "receive",
      day: batch.arrivalDay,
      batchId: batch.id,
    });
  }
  return next;
}

test("arrival execution moves vehicles through customs, PDI and receipt", () => {
  let state = readyCampaign();
  const batch = state.deliveryPlan!.batches[0];

  state = applyExecutionEvent(state, {
    id: "EV-ARRIVE",
    type: "arrive",
    day: 0,
  });
  assert.equal(state.arrivalExecution.vesselArrived, true);
  assert.equal(state.vessel.vehicles[0].status, "customs");

  state = applyExecutionEvent(state, {
    id: "EV-CLEAR",
    type: "clear",
    day: 0,
    vehicleIds: batch.vehicleIds,
  });
  state = applyExecutionEvent(state, {
    id: "EV-PDI",
    type: "pdi",
    day: 1,
    vehicleIds: batch.vehicleIds,
  });
  state = applyExecutionEvent(state, {
    id: "EV-SHIP",
    type: "ship",
    day: 1,
    batchId: batch.id,
  });
  state = applyExecutionEvent(state, {
    id: "EV-RECEIVE",
    type: "receive",
    day: 2,
    batchId: batch.id,
  });

  assert.ok(
    state.vessel.vehicles
      .filter((vehicle) => batch.vehicleIds.includes(vehicle.id))
      .every((vehicle) => vehicle.status === "delivered"),
  );
  assert.equal(
    state.deliveryPlan!.batches.find((item) => item.id === batch.id)?.status,
    "received",
  );
});

test("duplicate receipt events are idempotent", () => {
  let state = prepareAll(readyCampaign());
  const batch = state.deliveryPlan!.batches[0];
  state = applyExecutionEvent(state, {
    id: "EV-SHIP-ONE",
    type: "ship",
    day: 1,
    batchId: batch.id,
  });
  const event = {
    id: "EV-RECEIVE-ONE",
    type: "receive" as const,
    day: 2,
    batchId: batch.id,
  };
  state = applyExecutionEvent(state, event);
  const repeated = applyExecutionEvent(state, event);

  assert.equal(repeated, state);
  assert.equal(
    repeated.arrivalExecution.events.filter((item) => item.id === event.id).length,
    1,
  );
  assert.equal(executionConservation(repeated).terminal, batch.vehicleIds.length);
});

test("inventory baseline closes only after all 1800 vehicles reach a terminal state", () => {
  const initial = readyCampaign();
  assert.throws(() => closeArrivalExecution(initial), /1,800/);

  const completed = receiveAll(initial);
  const totals = executionConservation(completed);
  const baseline = closeArrivalExecution(completed);

  assert.equal(totals.total, 1800);
  assert.equal(totals.terminal, 1800);
  assert.equal(totals.delivered, 620);
  assert.equal(totals.atVpc, 1180);
  assert.equal(baseline.positions.length, 1800);
  assert.equal(baseline.deliveredOrderQuantity, 620);
  assert.equal(baseline.vpcQuantity, 1180);
});
