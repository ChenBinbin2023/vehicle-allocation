import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveStorySkill,
  skillAvailability,
} from "../src/lib/story/skill-catalog";
import { createCampaignState } from "../src/lib/story/seed";
import {
  advanceStoryRun,
  applyStoryRunResult,
  startStoryRun,
  visibleStoryBlocks,
} from "../src/lib/story/skill-runner";
import { queryFiltersFromPrompt } from "../src/lib/story/query-run";

test("CUI understands Chinese year/month ranges and clamps complete requested ranges", () => {
  assert.deepEqual(
    [
      queryFiltersFromPrompt("查看 2025 年各区域销量").from,
      queryFiltersFromPrompt("查看 2025 年各区域销量").to,
    ],
    ["2025-01", "2025-12"],
  );
  const chinese = queryFiltersFromPrompt("查看东部 2026年1月至3月的丰田销量");
  assert.equal(chinese.from, "2026-01");
  assert.equal(chinese.to, "2026-03");
  assert.equal(chinese.region, "东部");
  assert.equal(chinese.brand, "丰田");
  const extended = queryFiltersFromPrompt("查看 2026-07 至 2027-01 的销量");
  assert.equal(extended.from, "2026-07");
  assert.equal(extended.to, "2026-10");
  const run = startStoryRun(
    "/smart-query",
    "查看 2026-07 至 2027-01 的销量",
    createCampaignState(),
  );
  assert.match(run.events[0].detail, /可用范围/);
});

test("CUI matches displayed store names and unions explicitly named VPCs", async () => {
  const { queryAnalytics } = await model();
  const store = queryFiltersFromPrompt("查看直营·利雅得·01店 2026-07 的销量");
  assert.equal(store.store, "MOCK-D-001");
  assert.equal(queryAnalytics(store).storeCount, 1);
  const union = queryFiltersFromPrompt("查看吉达 VPC 和达曼 VPC 的库存");
  assert.equal(union.vpc, "JED,DMM");
  assert.equal(queryAnalytics(union).stock.physical, 4508);
  assert.equal(queryAnalytics(union).storeCount, 52);
});

test("smart query runs independently and saves a read-only analytical canvas", () => {
  const skill = resolveStorySkill("/smart-query 查看各区域销量库存和运输成本");
  assert.ok(skill, "smart query should be registered in the CUI picker");
  const state = createCampaignState();
  assert.equal(skillAvailability(skill.command, state).available, true);
  const run = startStoryRun(skill.command, skill.defaultPrompt, state);
  assert.equal(run.status, "running");
  assert.deepEqual(
    run.events.slice(0, 4).map((event) => event.role),
    ["thinking", "plan", "tool", "thinking"],
  );
  assert.equal(visibleStoryBlocks(run).length, 0);
  const completed = advanceStoryRun(run, run.duration);
  assert.equal(completed.resultVersion, state.version);
  assert.equal(visibleStoryBlocks(completed).length, 3);
  assert.match(completed.answer ?? "", /6,709/);
  const saved = applyStoryRunResult(state, completed);
  assert.equal(saved.version, state.version);
  assert.deepEqual(saved.vessel, state.vessel);
  assert.deepEqual(saved.dailyOperations, state.dailyOperations);
  assert.equal(saved.runs.at(-1)?.id, run.id);
});

async function model() {
  assert.ok(
    resolveStorySkill("/smart-query"),
    "query model must be available with the skill",
  );
  return import("../src/lib/story/query-engine");
}

test("query keeps missing sales distinct from deterministic forecasts", async () => {
  const { queryAnalytics, defaultQueryFilters } = await model();
  const result = queryAnalytics(defaultQueryFilters);
  const july = result.monthly.find((row) => row.month === "2026-07")!;
  assert.equal(july.actual, 8901);
  assert.equal(july.direct, 6423);
  assert.equal(july.authorized, 2478);
  assert.equal(
    result.monthly.find((row) => row.month === "2026-08")?.actual,
    null,
  );
  assert.ok(
    result.monthly.find((row) => row.month === "2026-08")!.forecast! > 0,
  );
  assert.deepEqual(queryAnalytics(defaultQueryFilters), result);
});

