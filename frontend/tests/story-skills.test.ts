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
  markStoryRunStale,
  startStoryRun,
  visibleStoryBlocks,
  visibleStoryEvents,
} from "../src/lib/story/skill-runner";
import type { CampaignState } from "../src/lib/story/types";

test("five story skills resolve without mutating campaign state", () => {
  const state = createCampaignState();
  const before = JSON.stringify(state);

  assert.deepEqual(
    storySkills.map((skill) => skill.command),
    [
      "/crisis-brief",
      "/vessel-allocation",
      "/delivery-plan",
      "/arrival-execution",
      "/daily-rebalance",
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
  assert.equal(skillAvailability("/vessel-allocation", base).available, false);

  const briefed = { ...base, crisis: analyzeCrisis(base) };
  assert.equal(skillAvailability("/vessel-allocation", briefed).available, true);
  assert.equal(skillAvailability("/delivery-plan", briefed).available, false);

  const allocated = { ...briefed, allocation: allocateVessel(briefed) };
  assert.equal(skillAvailability("/delivery-plan", allocated).available, true);
  assert.equal(skillAvailability("/arrival-execution", allocated).available, false);

  const planned = planDelivery(allocated);
  const published: CampaignState = {
    ...allocated,
    deliveryPlan: { ...planned, status: "published" },
  };
  assert.equal(skillAvailability("/arrival-execution", published).available, true);
  assert.equal(skillAvailability("/daily-rebalance", published).available, false);
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
  const run = startStoryRun(
    "/delivery-plan",
    "请生成运输计划",
    state,
  );

  assert.equal(run.status, "blocked");
  assert.match(run.blockedReason ?? "", /分车/);
  assert.equal(run.blocks.length, 0);
  assert.equal(JSON.stringify(state), before);
});

test("stale run marks previously rendered GUI blocks after input version changes", () => {
  const state = createCampaignState();
  const started = startStoryRun("/crisis-brief", "分析风险", state);
  const completed = advanceStoryRun(started, started.duration);
  const stale = markStoryRunStale(completed, (completed.resultVersion ?? 0) + 1);

  assert.equal(completed.status, "complete");
  assert.ok(stale.blocks.every((block) => block.status === "stale"));
});
