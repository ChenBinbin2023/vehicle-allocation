import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignState } from "../src/lib/story/seed";
import {
  resolveStorySkill,
  skillAvailability,
} from "../src/lib/story/skill-catalog";
import {
  advanceStoryRun,
  applyStoryRunResult,
  startStoryRun,
  visibleStoryBlocks,
} from "../src/lib/story/skill-runner";
import type { StoryCommand } from "../src/lib/story/types";

const command = "/shortage-fulfillment" as StoryCommand;
const prompt =
  "/skill，针对所有的缺货，基于选择的方案，生成调度建议，以及授权店采购订单";
function selectedState(kind: "cross-region" | "local-dealer" = "local-dealer") {
  const state = createCampaignState();
  const started = startStoryRun("/daily-dispatch", "", state);
  const source = advanceStoryRun(started, started.duration);
  source.dispatch!.selections = Object.fromEntries(
    source.dispatch!.shortages.map((s) => [
      s.vehicleId,
      s.options.find((o) => o.kind === kind)!.id,
    ]),
  );
  return applyStoryRunResult(state, source);
}

test("the requested follow-up prompt resolves to its own skill while daily dispatch keeps its existing alias", () => {
  assert.equal(resolveStorySkill(prompt)?.command, command);
  assert.equal(
    resolveStorySkill("/skill 帮我整理今天需要处理的订单，并生成调度计划")
      ?.command,
    "/daily-dispatch",
  );
});

test("unselected shortages default to the highest contribution profit even when that option arrives late", () => {
  assert.equal(
    startStoryRun(command, "", createCampaignState()).status,
    "blocked",
  );
  const state = selectedState();
  const data = state.runs[0].dispatch!;
  delete data.selections;
  const before = JSON.stringify(state);
  assert.equal(skillAvailability(command, state).available, true);
  const run = startStoryRun(command, "", state);
  assert.equal(run.status, "running");
  const result = run.dispatch!.fulfillment!;
  assert.equal(result.instructions.length, 6);
  assert.equal(result.instructions[0].profit, 20568);
  assert.equal(result.instructions[0].arrivalHours, 35);
  assert.equal(result.instructions[0].requiresReview, true);
  for (const instruction of result.instructions) {
    const shortage = data.shortages.find(
      (s) => s.vehicleId === instruction.vehicleId,
    )!;
    assert.ok(shortage.options.every((o) => instruction.profit >= o.profit));
    assert.equal(
      run.dispatch!.selections![instruction.vehicleId],
      instruction.optionId,
    );
    assert.equal(
      result.selections[instruction.vehicleId],
      instruction.optionId,
    );
  }
  assert.match(run.answer!, /默认.*贡献利润最高/);
  assert.equal(JSON.stringify(state), before);
});

test("manual selections are preserved while missing or invalid selections use the profit default", () => {
  const state = selectedState();
  const data = state.runs[0].dispatch!;
  const [first, second] = data.shortages;
  data.selections = {
    [first.vehicleId]: first.options.find((o) => o.kind === "local-dealer")!.id,
    [second.vehicleId]: "not-a-real-option",
  };
  const run = startStoryRun(command, "", state);
  assert.equal(run.status, "running");
  const instructions = run.dispatch!.fulfillment!.instructions;
  assert.equal(instructions.length, 6);
  assert.equal(instructions[0].kind, "local-dealer");
  assert.equal(instructions[0].profit, 2617);
  assert.equal(instructions[1].kind, "cross-region");
  assert.equal(instructions[1].profit, 20568);
});

test("selected local purchases produce six delivery instructions and five grouped supplier purchase drafts", () => {
  const state = selectedState();
  const before = JSON.stringify(state);
  const run = startStoryRun(command, "", state);
  assert.equal(run.status, "running");
  const result = run.dispatch!.fulfillment!;
  assert.equal(result.sourceRunId, state.runs[0].id);
  assert.equal(result.instructions.length, 6);
  assert.equal(result.purchaseOrders.length, 5);
  assert.equal(result.purchaseOrders[0].quantity, 2);
  assert.equal(
    result.purchaseOrders.reduce((n, po) => n + po.quantity, 0),
    6,
  );
  assert.equal(new Set(result.instructions.map((i) => i.vehicleId)).size, 6);
  for (const instruction of result.instructions) {
    const option = run
      .dispatch!.shortages.find((s) => s.vehicleId === instruction.vehicleId)!
      .options.find((o) => o.id === instruction.optionId)!;
    assert.equal(instruction.vin, option.vin);
    assert.equal(instruction.logistics, option.logistics);
    assert.equal(instruction.arrivalHours, option.arrivalHours);
    assert.ok(instruction.purchaseOrderId);
  }
  for (const po of result.purchaseOrders) {
    assert.equal(
      po.purchase,
      po.lines.reduce((n, line) => n + line.purchase, 0),
    );
    assert.equal(po.totalCost, po.purchase + po.logistics + po.other);
  }
  assert.equal(JSON.stringify(state), before);
  const complete = advanceStoryRun(run, run.duration);
  const saved = applyStoryRunResult(state, complete);
  assert.equal(saved.version, state.version);
  assert.deepEqual(saved.dailyOperations, []);
  assert.deepEqual(saved.inventoryBaseline, state.inventoryBaseline);
});

test("cross-region selections generate dispatch only and never fabricate dealer purchase orders", () => {
  const run = startStoryRun(command, "", selectedState("cross-region"));
  assert.equal(run.dispatch!.fulfillment!.instructions.length, 6);
  assert.deepEqual(run.dispatch!.fulfillment!.purchaseOrders, []);
  assert.ok(
    run.dispatch!.fulfillment!.instructions.some((i) => i.requiresReview),
  );
  assert.equal(visibleStoryBlocks(run).length, 4);
  const complete = advanceStoryRun(run, run.duration);
  assert.equal(visibleStoryBlocks(complete).length, 5);
  assert.equal(complete.blocks.at(-1)!.type, "dispatch-fulfillment");
});

test("an explicit historical source stays bound and duplicate candidate vehicles cannot enter generated documents", () => {
  const state = selectedState();
  const original = state.runs[0];
  const later = advanceStoryRun(
    startStoryRun("/daily-dispatch", "", state),
    20000,
  );
  const withLater = applyStoryRunResult(state, later);
  assert.equal(skillAvailability(command, withLater).available, true);
  assert.equal(
    skillAvailability(command, withLater, original.id).available,
    true,
  );
  const bound = startStoryRun(command, "", withLater, {
    dispatchRunId: original.id,
  });
  assert.equal(bound.dispatch!.fulfillment!.sourceRunId, original.id);
  const [first, second] = original.dispatch!.shortages;
  second.options.find((o) => o.kind === "local-dealer")!.vin =
    first.options.find((o) => o.kind === "local-dealer")!.vin;
  const duplicate = startStoryRun(command, "", state);
  assert.equal(duplicate.status, "blocked");
  assert.match(duplicate.blockedReason!, /重复/);
});
