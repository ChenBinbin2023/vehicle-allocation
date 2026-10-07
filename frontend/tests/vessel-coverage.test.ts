import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVesselCoverage,
  vesselOverview,
} from "../src/lib/story/vessel-overview";

test("sellable weeks include the vessel, stores and VPC once and rank the three highest-demand models", () => {
  const result = calculateVesselCoverage(vesselOverview);
  assert.equal(result.available, 8365);
  assert.equal(result.weeklyDemand, 2280.25);
  assert.ok(Math.abs(result.weeks! - 3.66845740599) < 1e-9);
  assert.deepEqual(
    result.models.slice(0, 3).map((model) => model.model),
    ["Camry", "Yaris", "Hilux"],
  );
  assert.deepEqual(
    result.models.slice(0, 3).map((model) => Number(model.weeks!.toFixed(1))),
    [4.4, 4.3, 3.9],
  );
  assert.equal(
    result.models.reduce((sum, model) => sum + model.vpcStock, 0),
    1060,
  );
  assert.ok(result.models.every((model) => Number.isInteger(model.vpcStock)));
});

test("zero forecast demand leaves sellable weeks unknown instead of fabricating coverage", () => {
  const data = structuredClone(vesselOverview);
  data.summary.demand4Weeks = 0;
  for (const model of data.models) {
    model.directDemand4Weeks = 0;
    model.authorizedDemand4Weeks = 0;
  }
  const result = calculateVesselCoverage(data);
  assert.equal(result.weeks, null);
  assert.ok(result.models.every((model) => model.weeks === null));
});
