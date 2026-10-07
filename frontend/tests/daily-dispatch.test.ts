import assert from "node:assert/strict";
import test from "node:test";
import { createCampaignState } from "../src/lib/story/seed";
import {
  resolveStorySkill,
  skillAvailability,
} from "../src/lib/story/skill-catalog";
import {
  advanceStoryRun,
  applyStoryRunResult,
  startStoryRun,
  visibleStoryBlocks,
  visibleStoryEvents,
} from "../src/lib/story/skill-runner";
import { restoreCampaignState } from "../src/lib/story/state";

const prompt = "/skill 帮我整理今天需要处理的订单，并生成调度计划";
function start() {
  const skill = resolveStorySkill(prompt);
  assert.ok(skill, "the requested /skill prompt resolves to daily dispatch");
  const state = createCampaignState();
  const run = startStoryRun(skill.command, prompt.slice(7), state);
  assert.equal(
    run.status,
    "running",
    "daily dispatch runs without the legacy arrival workflow",
  );
  assert.ok(
    run.dispatch,
    "the run owns an independent daily dispatch snapshot",
  );
  return { state, run, data: run.dispatch };
}

test("the requested /skill prompt opens an independent daily dispatch scene", () => {
  const { run, state } = start();
  assert.equal(run.command, "/daily-dispatch");
  assert.equal(skillAvailability(run.command, state).available, true);
  assert.equal(skillAvailability("/daily-transfer", state).available, false);
  assert.ok(resolveStorySkill("/daily-dispatch 整理今日订单"));
});

test("cancelled orders never receive vehicles and every active order is accounted for per vehicle", () => {
  const { data } = start();
  const active = data.orders.filter((o) => o.status !== "cancelled");
  for (const order of data.orders) {
    const vehicles = data.vehicles.filter((v) => v.orderId === order.id);
    assert.equal(
      vehicles.length,
      order.status === "cancelled" ? 0 : order.quantity,
    );
  }
  assert.equal(
    data.summary.vehicles,
    active.reduce((n, o) => n + o.quantity, 0),
  );
  assert.equal(data.summary.vehicles, data.vehicles.length);
  assert.equal(data.summary.shortage, data.shortages.length);
  assert.ok(data.orders.some((o) => o.status === "cancelled"));
});

test("matched inventory is available, configuration exact and never allocated twice", () => {
  const { data } = start();
  const matched = data.vehicles.filter((v) => v.vin);
  assert.equal(new Set(matched.map((v) => v.vin)).size, matched.length);
  const sourceTypes = new Set<string>();
  for (const vehicle of matched) {
    const inventory = data.inventory.find((v) => v.vin === vehicle.vin)!;
    const order = data.orders.find((o) => o.id === vehicle.orderId)!;
    assert.ok(inventory.available);
    assert.equal(inventory.model, order.model);
    assert.equal(inventory.trim, order.trim);
    assert.equal(inventory.color, order.color);
    assert.equal(inventory.sourceId, vehicle.sourceId);
    sourceTypes.add(data.sources.find((s) => s.id === vehicle.sourceId)!.type);
  }
  assert.ok(sourceTypes.has("vpc"));
  assert.ok(sourceTypes.has("store"));
});

test("truck loads, per-car logistics and delivery promises conserve the dispatch plan", () => {
  const { data } = start();
  const tripVehicles: string[] = [];
  for (const trip of data.trips) {
    assert.ok(
      trip.vehicleIds.length > 0 && trip.vehicleIds.length <= trip.capacity,
    );
    const cars = trip.vehicleIds.map((id) =>
      data.vehicles.find((v) => v.id === id)!,
    );
    assert.equal(
      cars.reduce((n, v) => n + v.logistics!, 0),
      trip.totalCost,
    );
    for (const car of cars) {
      const order = data.orders.find((o) => o.id === car.orderId)!;
      assert.equal(car.sourceId, trip.sourceId);
      assert.ok(car.arrivalHours! <= order.dueHours);
      tripVehicles.push(car.id);
    }
  }
  assert.equal(new Set(tripVehicles).size, tripVehicles.length);
  assert.equal(
    tripVehicles.length,
    data.vehicles.length - data.shortages.length,
  );
  assert.equal(
    data.summary.logistics,
    data.trips.reduce((n, t) => n + t.totalCost, 0),
  );
  assert.ok(
    data.trips.some(
      (t) =>
        t.mode === "consolidated" &&
        new Set(
          t.vehicleIds.map(
            (id) => data.vehicles.find((v) => v.id === id)!.orderId,
          ),
        ).size > 1,
    ),
  );
  assert.ok(data.trips.some((t) => t.mode === "small"));
});

