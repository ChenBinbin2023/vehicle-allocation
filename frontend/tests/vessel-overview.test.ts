import assert from "node:assert/strict";
import test from "node:test";

// Each check guards a consumer-visible accounting or snapshot boundary.
// The missing-module branch makes the initial red run an assertion failure.
async function readOverview() {
  try {
    return (await import("../src/lib/story/vessel-overview")).vesselOverview;
  } catch (error) {
    if (
      ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    ) {
      assert.fail("The August vessel overview data is not available yet");
    }
    throw error;
  }
}

const total = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0);

test("the August snapshot keeps all 79 distinct source stores and both sales channels", async () => {
  const data = await readOverview();
  assert.equal(data.stores.length, 79);
  assert.equal(new Set(data.stores.map((store) => store.id)).size, 79);
  assert.equal(new Set(data.stores.map((store) => store.shortName)).size, 79);
  assert.equal(
    data.stores.filter((store) => store.channel === "直营").length,
    34,
  );
  assert.equal(
    data.stores.filter((store) => store.channel === "授权").length,
    45,
  );
  assert.deepEqual(
    [...new Set(data.stores.map((store) => store.region))].sort(),
    ["东部", "中部", "北部", "南部", "西部"],
  );
  for (const channel of data.channels) {
    assert.equal(
      channel.storeCount,
      data.stores.filter((store) => store.channel === channel.channel).length,
    );
  }
});

test("history stops before the August snapshot and the sales window contains eight completed weeks", async () => {
  const data = await readOverview();
  assert.equal(data.snapshotDate, "2026-08-05");
  assert.equal(data.months.length, 13);
  assert.equal(data.months[0], "2025-07");
  assert.equal(data.months.at(-1), "2026-07");
  assert.deepEqual(
    data.supplyHistory.map((row) => row.month),
    data.months,
  );
  data.months.forEach((month, index) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    assert.equal(
      date.getUTCFullYear() * 12 + date.getUTCMonth(),
      2025 * 12 + 6 + index,
    );
    assert.ok(`${month}-31` < data.snapshotDate);
  });
  assert.deepEqual(data.weeklyWindow, {
    start: "2026-06-08",
    end: "2026-08-02",
    weeks: 8,
  });
  const start = new Date(`${data.weeklyWindow.start}T00:00:00Z`);
  const end = new Date(`${data.weeklyWindow.end}T00:00:00Z`);
  assert.equal(start.getUTCDay(), 1);
  assert.equal(end.getUTCDay(), 0);
  assert.equal((end.valueOf() - start.valueOf()) / 86_400_000 + 1, 56);
  assert.ok(data.weeklyWindow.end < data.snapshotDate);
  // Source weekly totals: 629 + half-up-rounded 330/4 = 712; 712/8 = 89.
  assert.equal(
    data.stores.find((store) => store.id === "MOCK-D-001")?.weeklySales,
    89,
  );
  // Authorized weeks are source monthly reports split into simulated weeks.
  assert.equal(
    data.stores.find((store) => store.id === "MOCK-L2-001")?.weeklySales,
    19.125,
  );
});

test("the current vessel reconciles across model, brand and final historical vessel views", async () => {
  const data = await readOverview();
  assert.equal(data.summary.supply, 1800);
  assert.equal(
    total(data.models.map((model) => model.supply)),
    data.summary.supply,
  );
  for (const [brand, summary] of [
    ["丰田", data.summary.toyotaSupply],
    ["雷克萨斯", data.summary.lexusSupply],
  ] as const) {
    assert.equal(
      total(
        data.models
          .filter((model) => model.brand === brand)
          .map((model) => model.supply),
      ),
      summary,
    );
  }
  assert.equal(
    data.summary.toyotaSupply + data.summary.lexusSupply,
    data.summary.supply,
  );
  const last = data.supplyHistory.at(-1)!;
  assert.equal(last.toyota, data.summary.toyotaSupply);
  assert.equal(last.lexus, data.summary.lexusSupply);
  const previous = data.supplyHistory.at(-2)!;
  assert.ok(
    Math.abs(
      data.summary.supplyChangePercent -
        ((last.toyota + last.lexus) / (previous.toyota + previous.lexus) - 1) *
          100,
    ) < 1e-9,
  );
  assert.equal(
    new Set(data.models.map((model) => model.model)).size,
    data.models.length,
  );
  for (const name of [
    "Land Cruiser 300",
    "Prado 250",
    "RAV4 Hybrid",
    "Lexus LX 600",
    "Lexus ES 300h",
    "Lexus RX 350h",
    "Lexus NX 350h",
  ]) {
    assert.ok(
      data.models.some((model) => model.model === name),
      name,
    );
  }
});

