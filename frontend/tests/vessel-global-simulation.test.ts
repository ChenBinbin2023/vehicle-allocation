import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateVesselReplenishment,
  defaultReplenishmentParameters,
} from "../src/lib/story/vessel-replenishment";
import {
  calculateCommercial,
  defaultCommercialParameters,
} from "../src/lib/story/vessel-commercial";

function setup() {
  return {
    ...defaultReplenishmentParameters(),
    channelGap: 0.1,
    commercial: defaultCommercialParameters(),
  };
}
test("regional simulation compounds store factors and leaves other regions unchanged", () => {
  const p = setup();
  const allocation = calculateVesselReplenishment(p);
  const west = allocation.stores.find((s) => s.region === "西部")!;
  const east = allocation.stores.find((s) => s.region === "东部")!;
  p.commercial.logistics[west.id].factor = 1.1;
  const before = calculateCommercial(calculateVesselReplenishment(p));
  (p.commercial as any).simulation = {
    regions: { 西部: 1.2 },
    retailFactor: 1,
    wholesaleFactor: 1,
  };
  const after = calculateCommercial(calculateVesselReplenishment(p));
  const log = (result: typeof before, id: string) =>
    result.logistics.stores.find((s) => s.storeId === id)!;
  assert.equal(log(after, west.id).factor, 1.32);
  assert.equal(
    log(after, west.id).unitCost,
    Math.round(log(before, west.id).unitCost * 1.2 * 100) / 100,
  );
  assert.equal(log(after, east.id).unitCost, log(before, east.id).unitCost);
  assert.ok(after.logistics.totalCost > before.logistics.totalCost);
  assert.equal(p.commercial.logistics[west.id].factor, 1.1);
  assert.ok(
    Math.abs(
      after.profit.summary.net -
        before.profit.summary.net +
        after.logistics.totalCost -
        before.logistics.totalCost,
    ) < 0.01,
  );
});
test("global retail and wholesale controls preserve model overrides and channel fixed-cost rules", () => {
  const p = setup();
  p.commercial.pricing.Camry.retailFactor = 1.02;
  (p.commercial as any).simulation = {
    regions: {},
    retailFactor: 1.05,
    wholesaleFactor: 0.99,
  };
  const result = calculateCommercial(calculateVesselReplenishment(p));
  const direct = result.profit.rows.find(
    (r) => r.model === "Camry" && r.channel === "直营",
  )!;
  const authorized = result.profit.rows.find(
    (r) => r.model === "Camry" && r.channel === "授权",
  )!;
  assert.equal(direct.unitPrice, 128520);
  assert.equal(authorized.unitPrice, 108900);
  assert.equal(direct.unitFixed, 800);
  assert.equal(authorized.unitFixed, 0);
  assert.equal(p.commercial.pricing.Camry.retailFactor, 1.02);
});
test("live simulation rejects invalid channel economics and nonfinite regional values", () => {
  for (const simulation of [
    { regions: {}, retailFactor: 0.5, wholesaleFactor: 1 },
    { regions: { 西部: NaN }, retailFactor: 1, wholesaleFactor: 1 },
  ]) {
    const p = setup();
    (p.commercial as any).simulation = simulation;
    assert.throws(() => calculateCommercial(calculateVesselReplenishment(p)));
  }
});
