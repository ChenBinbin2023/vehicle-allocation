import assert from "node:assert/strict";
import test from "node:test";
import {
  translate,
  toBusinessPrompt,
  matchesLocalizedText,
} from "../src/lib/i18n/translate";
import { resolveStorySkill, storySkills } from "../src/lib/story/skill-catalog";
import {
  startStoryRun,
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";
import { createCampaignState } from "../src/lib/story/seed";
import { localizedSessionTitle } from "../src/lib/i18n/session-title";
import { freshSnapshot } from "../src/lib/sessions";
import { publishedCampaign } from "./legacy-campaign-fixture";

test("English translation preserves calculated values and identifiers", () => {
  assert.equal(
    translate("我们该处理什么工作?", "en"),
    "What should we work on?",
  );
  assert.equal(translate("区域缺货", "en"), "Regional shortages");
  assert.equal(translate("42 台", "en"), "42 vehicles");
  assert.equal(translate("42 台", "zh-CN"), "42 台");
  assert.equal(
    translate("data/05_利润/价格.xlsx", "en"),
    "data/05_利润/价格.xlsx",
  );
  assert.equal(translate("VIN-123 / 18,450 SAR", "en"), "VIN-123 / 18,450 SAR");
  const selection = { id: "order-1", quantity: 42 };
  assert.equal(translate(selection, "en"), selection);
});

test("every English default Skill prompt maps to the original business parameters", () => {
  for (const skill of storySkills) {
    const english = `${skill.command} ${translate(skill.defaultPrompt, "en")}`;
    assert.doesNotMatch(english, /[\u4e00-\u9fff]/, skill.command);
    assert.equal(
      toBusinessPrompt(english),
      `${skill.command} ${skill.defaultPrompt}`,
    );
    assert.equal(resolveStorySkill(english)?.command, skill.command);
  }
  assert.equal(
    resolveStorySkill(
      "/skill Generate purchase orders for all shortages using selected options",
    )?.command,
    "/shortage-fulfillment",
  );
});

test("English edited replenishment parameters reach the calculation", () => {
  const input = toBusinessPrompt(
    "/vessel-allocation Simulate replenishment; total=3000 reserve ratio=20% baseline WoS=5 channel gap=15%.",
  );
  const run = startStoryRun("/vessel-allocation", input, createCampaignState());
  assert.equal(run.planning?.kind, "allocation");
  if (run.planning?.kind !== "allocation")
    throw new Error("Missing allocation");
  assert.equal(run.planning.result.input.replenishment?.supply, 3000);
  assert.equal(run.planning.result.input.replenishment?.reserveRatio, 0.2);
  assert.equal(run.planning.result.input.replenishment?.baseWos, 5);
  assert.equal(run.planning.result.input.replenishment?.channelGap, 0.15);
});

test("search finds displayed English store names and preserves Chinese matching", () => {
  assert.equal(
    matchesLocalizedText("MOCK-JED-01 吉达 直营", "Jeddah Direct"),
    true,
  );
  assert.equal(matchesLocalizedText("MOCK-JED-01 吉达 直营", "吉达"), true);
  assert.equal(matchesLocalizedText("MOCK-JED-01 吉达 直营", "Dammam"), false);
});

test("rendered summary lines translate after CUI paragraph and bullet splitting", () => {
  const run = startStoryRun("/query", "", createCampaignState());
  const summary = run.events.at(-1)!.detail;
  for (const line of summary.split("\n").filter(Boolean)) {
    assert.doesNotMatch(
      translate(line.replace(/^•\s*/, ""), "en"),
      /[\u4e00-\u9fff]/,
    );
  }
  assert.doesNotMatch(translate("利雅得 01店", "en"), /[\u4e00-\u9fff]/);
  assert.equal(translate(" · 加权平均", "en").trim(), "· Weighted average");
});

test("English parameter names preserve model IDs and normalize profit model labels", () => {
  assert.equal(
    toBusinessPrompt("Lexus LX 600 零售系数=1.1"),
    "Lexus LX 600 零售系数=1.1",
  );
  assert.equal(
    toBusinessPrompt("/profit-analysis model=Hilux price=90000"),
    "/profit-analysis 车型=海拉克斯 单价=90000",
  );
});

test("default Skill narratives translate composed sentences and numeric summaries", () => {
  for (const command of [
    "/vessel-allocation",
    "/crisis-brief",
    "/query",
    "/order-allocation",
    "/daily-dispatch",
  ] as const) {
    const run = startStoryRun(command, "", createCampaignState());
    for (const event of run.events) {
      assert.doesNotMatch(
        translate(event.title, "en"),
        /[\u4e00-\u9fff]/,
        event.title,
      );
      assert.doesNotMatch(
        translate(event.detail, "en"),
        /[\u4e00-\u9fff]/,
        event.title,
      );
    }
  }
});

test("English profit overrides update the requested model in the saved calculation", () => {
  let state = createCampaignState();
  for (const command of ["/vessel-allocation", "/delivery-plan"] as const) {
    const run = startStoryRun(command, "", state);
    state = applyStoryRunResult(state, advanceStoryRun(run, run.duration));
  }
  const prompt = toBusinessPrompt(
    "/profit-analysis model=Hilux price=90000",
  ).replace(/^\/\S+\s+/, "");
  const profit = startStoryRun("/profit-analysis", prompt, state);
  assert.equal(profit.status, "running");
  const orders = profit.profit!.result.input.orders.filter(
    (order) => order.model === "海拉克斯",
  );
  assert.ok(orders.length > 0);
  assert.ok(orders.every((order) => order.unitPrice === 90000));
});

test("system session titles translate while user-supplied titles remain intact", () => {
  const session = {
    id: "test",
    folderId: "global",
    title: "每日调拨计划",
    snapshot: freshSnapshot(),
  };
  session.snapshot.messages = [
    { id: 1, role: "user", text: "/daily-dispatch" },
  ];
  assert.equal(localizedSessionTitle(session, "en"), "Daily dispatch plan");
  session.snapshot.messages[0].text = "/daily-dispatch 每日调拨计划";
  session.title = "我的调拨任务";
  assert.equal(localizedSessionTitle(session, "en"), "我的调拨任务");
});

test("truncated generated task titles translate from the full original prompt", () => {
  for (const skill of storySkills) {
    const snapshot = freshSnapshot();
    snapshot.messages = [
      { id: 1, role: "user", text: `${skill.command} ${skill.defaultPrompt}` },
    ];
    const session = {
      id: "saved-task",
      folderId: "global",
      title: skill.defaultPrompt.slice(0, 26),
      snapshot,
    };
    assert.doesNotMatch(
      localizedSessionTitle(session, "en"),
      /[\u4e00-\u9fff]/,
      skill.command,
    );
    assert.equal(localizedSessionTitle(session, "zh-CN"), session.title);
    assert.equal(
      snapshot.messages[0].text,
      `${skill.command} ${skill.defaultPrompt}`,
    );
  }
});

test("a generated title with custom Chinese parameters uses the Skill's English title", () => {
  const prompt = "查看截至 2026-09-01 的本船供给、订单缺口和库存。";
  const snapshot = freshSnapshot();
  snapshot.messages = [{ id: 1, role: "user", text: `/query ${prompt}` }];
  assert.equal(
    localizedSessionTitle(
      { id: "query", folderId: "global", title: prompt.slice(0, 26), snapshot },
      "en",
    ),
    "Basic statistics",
  );
});

test("phrase translation cannot replace the last digit of a decimal or a larger quantity", () => {
  const text = translate(
    "Northern 286.1 台，Western 691 台，Central 1 台",
    "en",
  );
  assert.match(text, /286\.1 vehicles/);
  assert.match(text, /691 vehicles/);
  assert.match(text, /Central 1 vehicle/);
});

test("expanded arrival execution steps translate their generated batch counts", () => {
  const run = startStoryRun("/arrival-execution", "", publishedCampaign());
  for (const event of run.events) {
    assert.doesNotMatch(
      translate(event.detail, "en"),
      /[\u4e00-\u9fff]/,
      event.title,
    );
  }
});
