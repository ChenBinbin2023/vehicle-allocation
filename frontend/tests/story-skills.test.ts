import assert from "node:assert/strict";
import test from "node:test";

import { analyzeCrisis } from "../src/lib/story/crisis-engine";
import { allocateVessel } from "../src/lib/story/allocation-engine";
import { planDelivery } from "../src/lib/story/delivery-engine";
import { createCampaignState } from "../src/lib/story/seed";
import {
  resolveStorySkill,
  skillAvailability,
  storySkills,
} from "../src/lib/story/skill-catalog";
import {
  advanceStoryRun,
  applyStoryRunResult,
  markStoryRunStale,
  startStoryRun,
  visibleStoryBlocks,
  visibleStoryEvents,
} from "../src/lib/story/skill-runner";
import type { CampaignState } from "../src/lib/story/types";

test("story skills resolve without mutating campaign state", () => {
  const state = createCampaignState();
  const before = JSON.stringify(state);

  assert.deepEqual(
    storySkills.map((skill) => skill.command),
    [
      "/daily-dispatch",
      "/shortage-fulfillment",
      "/query",
      "/order-allocation",
      "/crisis-brief",
      "/vessel-allocation",
      "/delivery-plan",
      "/arrival-execution",
      "/daily-rebalance",
      "/daily-transfer",
      "/profit-analysis",
    ],
  );
  assert.equal(
    resolveStorySkill("/vessel-allocation 请保护企业订单")?.command,
    "/vessel-allocation",
  );
  assert.match(resolveStorySkill("/crisis-brief")!.defaultPrompt, /1,800/);
  assert.equal(JSON.stringify(state), before);
});

test("skill prerequisites unlock only after the prior business result", () => {
  const base = createCampaignState();
  assert.equal(skillAvailability("/crisis-brief", base).available, true);
  assert.equal(skillAvailability("/vessel-allocation", base).available, true);

  const briefed = { ...base, crisis: analyzeCrisis(base) };
  assert.equal(
    skillAvailability("/vessel-allocation", briefed).available,
    true,
  );
  assert.equal(skillAvailability("/delivery-plan", briefed).available, false);

  const run = startStoryRun("/vessel-allocation", "", briefed);
  const allocated = applyStoryRunResult(
    briefed,
    advanceStoryRun(run, run.duration),
  );
  assert.equal(skillAvailability("/delivery-plan", allocated).available, true);
  assert.equal(
    skillAvailability("/arrival-execution", allocated).available,
    false,
  );

  const legacy = { ...base, allocation: allocateVessel(base) };
  const planned = planDelivery(legacy);
  const published: CampaignState = {
    ...allocated,
    deliveryPlan: { ...planned, status: "published" },
  };
  assert.equal(
    skillAvailability("/arrival-execution", published).available,
    true,
  );
  assert.equal(
    skillAvailability("/daily-rebalance", published).available,
    false,
  );
  assert.equal(
    skillAvailability("/daily-transfer", published).available,
    false,
  );
});

function dailyState(): CampaignState {
  const base = createCampaignState();
  const allocated = { ...base, allocation: allocateVessel(base) };
  const published: CampaignState = {
    ...allocated,
    deliveryPlan: { ...planDelivery(allocated), status: "published" },
  };
  const run = startStoryRun("/arrival-execution", "", published);
  return applyStoryRunResult(published, advanceStoryRun(run, run.duration));
}

test("daily transfer shares the inventory baseline gate", () => {
  const base = createCampaignState();
  assert.equal(skillAvailability("/daily-transfer", base).available, false);
  const blocked = startStoryRun("/daily-transfer", "", base);
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.blockedReason ?? "", /库存基线/);

  const state = dailyState();
  assert.equal(skillAvailability("/daily-transfer", state).available, true);
});

