import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignState } from "../src/lib/story/seed";
import { startStoryRun } from "../src/lib/story/skill-runner";
import * as runner from "../src/lib/story/store-planning-run";
import {
  calculateVesselReplenishment,
  defaultReplenishmentParameters,
  replenishmentAllocation,
} from "../src/lib/story/vessel-replenishment";

function run(parameters = defaultReplenishmentParameters()) {
  return startStoryRun(
    "/vessel-allocation",
    "门店补库 总量=2500",
    createCampaignState(),
    {
      input: replenishmentAllocation(calculateVesselReplenishment(parameters))
        .input,
    },
  );
}
function scenario() {
  const result = run().planning as any;
  assert.ok(
    result?.commercial,
    "Tab3 must bind logistics and channel pricing to its allocation snapshot",
  );
  return result;
}
test("Tab3 budgets each allocated car once and separates first-leg supply from order-triggered last-mile trips", () => {
  const s = scenario();
  assert.equal(s.commercial.logistics.quantity, 512);
  assert.equal(s.commercial.logistics.direct, 145);
  assert.equal(s.commercial.logistics.viaHub, 367);
  const trips = s.commercial.logistics.trips;
  assert.equal(
    trips
      .filter((t: any) => t.stage !== "last-mile")
      .reduce((n: number, t: any) => n + t.quantity, 0),
    512,
  );
  assert.equal(
    trips
      .filter((t: any) => t.stage === "last-mile")
      .reduce((n: number, t: any) => n + t.quantity, 0),
    367,
  );
  assert.ok(
    trips.every((t: any) => t.quantity > 0 && t.quantity <= t.capacity),
  );
  assert.ok(
    trips
      .filter((t: any) => t.stage === "last-mile")
      .every((t: any) => t.trigger === "订单触发"),
  );
  const sum = trips.reduce((n: number, t: any) => n + t.cost, 0);
  assert.ok(Math.abs(sum - s.commercial.logistics.totalCost) < 0.01);
});
test("the same model uses retail revenue at direct stores and wholesale revenue at authorized stores", () => {
  const s = scenario(),
    p = structuredClone(s.replenishment.parameters);
  const model = "Camry";
  p.commercial.pricing[model] = {
    purchasePrice: 90000,
    retailPrice: 120000,
    wholesalePrice: 110000,
    retailFactor: 1.1,
    wholesaleFactor: 0.95,
    fixedCost: 1000,
  };
  for (const value of Object.values(p.commercial.logistics) as any[]) {
    value.baseUnitCost = 500;
    value.factor = 1.2;
  }
  const result = (run(p).planning as any).commercial;
  const direct = result.profit.rows.find(
    (r: any) => r.model === model && r.channel === "直营",
  );
  const authorized = result.profit.rows.find(
    (r: any) => r.model === model && r.channel === "授权",
  );
  assert.equal(direct.unitPrice, 132000);
  assert.equal(direct.unitGross, 42000);
  assert.equal(direct.unitNet, 40400);
  assert.equal(authorized.unitPrice, 104500);
  assert.equal(authorized.unitGross, 14500);
  assert.equal(authorized.unitNet, 13900);
  assert.equal(authorized.unitFixed, 0);
  assert.equal(authorized.fixed, 0);
  assert.equal(direct.unitFixed, 1000);
  assert.ok(direct.unitNet > authorized.unitNet);
  assert.equal(direct.unitLogistics, authorized.unitLogistics);
});
test("discount changes gross profit while procurement stays fixed and negative net profit is retained", () => {
  const s = scenario(),
    p = structuredClone(s.replenishment.parameters);
  p.commercial.pricing.Camry = {
    purchasePrice: 130000,
    retailPrice: 120000,
    wholesalePrice: 110000,
    retailFactor: 0.98,
    wholesaleFactor: 1,
    fixedCost: 1000,
  };
  const next = run(p);
  assert.equal(next.status, "running");
  const r = (next.planning as any).commercial.profit.rows.find(
    (r: any) => r.model === "Camry" && r.channel === "直营",
  );
  assert.equal(r.purchasePrice, 130000);
  assert.equal(r.unitGross, -12400);
  assert.ok(r.unitNet < 0);
});
test("store and model summaries conserve revenue and use total net profit divided by total revenue", () => {
  const {
    commercial: { profit },
  } = scenario();
  for (const groups of [profit.stores, profit.models]) {
    assert.equal(
      groups.reduce((n: number, r: any) => n + r.quantity, 0),
      512,
    );
    assert.ok(
      Math.abs(
        groups.reduce((n: number, r: any) => n + r.revenue, 0) -
          profit.summary.revenue,
      ) < 0.01,
    );
    assert.ok(
      Math.abs(
        groups.reduce((n: number, r: any) => n + r.net, 0) - profit.summary.net,
      ) < 0.01,
    );
  }
  assert.equal(
    profit.summary.margin,
    profit.summary.net / profit.summary.revenue,
  );
});
test("invalid retail-wholesale ordering, unknown hubs and nonfinite coefficients cannot save a scenario", () => {
  const s = scenario();
  for (const mutate of [
    (p: any) => {
      p.commercial.pricing.Camry.retailFactor = 0.1;
    },
    (p: any) => {
      p.commercial.pricing.Camry.fixedCost = 10000;
    },
    (p: any) => {
      p.commercial.logistics["MOCK-D-001"].factor = -1;
    },
    (p: any) => {
      p.commercial.logistics["MOCK-D-001"].hub = "missing";
    },
  ]) {
    const p = structuredClone(s.replenishment.parameters);
    mutate(p);
    const r = run(p);
    assert.equal(r.status, "blocked");
    assert.ok(r.blockedReason);
  }
});
test("editing or restoring versions preserves historical parameters and branching records the selected parent", () => {
  const revise = (runner as any).reviseVesselScenario,
    select = (runner as any).selectVesselScenarioVersion;
  assert.equal(
    typeof revise,
    "function",
    "Version edits must be persisted by the story state, not only React state",
  );
  assert.equal(typeof select, "function");
  const original = run(),
    old = structuredClone(original),
    p = structuredClone((original.planning as any).replenishment.parameters);
  p.commercial.logistics["MOCK-D-001"].factor = 1.4;
  const second = revise(original, p, "D01 物流系数");
  assert.deepEqual(original, old);
  assert.equal(second.planning.versions.length, 2);
  assert.equal(second.planning.versionId, "V2");
  const restored = select(second, "V1");
  assert.equal(
    restored.planning.replenishment.parameters.commercial.logistics[
      "MOCK-D-001"
    ].factor,
    1,
  );
  const third = revise(restored, p, "从 V1 调整");
  assert.equal(third.planning.versions[2].parentId, "V1");
  assert.equal(third.planning.versionId, "V3");
  assert.deepEqual(third.planning.versions[0], second.planning.versions[0]);
  assert.deepEqual(
    select(JSON.parse(JSON.stringify(third)), "V2").planning.commercial,
    second.planning.commercial,
  );
});
test("CUI logistics and channel coefficients create the next scenario version and keep the parent snapshot", () => {
  const campaign = createCampaignState();
  const previous = run();
  previous.status = "complete";
  previous.elapsed = previous.duration;
  campaign.runs.push(previous);
  const next = startStoryRun(
    "/vessel-allocation",
    "物流模拟 MOCK-D-001 物流系数=1.4 Camry 零售系数=110% Camry 批发系数=0.98",
    campaign,
  );
  assert.equal(next.status, "running");
  const p = next.planning as any;
  assert.equal(p.versionId, "V2");
  assert.equal(
    p.replenishment.parameters.commercial.logistics["MOCK-D-001"].factor,
    1.4,
  );
  assert.equal(
    p.replenishment.parameters.commercial.pricing.Camry.retailFactor,
    1.1,
  );
  assert.equal(
    p.replenishment.parameters.commercial.pricing.Camry.wholesaleFactor,
    0.98,
  );
  assert.deepEqual(p.versions[0], (previous.planning as any).versions[0]);
  assert.match(next.planningSummary!, /仅直营扣/);
});
test("the direct-profit premise includes real per-store logistics differences, not only price coefficients", () => {
  const s = scenario(),
    p = structuredClone(s.replenishment.parameters);
  p.commercial.logistics["MOCK-D-001"].baseUnitCost = 15000;
  const next = run(p);
  assert.equal(next.status, "blocked");
  assert.match(next.blockedReason!, /直营.*净利.*授权/);
});
test("CUI baseline logistics and hub-only edits stay in Tab3 commercial scenarios", () => {
  const campaign = createCampaignState(),
    previous = run();
  previous.status = "complete";
  previous.elapsed = previous.duration;
  campaign.runs.push(previous);
  for (const prompt of [
    "MOCK-D-001 基准物流成本=1400",
    "MOCK-D-001 中转中心=DMM",
  ]) {
    const next = startStoryRun("/vessel-allocation", prompt, campaign);
    assert.equal(next.status, "running");
    const p = next.planning as any;
    assert.equal(p.versionId, "V2");
    assert.ok(p.commercial);
    if (prompt.includes("基准"))
      assert.equal(
        p.commercial.input.logistics["MOCK-D-001"].baseUnitCost,
        1400,
      );
    else assert.equal(p.commercial.input.logistics["MOCK-D-001"].hub, "DMM");
  }
});
test("older replenishment snapshots gain an exportable V1 without changing allocation or history count", async () => {
  const { hydrateVesselScenario } =
    await import("../src/lib/story/vessel-scenario");
  const old = run(),
    snapshot = old.planning as any;
  const expected = structuredClone(snapshot.replenishment.summary);
  delete snapshot.commercial;
  delete snapshot.versions;
  delete snapshot.versionId;
  delete snapshot.replenishment.parameters.commercial;
  const next = hydrateVesselScenario(old),
    restored = next.planning as any;
  assert.deepEqual(restored.replenishment.summary, expected);
  assert.equal(next.id, old.id);
  assert.equal(restored.versionId, "V1");
  assert.equal(restored.versions.length, 1);
  assert.equal(
    restored.commercial.profit.rows.find((r: any) => r.channel === "授权")
      .unitFixed,
    0,
  );
  assert.equal(snapshot.commercial, undefined);
});
