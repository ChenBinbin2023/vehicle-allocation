import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("logistics costs compare the same orders across stores and regions below the map", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 订单分车");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const costs = page.getByTestId("order-logistics-costs");
  await expect(costs).toBeVisible();
  const charts = costs.locator("[data-store-cost-chart]");
  await expect(charts).toHaveCount(4);
  await expect(charts.first().locator(".voa-cost-chart-metric strong")).toHaveText("1,316,520");
  await expect(charts.nth(2).locator(".voa-cost-chart-metric strong")).toHaveText("1,032,232");
  const tops = await charts.evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().top),
  );
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
  await expect(
    costs.getByRole("table", { name: "各业务大区物流费用对比" }),
  ).toContainText("1,642");
  await expect(
    costs.locator("[data-region-bar][data-mode='single']"),
  ).toHaveCount(5);
  await expect(
    costs.locator("[data-region-bar][data-mode='dual']"),
  ).toHaveCount(5);
  await expect(costs.getByTestId("order-cost-change")).toContainText(
    "双港改为单港",
  );
  await expect(costs.getByTestId("order-cost-change")).toContainText("增加");
  await expect(costs.getByTestId("order-cost-change")).toContainText("284,288");
  await expect(costs.getByTestId("order-cost-change")).toContainText("27.54%");
  const mapBottom = await page
    .locator(".voa-map-panel")
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(
    await costs.evaluate((el) => el.getBoundingClientRect().top),
  ).toBeGreaterThanOrEqual(mapBottom);
  await page.getByRole("combobox", { name: "搜索订单门店" }).fill(" d01 ");
  await expect(charts.first().locator("[data-store-cost]")).toHaveCount(1);
  await expect(
    costs.locator("[data-region-bar][data-mode='single']"),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "订单品牌" })
    .selectOption("雷克萨斯");
  // D01's Lexus share: 3/8 of a 7,180 truck + two 7,180 trucks + 4,563.
  await expect(charts.first().locator("[data-store-cost]")).toHaveAttribute("data-cost", "21615.5");
  await page.getByRole("combobox", { name: "搜索订单门店" }).fill("不存在的门店");
  await expect(charts.first().locator("[data-store-cost]")).toHaveCount(0);
  await expect(costs).toContainText("当前筛选没有已分配的运输订单");
  await expect(costs).not.toContainText("NaN");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("every store bubble can be clicked and empty filters do not retain stale details", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 订单分车");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const workspace = page.getByTestId("vessel-orders");
  await expect(workspace).toBeVisible();
  const bubbles = workspace.locator("[data-store-bubble]");
  for (let i = 0; i < 79; i++) {
    const bubble = bubbles.nth(i);
    const id = await bubble.getAttribute("data-store-bubble");
    await bubble.click({ timeout: 1500 });
    await expect(page.getByTestId("order-store-inspector")).toHaveAttribute(
      "data-store-id",
      id!,
    );
  }
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出订单与物流快照", exact: true })
    .click();
  const download = await downloadEvent;
  const snapshot = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(snapshot.simulation).toBe(true);
  expect(snapshot.orders.stores).toHaveLength(79);
  expect(snapshot.orders.plans.single.quantity).toBe(1642);
  expect(snapshot.orders.plans.dual.quantity).toBe(1642);
  await page
    .getByRole("combobox", { name: "搜索订单门店" })
    .fill("不存在的门店");
  await expect(bubbles).toHaveCount(0);
  await expect(page.getByTestId("order-store-inspector")).toContainText(
    "无匹配门店",
  );
  await page.getByRole("button", { name: "物流建议", exact: true }).click();
  await expect(page.getByTestId("order-trip-list")).toContainText(
    "没有符合筛选条件的车次",
  );
  await expect(page.getByTestId("order-trip-detail")).toHaveCount(0);
});