test("daily transfer run streams six scenes on a bounded timeline", () => {
  const state = dailyState();
  const run = startStoryRun("/daily-transfer", "", state);

  assert.equal(run.command, "/daily-transfer");
  assert.equal(run.businessDate, "T+4");
  assert.equal(run.events.length, 12);
  assert.equal(run.events[0].role, "thinking");
  assert.equal(run.events.at(-1)!.role, "agent");
  assert.equal(
    run.duration,
    run.events.reduce((sum, event) => sum + event.duration, 0),
  );
  assert.deepEqual(
    run.blocks.map((block) => block.type),
    [
      "transfer-demand-pool",
      "transfer-enterprise-assembly",
      "transfer-dual-impact",
      "transfer-tradeoff",
      "transfer-execution-docs",
      "transfer-exception-replan",
      "transfer-value-summary",
    ],
  );
  assert.ok(
    run.blocks.every(
      (block) => block.revealAt > 0 && block.revealAt < run.duration,
    ),
  );
  assert.ok(
    run.blocks.every(
      (block, index) =>
        index === 0 || block.revealAt >= run.blocks[index - 1].revealAt,
    ),
  );
  assert.match(run.answer ?? "", /企业大单/);
  assert.equal(JSON.stringify(run.blocks).length > 0, true);

  const progressing = advanceStoryRun(run, 5_300);
  assert.ok(visibleStoryBlocks(progressing).length >= 2);
  const completed = advanceStoryRun(run, run.duration);
  assert.equal(completed.status, "complete");
  assert.ok(completed.blocks.every((block) => block.status === "ready"));

  const applied = applyStoryRunResult(state, completed);
  assert.equal(applied.dailyOperations.length, 1);
  assert.equal(applied.dailyOperations[0].businessDate, "T+4");
  assert.equal(
    applied.dailyOperations[0].decisions.some(
      (decision) => decision.status === "approval_required",
    ),
    true,
  );
});

test("synchronized blocks appear progressively with CUI run time", () => {
  const state = createCampaignState();
  const run = startStoryRun(
    "/crisis-brief",
    resolveStorySkill("/crisis-brief")!.defaultPrompt,
    state,
  );

  assert.equal(run.status, "running");
  assert.equal(visibleStoryBlocks(run).length, 0);

  const progressing = advanceStoryRun(run, 1_600);
  assert.ok(visibleStoryBlocks(progressing).length >= 1);
  assert.ok(visibleStoryBlocks(progressing).length < run.blocks.length);
  assert.ok(
    visibleStoryBlocks(progressing).every((block) => block.status !== "queued"),
  );

  const completed = advanceStoryRun(progressing, run.duration);
  assert.equal(completed.status, "complete");
  assert.equal(visibleStoryBlocks(completed).length, run.blocks.length);
  assert.ok(completed.blocks.every((block) => block.status === "ready"));
});

test("CUI event detail streams character by character before it completes", () => {
  const state = createCampaignState();
  const run = startStoryRun("/crisis-brief", "分析风险", state);
  const partial = advanceStoryRun(run, 240);
  const visible = visibleStoryEvents(partial);

  assert.equal(visible.length, 1);
  assert.ok(visible[0].detail.length > 0);
  assert.ok(visible[0].detail.length < run.events[0].detail.length);
  assert.equal(
    visibleStoryEvents(advanceStoryRun(run, 700))[0].detail,
    run.events[0].detail,
  );
});

test("blocked commands explain the missing prerequisite and preserve input", () => {
  const state = createCampaignState();
  const before = JSON.stringify(state);
  const run = startStoryRun("/delivery-plan", "请生成运输计划", state);

  assert.equal(run.status, "blocked");
  assert.match(run.blockedReason ?? "", /分车/);
  assert.equal(run.blocks.length, 0);
  assert.equal(JSON.stringify(state), before);
});

test("stale run marks previously rendered GUI blocks after input version changes", () => {
  const state = createCampaignState();
  const started = startStoryRun("/crisis-brief", "分析风险", state);
  const completed = advanceStoryRun(started, started.duration);
  const stale = markStoryRunStale(
    completed,
    (completed.resultVersion ?? 0) + 1,
  );

  assert.equal(completed.status, "complete");
  assert.ok(stale.blocks.every((block) => block.status === "stale"));
});
