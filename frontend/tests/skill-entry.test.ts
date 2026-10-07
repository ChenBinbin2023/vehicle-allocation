import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspace, restoreWorkspace } from "../src/lib/sessions";
import { createCampaignState } from "../src/lib/story/seed";
import { resolveStorySkill, storySkills } from "../src/lib/story/skill-catalog";
import {
  advanceStoryRun,
  applyStoryRunResult,
  startStoryRun,
  visibleStoryBlocks,
  visibleStoryEvents,
} from "../src/lib/story/skill-runner";
import { skillAvailability } from "../src/lib/story/skill-catalog";

test("opening a workspace and restoring an empty workspace do not create sessions", () => {
  const workspace = createWorkspace();
  assert.equal(workspace.sessions.length, 0);
  assert.equal(workspace.activeId, "");
  assert.deepEqual(
    workspace.folders.map((folder) => folder.name),
    ["全局", "分车计划"],
  );
  assert.deepEqual(restoreWorkspace(JSON.stringify(workspace)), workspace);
});

test("the three vessel skills have independent commands and pages", () => {
  assert.equal(resolveStorySkill("/query 查看本船基本统计")?.title, "基本统计");
  assert.equal(
    resolveStorySkill("/order-allocation 查看订单分车")?.title,
    "订单分车",
  );
  assert.equal(
    resolveStorySkill("/vessel-allocation 补库存")?.title,
    "分车计划模拟",
  );
  assert.equal(
    storySkills.some((skill) => skill.command === "/smart-query"),
    false,
  );
});

test("basic statistics stream thought text and reveal GUI blocks progressively", () => {
  const skill = resolveStorySkill("/query");
  assert.ok(skill, "the basic statistics skill is registered");
  const run = startStoryRun(
    skill.command,
    skill.defaultPrompt,
    createCampaignState(),
  );
  assert.equal(run.status, "running");
  assert.equal(visibleStoryBlocks(run).length, 0);
  assert.ok(run.blocks.length >= 3);
  assert.equal(run.events[0].role, "analysis");
  const early = advanceStoryRun(run, 100);
  assert.ok(
    visibleStoryEvents(early)[0].detail.length < run.events[0].detail.length,
  );
  const middle = advanceStoryRun(run, run.blocks[0].revealAt + 1);
  assert.ok(visibleStoryBlocks(middle).length > 0);
  assert.ok(visibleStoryBlocks(middle).length < run.blocks.length);
  const complete = advanceStoryRun(run, run.duration);
  assert.equal(visibleStoryBlocks(complete).length, run.blocks.length);
  assert.ok(
    complete.blocks.every((block) => block.type.startsWith("statistics-")),
  );
});

test("order allocation has its own result stream instead of statistics or simulation tabs", () => {
  const skill = resolveStorySkill("/order-allocation");
  assert.ok(skill, "the order allocation skill is registered");
  const run = startStoryRun(
    skill.command,
    skill.defaultPrompt,
    createCampaignState(),
  );
  assert.equal(run.status, "running");
  assert.ok(run.blocks.length >= 3);
  assert.ok(run.blocks.every((block) => block.type.startsWith("orders-")));
  assert.ok(
    run.events.some((event) => event.operation === "vessel.orders.logistics"),
  );
  assert.equal(
    run.events.some((event) => event.operation === "stock.waterfill"),
    false,
  );
});

test("statistics and orders reuse the latest simulation quantities without unlocking delivery on their own", () => {
  const initial = createCampaignState();
  const simulation = startStoryRun(
    "/vessel-allocation",
    "补库 总量=2000",
    initial,
  );
  const state = applyStoryRunResult(
    initial,
    advanceStoryRun(simulation, simulation.duration),
  );
  for (const command of ["/query", "/order-allocation"] as const) {
    const skill = resolveStorySkill(command)!;
    const read = startStoryRun(command, skill.defaultPrompt, state);
    assert.equal(read.planning?.kind, "allocation");
    if (read.planning?.kind === "allocation")
      assert.equal(read.planning.replenishment?.summary.supply, 2000);
    const isolated = startStoryRun(command, skill.defaultPrompt, initial);
    const readState = applyStoryRunResult(
      initial,
      advanceStoryRun(isolated, isolated.duration),
    );
    assert.equal(
      skillAvailability("/delivery-plan", readState).available,
      false,
    );
  }
});