test("tab2 links store bubbles, sorted bars, port scenarios and multi-stop trips", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  const workspace = page.getByTestId("vessel-orders");
  await expect(workspace).toBeVisible();
  await expect(workspace.locator("[data-store-bubble]")).toHaveCount(79);
  const bubble = workspace.locator("[data-store-bubble]").nth(1);
  const storeId = await bubble.getAttribute("data-store-bubble");
  await bubble.press("Enter");
  await expect(page.getByTestId("order-store-inspector")).toHaveAttribute(
    "data-store-id",
    storeId!,
  );
  for (const chart of ["order-model-chart", "order-type-chart"]) {
    const values = await page
      .getByTestId(chart)
      .locator("[data-quantity]")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number(n.getAttribute("data-quantity"))),
      );
    expect(values.length).toBeGreaterThan(0);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  }
  await page.getByRole("button", { name: "物流建议", exact: true }).click();
  await expect(page.getByTestId("order-trip-list")).toBeVisible();
  await page.getByRole("button", { name: "单港 · 吉达", exact: true }).click();
  await expect(workspace.locator("[data-port='P-E']")).toHaveCount(0);
  await page
    .getByRole("button", { name: "双港 · 吉达 + 达曼", exact: true })
    .click();
  await expect(workspace.locator("[data-port='P-E']")).toHaveCount(1);
  await page.getByRole("combobox", { name: "车次类型" }).selectOption("multi");
  const trip = page
    .getByTestId("order-trip-list")
    .locator("button[data-trip-id]")
    .first();
  const tripId = await trip.getAttribute("data-trip-id");
  await trip.click();
  await expect(workspace.locator("[data-selected-trip]")).toHaveAttribute(
    "data-selected-trip",
    tripId!,
  );
  await expect(page.getByTestId("order-trip-detail")).toContainText("途经");
  await expect(page.getByTestId("order-trip-detail")).toContainText("SIM-ORD-");
  await expect(page.getByTestId("order-trip-detail")).toContainText(
    "每台物流成本",
  );
  const stops = workspace.locator("[data-map-stop]");
  expect(await stops.count()).toBeGreaterThan(1);
  const annotations = await stops.locator("rect").evaluateAll((nodes) =>
    nodes.map((n) => {
      const { left, right, top, bottom } = n.getBoundingClientRect();
      return { left, right, top, bottom };
    }),
  );
  for (let i = 0; i < annotations.length; i++) {
    for (let j = i + 1; j < annotations.length; j++) {
      const a = annotations[i],
        b = annotations[j];
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
      ).toBe(true);
    }
  }
  const paneBounds = await workspace
    .locator(".voa-map-panel, .voa-inspector")
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  expect(Math.abs(paneBounds[0] - paneBounds[1])).toBeLessThanOrEqual(1);
  await page
    .getByRole("button", { name: /查看物流建议/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "物流建议", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("a CUI single-port request opens logistics advice and its statistics link returns to store orders", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 物流建议 单港");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await expect(
    page.getByRole("tab", { name: "订单分车", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "单港 · 吉达", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("vessel-orders").locator("[data-port='P-E']"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /查看订单分车/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "门店订单", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("order-model-chart")).toBeVisible();
});

test("store search suggests cities and stores, and accepts mouse and keyboard selections", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 订单分车");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const search = page.getByRole("combobox", { name: "搜索订单门店" });
  const suggestions = page.getByRole("listbox", { name: "门店搜索联想" });
  await search.fill("利");
  await expect(suggestions).toBeVisible();
  await suggestions.getByRole("option", { name: /城市 利雅得/ }).click();
  await expect(search).toHaveValue("利雅得");
  await expect(suggestions).toHaveCount(0);
  await expect(
    page.getByTestId("vessel-orders").locator("[data-store-bubble]"),
  ).toHaveCount(14);
  await search.fill(" d01 ");
  await expect(
    suggestions.getByRole("option", { name: /模拟直营·利雅得·01店/ }),
  ).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(search).toHaveValue("模拟直营·利雅得·01店");
  await expect(page.getByTestId("order-store-inspector")).toHaveAttribute(
    "data-store-id",
    "MOCK-D-001",
  );
  await expect(
    page.getByTestId("vessel-orders").locator("[data-store-bubble]"),
  ).toHaveCount(1);
  await search.fill("吉达");
  await search.press("Escape");
  await expect(suggestions).toHaveCount(0);
  await expect(search).toHaveValue("吉达");
  await search.fill("未知门店");
  await expect(
    page.getByRole("status").filter({ hasText: "没有匹配的城市或门店" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除筛选", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(
    page.getByTestId("vessel-orders").locator("[data-store-bubble]"),
  ).toHaveCount(79);
  await page.getByRole("combobox", { name: "订单渠道" }).selectOption("授权");
  await search.fill("利");
  await expect(suggestions).not.toContainText("模拟直营");
  await suggestions
    .getByRole("option", { name: /模拟二级展厅·利雅得·01店/ })
    .click();
  await expect(page.getByTestId("order-store-inspector")).toHaveAttribute(
    "data-store-id",
    "MOCK-L2-001",
  );
  await expect(page.getByTestId("order-store-inspector")).toContainText("授权");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await search.fill("利");
  await expect(suggestions).toBeVisible();
  const searchTop = await page
    .locator(".voa-search-wrap")
    .evaluate((element) => element.getBoundingClientRect().top);
  await page.locator(".story-canvas").evaluate((element, top) => {
    element.scrollTop += top - 764;
  }, searchTop);
  await expect
    .poll(() =>
      page
        .locator(".voa-search-popup")
        .evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(844);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