test("each regional shortage compares real reserved candidates and reconciles profit", () => {
  const { data } = start();
  const candidateVins: string[] = [];
  for (const shortage of data.shortages) {
    assert.equal(shortage.options.length, 2);
    assert.deepEqual(
      new Set(shortage.options.map((o) => o.kind)),
      new Set(["cross-region", "local-dealer"]),
    );
    const recommended = shortage.options.find(
      (o) => o.id === shortage.recommendedId,
    )!;
    assert.ok(recommended);
    assert.ok(shortage.reason.length > 0);
    for (const option of shortage.options) {
      assert.equal(
        option.profit,
        option.revenue - option.purchase - option.logistics - option.other,
      );
      assert.equal(
        option.totalCost,
        option.purchase + option.logistics + option.other,
      );
      assert.ok(
        data.inventory.some((v) => v.vin === option.vin && v.available),
      );
      candidateVins.push(option.vin);
    }
    const feasible = shortage.options.filter((o) => o.onTime);
    if (feasible.length) {
      assert.ok(
        recommended.onTime,
        "a more profitable late option must not beat an on-time option",
      );
      assert.equal(
        recommended.profit,
        Math.max(...feasible.map((o) => o.profit)),
      );
    }
  }
  assert.ok(data.shortages.length > 0);
  assert.equal(new Set(candidateVins).size, candidateVins.length);
  assert.ok(
    data.shortages.some(
      (s) =>
        s.options.find((o) => o.id === s.recommendedId)!.kind ===
        "local-dealer",
    ),
  );
  assert.ok(
    data.shortages.some(
      (s) =>
        s.options.find((o) => o.id === s.recommendedId)!.kind ===
        "cross-region",
    ),
  );
});

test("small direct trips beat a more expensive and slower consolidated trip for the same eight cars", () => {
  const { data } = start();
  // 4 cars to Riyadh 01, 3 to Riyadh 02, 1 to Buraydah.
  // Four local small trips at 283 + one at 1,226 = 2,358 SAR.
  // One 8-place truck would cost 2,455 SAR and arrive after 20 hours.
  const ids = [
    "SIM-DAY-001-CAR-1",
    "SIM-DAY-001-CAR-2",
    "SIM-DAY-001-CAR-4",
    "SIM-DAY-001-CAR-5",
    "SIM-DAY-005-CAR-1",
    "SIM-DAY-005-CAR-2",
    "SIM-DAY-007-CAR-1",
    "SIM-DAY-027-CAR-1",
  ];
  const cars = ids.map((id) => data.vehicles.find((v) => v.id === id)!);
  const trips = [...new Set(cars.map((v) => v.tripId))].map((id) =>
    data.trips.find((t) => t.id === id)!,
  );
  assert.equal(
    trips.reduce((n, t) => n + t.totalCost, 0),
    2358,
  );
  assert.ok(trips.every((t) => t.mode === "small"));
  assert.ok(cars.every((v) => v.arrivalHours! <= 11));
});

test("daily dispatch streams partial CUI text and progressively reveals linked GUI blocks", () => {
  const { run } = start();
  assert.equal(visibleStoryBlocks(run).length, 0);
  const early = advanceStoryRun(run, 100);
  assert.ok(
    visibleStoryEvents(early)[0].detail.length < run.events[0].detail.length,
  );
  const middle = advanceStoryRun(run, 3500);
  assert.ok(visibleStoryBlocks(middle).length > 0);
  assert.ok(visibleStoryBlocks(middle).length < run.blocks.length);
  for (const event of run.events.filter((e) => e.guiBlock))
    assert.ok(run.blocks.some((b) => b.type === event.guiBlock));
  const complete = advanceStoryRun(run, run.duration);
  assert.equal(visibleStoryBlocks(complete).length, 4);
});

test("an on-time option can beat a higher-margin late option, while loss-making choices require review", () => {
  const { data } = start();
  const premium = data.shortages[0];
  assert.deepEqual(
    premium.options.map((o) => ({
      purchase: o.purchase,
      logistics: o.logistics,
      other: o.other,
      profit: o.profit,
      arrival: o.arrivalHours,
    })),
    [
      {
        purchase: 550000,
        logistics: 1752,
        other: 12680,
        profit: 20568,
        arrival: 35,
      },
      {
        purchase: 569250,
        logistics: 283,
        other: 12850,
        profit: 2617,
        arrival: 6,
      },
    ],
  );
  assert.equal(premium.recommendedId, premium.options[1].id);
  for (const shortage of data.shortages) {
    const recommended = shortage.options.find(
      (o) => o.id === shortage.recommendedId,
    )!;
    if (recommended.profit < 0) {
      assert.equal(shortage.requiresReview, true);
      assert.match(shortage.reason, /亏损.*复核/);
    }
  }
});

test("saving and restoring dispatch retains its snapshot without changing stock or legacy operations", () => {
  const { run, state, data } = start();
  const complete = advanceStoryRun(run, run.duration);
  const saved = applyStoryRunResult(state, complete);
  assert.equal(saved.version, state.version);
  assert.equal(complete.resultVersion, state.version);
  assert.deepEqual(saved.inventoryBaseline, state.inventoryBaseline);
  assert.deepEqual(saved.dailyOperations, []);
  assert.deepEqual(saved.vessel, state.vessel);
  const restored = restoreCampaignState(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.runs.at(-1)!.dispatch, data);
});
