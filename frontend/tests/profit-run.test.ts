import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignState } from "../src/lib/story/seed";
import {
  startStoryRun,
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";
import { defaultProfitScenario } from "../src/lib/story/profit-analysis";
function completed(
  command: Parameters<typeof startStoryRun>[0],
  state: ReturnType<typeof createCampaignState>,
  prompt = "",
) {
  const r = startStoryRun(command, prompt, state);
  return applyStoryRunResult(state, advanceStoryRun(r, r.duration));
}
test("profit requires a completed logistics run and saves a read-only bound snapshot", () => {
  let state = createCampaignState();
  assert.equal(startStoryRun("/profit-analysis", "", state).status, "blocked");
  state = completed("/vessel-allocation", state);
  state = completed("/delivery-plan", state, "双港");
  const source = state.runs.at(-1)!;
  const profit = startStoryRun("/profit-analysis", "", state);
  assert.equal(profit.status, "running");
  assert.equal(profit.profit?.deliveryRunId, source.id);
  const saved = applyStoryRunResult(
    state,
    advanceStoryRun(profit, profit.duration),
  );
  assert.equal(saved.version, state.version);
  assert.deepEqual(saved.inventoryBaseline, state.inventoryBaseline);
  assert.deepEqual(saved.deliveryPlan, state.deliveryPlan);
  assert.match(saved.runs.at(-1)!.answer ?? "", /贡献利润/);
  assert.ok(profit.events.every((e) => e.profitTab));
});
test("profit GUI and CUI overrides retain the requested historical logistics snapshot", () => {
  let state = completed(
    "/delivery-plan",
    completed("/vessel-allocation", createCampaignState()),
    "双港",
  );
  const first = state.runs.at(-1)!;
  assert.equal(first.planning?.kind, "delivery");
  if (first.planning?.kind !== "delivery") return;
  const input = defaultProfitScenario(
    first.planning.allocation,
    first.planning.result,
  );
  input.orders[0].purchase = 200000;
  state = completed("/delivery-plan", state, "单港");
  const gui = startStoryRun("/profit-analysis", "", state, {
    profitInput: input,
    deliveryRunId: first.id,
  });
  assert.equal(gui.profit?.deliveryRunId, first.id);
  assert.equal(gui.profit?.result.input.orders[0].purchase, 200000);
  state = applyStoryRunResult(state, advanceStoryRun(gui, gui.duration));
  const cui = startStoryRun(
    "/profit-analysis",
    "车型=海拉克斯 单价=90000 整备=待确认",
    state,
    { deliveryRunId: first.id },
  );
  assert.ok(
    cui.profit?.result.input.orders
      .filter((o) => o.model === "海拉克斯")
      .every((o) => o.unitPrice === 90000),
  );
  assert.equal(cui.profit?.result.summary.profit, null);
  assert.equal(gui.profit?.result.input.costRates.pdi, 250);
  const invalid = startStoryRun("/profit-analysis", "", state, {
    deliveryRunId: "missing",
  });
  assert.equal(invalid.status, "blocked");
  assert.equal(
    startStoryRun(
      "/profit-analysis",
      "车型=兰德酷路泽300 门店=MOCK-D-001 单价=1",
      state,
      { deliveryRunId: first.id },
    ).status,
    "blocked",
  );
});