test("orders and four-week demand reconcile without adding forecasts to committed orders", async () => {
  const data = await readOverview();
  for (const channel of data.channels) {
    const isDirect = channel.channel === "直营";
    const rows = data.stores.filter(
      (store) => store.channel === channel.channel,
    );
    assert.equal(
      channel.demand4Weeks,
      total(rows.map((store) => Math.round(store.weeklySales * 4))),
    );
    assert.equal(
      channel.orders,
      total(
        data.models.map((model) =>
          isDirect ? model.directOrders : model.authorizedOrders,
        ),
      ),
    );
    assert.equal(
      channel.orderShortage,
      total(
        data.models.map((model) =>
          isDirect ? model.directOrderShortage : model.authorizedOrderShortage,
        ),
      ),
    );
    assert.equal(
      channel.demand4Weeks,
      total(
        data.models.map((model) =>
          isDirect ? model.directDemand4Weeks : model.authorizedDemand4Weeks,
        ),
      ),
    );
    assert.equal(
      channel.replenishmentShortage,
      total(
        data.models.map((model) =>
          isDirect
            ? model.directReplenishmentShortage
            : model.authorizedReplenishmentShortage,
        ),
      ),
    );
  }
  for (const key of [
    "orders",
    "orderShortage",
    "demand4Weeks",
    "replenishmentShortage",
  ] as const) {
    assert.equal(
      data.summary[key],
      total(data.channels.map((channel) => channel[key])),
    );
  }
  assert.ok(data.summary.orderShortage / data.summary.orders >= 0.02);
  assert.ok(data.summary.orderShortage / data.summary.orders <= 0.04);
  assert.ok(
    data.summary.replenishmentShortage > data.summary.orderShortage * 10,
  );
  assert.ok(
    data.summary.replenishmentShortage / data.summary.demand4Weeks > 0.2,
  );
  for (const model of data.models) {
    assert.equal(model.directSupply + model.authorizedSupply, model.supply);
    assert.equal(
      model.directOrderShortage,
      Math.max(0, model.directOrders - model.directSupply),
    );
    assert.equal(
      model.authorizedOrderShortage,
      Math.max(0, model.authorizedOrders - model.authorizedSupply),
    );
    assert.equal(
      model.directReplenishmentShortage,
      Math.max(
        0,
        model.directDemand4Weeks - model.directStock - model.directSupply,
      ),
    );
    assert.equal(
      model.authorizedReplenishmentShortage,
      Math.max(
        0,
        model.authorizedDemand4Weeks -
          model.authorizedStock -
          model.authorizedSupply,
      ),
    );
  }
});

test("store and VPC inventories remain separate while regional and VPC sales show the same sales universe", async () => {
  const data = await readOverview();
  assert.deepEqual(data.vpcs.map((vpc) => vpc.id).sort(), [
    "DMM",
    "JED",
    "RUH",
  ]);
  assert.equal(
    total(data.stores.map((store) => store.stock)),
    data.summary.storeStock,
  );
  assert.equal(
    total(data.regions.map((region) => region.stock)),
    data.summary.storeStock,
  );
  assert.equal(
    total(
      data.models.map((model) => model.directStock + model.authorizedStock),
    ),
    data.summary.storeStock,
  );
  assert.equal(total(data.vpcs.map((vpc) => vpc.stock)), data.summary.vpcStock);
  assert.equal(data.regions.length, 5);
  for (const region of data.regions) {
    assert.equal(
      region.stock,
      total(
        data.stores
          .filter((store) => store.region === region.name)
          .map((store) => store.stock),
      ),
    );
    assert.equal(region.monthlySales.length, 13);
  }
  for (const vpc of data.vpcs) assert.equal(vpc.monthlySales.length, 13);
  // Independently read source-month national sales totals; dimensions cannot be added together.
  const monthlyNationalSales = [
    21614, 23261, 23591, 24340, 23924, 27362, 19649, 19299, 16791, 15748, 13247,
    11260, 8901,
  ];
  data.months.forEach((_, index) => {
    assert.equal(
      total(data.regions.map((region) => region.monthlySales[index])),
      monthlyNationalSales[index],
    );
    assert.equal(
      total(data.vpcs.map((vpc) => vpc.monthlySales[index])),
      monthlyNationalSales[index],
    );
  });
  assert.ok(data.summary.vpcStock > 0);
  assert.notEqual(
    data.summary.storeStock,
    6709,
    "the September 29 store stock must not masquerade as August stock",
  );
});

test("ranked stores and scenario metadata expose the simulated and incomplete-source boundaries", async () => {
  const data = await readOverview();
  for (let index = 1; index < data.stores.length; index++) {
    const previous = data.stores[index - 1];
    const current = data.stores[index];
    assert.ok(
      previous.weeklySales > current.weeklySales ||
        (previous.weeklySales === current.weeklySales &&
          previous.id.localeCompare(current.id) < 0),
    );
  }
  for (const store of data.stores) {
    assert.ok(Number.isFinite(store.weeklySales) && store.weeklySales > 0);
    assert.ok(Number.isInteger(store.stock) && store.stock >= 0);
  }
  const toyota2026 = data.supplyHistory.filter(
    (month) => month.month >= "2026-02",
  );
  for (let index = 1; index < toyota2026.length; index++)
    assert.ok(toyota2026[index].toyota < toyota2026[index - 1].toyota);
  assert.ok(
    data.assumptions.some(
      (note) => note.includes("霍尔木兹") && note.includes("假设"),
    ),
  );
  assert.ok(
    data.assumptions.some(
      (note) => note.includes("代表船次") && note.includes("模拟"),
    ),
  );
  assert.ok(data.assumptions.some((note) => note.includes("非核实进口")));
  assert.ok(
    data.assumptions.some(
      (note) => note.includes("2026-07-27") && note.includes("重建"),
    ),
  );
  assert.ok(
    data.assumptions.some(
      (note) => note.includes("2026-09-29") && note.includes("独立"),
    ),
  );
  assert.ok(
    data.sources.some((source) => source.includes("00_客户/门店主数据.csv")),
  );
  assert.ok(
    data.sources.some(
      (source) => source.startsWith("https://") && /toyota|lexus/.test(source),
    ),
  );
});
