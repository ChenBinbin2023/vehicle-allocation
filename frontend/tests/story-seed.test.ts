import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignState } from "../src/lib/story/seed";
import { restoreCampaignState } from "../src/lib/story/state";

test("creates one deterministic 1800 VIN campaign", () => {
  const state = createCampaignState();
  assert.equal(state.vessel.vehicles.length, 1800);
  assert.equal(
    new Set(state.vessel.vehicles.map((vehicle) => vehicle.id)).size,
    1800,
  );
  assert.equal(
    state.vessel.vehicles.filter((vehicle) => vehicle.pool === "reserved")
      .length,
    620,
  );
  assert.equal(
    state.vessel.vehicles.filter((vehicle) => vehicle.pool === "inventory")
      .length,
    1180,
  );
});

test("keeps the approved demand category totals", () => {
  const state = createCampaignState();
  const counts = Object.fromEntries(
    [
      "enterprise",
      "retail",
      "premium",
      "replenishment",
      "mobile",
      "contingency",
    ].map((category) => [
      category,
      state.vessel.vehicles.filter(
        (vehicle) => vehicle.demandCategory === category,
      ).length,
    ]),
  );
  assert.deepEqual(counts, {
    enterprise: 240,
    retail: 290,
    premium: 90,
    replenishment: 780,
    mobile: 300,
    contingency: 100,
  });
});

test("restores invalid and running campaign snapshots safely", () => {
  const fresh = restoreCampaignState({ broken: true });
  assert.equal(fresh.vessel.vehicles.length, 1800);

  const state = createCampaignState();
  state.runs.push({
    id: "RUN-1",
    command: "/crisis-brief",
    prompt: "分析单港影响",
    businessDate: "T-14",
    inputVersion: state.version,
    status: "running",
    elapsed: 400,
    duration: 2000,
    events: [],
    blocks: [],
    decisions: [],
    resultVersion: null,
    nextSkillSuggestions: [],
  });
  const restored = restoreCampaignState(state);
  assert.equal(restored.runs[0].status, "paused");
  assert.equal(restored.runs[0].elapsed, 400);
});