test("monthly curves aggregate both channels for total, regions and service VPCs", async () => {
  const { queryAnalytics, defaultQueryFilters } = await model();
  const total = queryAnalytics({ ...defaultQueryFilters, dimension: "total" });
  assert.equal(total.rows.length, 1, "total view should merge all stores");
  assert.ok(
    Array.isArray(total.rows[0].monthly),
    "groups expose monthly curves",
  );
  assert.equal(
    total.rows[0].monthly.find((row) => row.month === "2026-07")?.actual,
    8901,
  );
  assert.equal(
    total.rows[0].monthly.find((row) => row.month === "2026-08")?.actual,
    null,
  );
  assert.ok(
    total.rows[0].monthly.find((row) => row.month === "2026-08")!.forecast! > 0,
  );
  const regions = queryAnalytics({
    ...defaultQueryFilters,
    dimension: "region",
  });
  assert.deepEqual(
    Object.fromEntries(
      regions.rows.map((row) => [
        row.id,
        row.monthly.find((month) => month.month === "2026-07")!.actual,
      ]),
    ),
    {
      西部: 3060,
      中部: 2554,
      东部: 1824,
      南部: 1007,
      北部: 456,
    },
  );
  const vpcs = queryAnalytics({ ...defaultQueryFilters, dimension: "vpc" });
  assert.deepEqual(
    Object.fromEntries(
      vpcs.rows.map((row) => [
        row.id,
        row.monthly.find((month) => month.month === "2026-07")!.actual,
      ]),
    ),
    { JED: 4067, RUH: 3010, DMM: 1824 },
  );
});

test("store trends rank within the selected period and channel scope", async () => {
  const { queryAnalytics, defaultQueryFilters } = await model();
  const stores = queryAnalytics({ ...defaultQueryFilters, dimension: "store" });
  assert.deepEqual(
    stores.rows.slice(0, 5).map((row) => row.id),
    ["MOCK-D-001", "MOCK-D-008", "MOCK-D-009", "MOCK-D-015", "MOCK-D-007"],
  );
  assert.ok(
    Array.isArray(stores.rows[0].monthly),
    "store curves should retain months",
  );
  assert.equal(
    stores.rows[0].monthly.find((row) => row.month === "2026-07")?.actual,
    365,
  );
  const east = queryAnalytics({
    ...defaultQueryFilters,
    region: "东部",
    dimension: "store",
  });
  assert.equal(east.rows[0].id, "MOCK-D-015");
  assert.ok(
    east.rows.every(
      (row) =>
        east.stores.find((store) => store.id === row.id)?.region === "东部",
    ),
  );
});

test("inventory composition and service-VPC grouping preserve source totals", async () => {
  const { queryAnalytics, defaultQueryFilters } = await model();
  const all = queryAnalytics(defaultQueryFilters);
  assert.equal(all.stock.physical, 6709);
  assert.equal(all.stock.transit, 1012);
  assert.equal(all.stock.free + all.stock.locked + all.stock.frozen, 6709);
  const vpcs = ["JED", "RUH", "DMM"].map((vpc) =>
    queryAnalytics({ ...defaultQueryFilters, vpc }),
  );
  assert.equal(
    vpcs.reduce((sum, result) => sum + result.stock.physical, 0),
    6709,
  );
  assert.equal(
    vpcs.reduce((sum, result) => sum + result.storeCount, 0),
    79,
  );
  assert.equal(
    queryAnalytics({ ...defaultQueryFilters, channel: "直营" }).storeCount,
    34,
  );
  assert.equal(
    queryAnalytics({ ...defaultQueryFilters, channel: "二级展厅" }).storeCount,
    45,
  );
});

test("road capacity is counted once per shared city route and scenarios remain separate", async () => {
  const { queryAnalytics, defaultQueryFilters } = await model();
  const all = queryAnalytics(defaultQueryFilters);
  assert.equal(all.transport.dual.capacity, 3226);
  assert.equal(all.transport.west.capacity, 1865);
  assert.equal(all.transport.dual.trucks, 180);
  assert.equal(all.transport.west.trucks, 180);
  assert.equal(all.transport.west.routeGap, 548);
  assert.equal(all.transport.dual.routes.length, 18);
  assert.equal(all.transport.west.routes.length, 18);
  const empty = queryAnalytics({ ...defaultQueryFilters, store: "unknown" });
  assert.equal(empty.storeCount, 0);
  assert.equal(empty.stock.physical, 0);
  assert.equal(empty.transport.dual.capacity, 0);
  assert.ok(
    empty.monthly
      .filter((row) => row.actual !== null)
      .every((row) => row.actual === 0),
  );
});
