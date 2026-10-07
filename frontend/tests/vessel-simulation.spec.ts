import { expect, test } from "@playwright/test";

test("channel controls start at ten percent and preview both directions with stable financial scales", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const gap = page.getByRole("slider", {
    name: "直营 / 授权级差",
    exact: true,
  });
  await expect(gap).toHaveValue("10");
  await expect(gap).toHaveAttribute("max", "100");
  await expect(page.getByTestId("channel-gap-guidance")).toHaveCount(0);
  const split = page.getByTestId("simulation-channel-split");
  await expect(split).toContainText("直营 484 台");
  await expect(split).toContainText("授权 22 台");
  const net = page.getByTestId("simulation-net");
  const initialNet = await net.textContent();
  await gap.press("ArrowRight");
  await expect(net).not.toHaveText(initialNet!);
  await gap.press("ArrowLeft");
  await expect(net).toHaveText(initialNet!);
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  const scale = page.getByTestId("simulation-net-scale");
  const originalScale = await scale.textContent();
  const truck = page.getByRole("slider", { name: "板车容量", exact: true });
  const cost = page.getByTestId("simulation-logistics");
  const costEight = await cost.textContent();
  await truck.press("ArrowRight");
  await expect(cost).not.toHaveText(costEight!);
  await expect(net).not.toHaveText(initialNet!);
  const logisticsBar = page
    .locator(".vs-financial-bars article")
    .last()
    .locator(".vs-metric-track > div");
  const nineHeight = await logisticsBar.getAttribute("style");
  await truck.press("ArrowRight");
  await expect(logisticsBar).not.toHaveAttribute("style", nineHeight!);
  const costNine = await cost.textContent();
  await page
    .getByRole("slider", { name: "中部物流系数", exact: true })
    .press("ArrowRight");
  await expect(cost).not.toHaveText(costNine!);
  await expect(page.getByTestId("simulation-impact-logistics")).toContainText(
    "SAR",
  );
  const afterLogistics = await net.textContent();
  await page
    .getByRole("slider", { name: "零售价格系数", exact: true })
    .press("ArrowRight");
  await expect(net).not.toHaveText(afterLogistics!);
  await expect(scale).toHaveText(originalScale!);
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
});

test("absolute negative profit extends from zero instead of filling up from the negative axis limit", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.locator(".vs-advanced > summary").click();
  await page.getByRole("tab", { name: "定价参数", exact: true }).click();
  await page.getByLabel("Camry 采购价格", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await page.getByRole("button", { name: "绝对值", exact: true }).click();
  const bar = page
    .locator(".vs-financial-bars article")
    .nth(1)
    .locator(".vs-metric-track > div");
  const span = await bar.evaluate((el) => ({
    bottom: parseFloat((el as HTMLElement).style.bottom),
    height: parseFloat((el as HTMLElement).style.height),
  }));
  // For a negative baseline, the axis lower limit is 1.5 × baseline; zero is near 100%.
  // The loss therefore occupies 2/3 of the scale below zero, starting at ~1/3.
  expect(span.bottom).toBeGreaterThan(33);
  expect(span.bottom).toBeLessThan(34);
  expect(span.height).toBeGreaterThan(66);
  expect(span.height).toBeLessThan(67);
  await page.getByLabel("Camry 采购价格", { exact: true }).fill("");
  await expect(page.getByTestId("simulation-net")).toHaveText("—万");
  await expect(bar).toHaveAttribute("style", /height: 0%;/);
});

test("fine parameter Run accepts valid slider increments without applying controls early", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.locator(".vs-advanced > summary").click();
  await page
    .getByRole("slider", { name: "直营 / 授权级差", exact: true })
    .press("ArrowRight");
  await page.getByLabel("补库板车容量", { exact: true }).selectOption("9");
  await page.getByLabel("本店绩效加成", { exact: true }).check();
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  const algorithm = page
    .getByTestId("replenishment-graph")
    .locator('[data-node="water-rule"]');
  await expect(algorithm).toContainText("10pp");
  await page.getByRole("button", { name: "应用并运行", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(algorithm).toContainText("11pp");
  await expect(page.getByLabel("补库板车容量", { exact: true })).toHaveValue(
    "9",
  );
  await page.getByRole("button", { name: "恢复初始", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(algorithm).toContainText("11pp");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V3");
  await expect(algorithm).toContainText("10pp");
});

test("missing logistics inputs stay unknown and cannot appear as free transport", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.locator(".vs-advanced > summary").click();
  await page.getByRole("tab", { name: "物流参数", exact: true }).click();
  await page.getByLabel("MOCK-D-001 基准物流成本", { exact: true }).fill("");
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .press("Tab");
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await expect(page.getByTestId("simulation-logistics")).toHaveText("—万");
  await expect(
    page.getByTestId("logistics-coefficient-chart"),
  ).not.toBeVisible();
  await expect(page.getByTestId("logistics-input-incomplete")).toBeVisible();
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .fill("1197.5");
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .press("Tab");
  await expect(page.getByTestId("logistics-coefficient-chart")).toBeVisible();
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
});

test("sliders preview live while all three detail sections wait for Run, then persist one version", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500 级差=30%");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await expect(
    page.locator('[data-skill-command="/vessel-allocation"]'),
  ).toBeVisible();
  const root = page.getByTestId("vessel-replenishment");
  await expect(root.locator(".vs-section-heading")).toHaveCount(4);
  const revenue = page.getByTestId("simulation-revenue");
  const before = await revenue.textContent();
  const bar = root
    .locator(".vs-financial-bars article")
    .first()
    .locator(".vs-metric-track > div");
  const beforeHeight = await bar.getAttribute("style");
  const graphNet = page
    .getByTestId("replenishment-graph")
    .locator('[data-node="unit-net"]');
  const graphBefore = await graphNet.textContent();
  await root.getByRole("tab", { name: "门店物流成本", exact: true }).click();
  const logistics = page
    .getByTestId("logistics-costs-table")
    .locator("tbody tr")
    .first();
  const logisticsBefore = await logistics.textContent();
  const profit = page.getByTestId("commercial-profit-summary");
  const profitBefore = await profit.textContent();
  const slider = page.getByRole("slider", {
    name: "零售价格系数",
    exact: true,
  });
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height / 2, {
    steps: 3,
  });
  await expect(revenue).not.toHaveText(before!);
  await expect(bar).not.toHaveAttribute("style", beforeHeight!);
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await expect(graphNet).toHaveText(graphBefore!);
  await expect(profit).toHaveText(profitBefore!);
  await page.mouse.up();
  await page
    .getByRole("slider", { name: "中部物流系数", exact: true })
    .press("ArrowRight");
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await expect(graphNet).toHaveText(graphBefore!);
  await expect(logistics).toHaveText(logisticsBefore!);
  await expect(profit).toHaveText(profitBefore!);
  await expect(page.getByTestId("simulation-application-status")).toContainText(
    "02–04 仍显示 V1",
  );
  await root.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(graphNet).not.toHaveText(graphBefore!);
  await expect(logistics).not.toHaveText(logisticsBefore!);
  await expect(profit).not.toHaveText(profitBefore!);
  await expect(page.getByTestId("simulation-application-status")).toContainText(
    "02–04 已同步 V2",
  );
  const appliedProfit = await profit.textContent();
  const after = await revenue.textContent();
  await page.clock.runFor(500);
  await page.reload();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(revenue).toHaveText(after!);
  await expect(profit).toHaveText(appliedProfit!);
  await root.getByRole("tab", { name: "注水图", exact: true }).click();
  await expect(page.getByTestId("replenishment-graph")).not.toBeVisible();
  await expect(page.getByTestId("authorized-water-explanation")).toBeVisible();
  await root.getByRole("button", { name: "均衡补库", exact: true }).click();
  await expect(page.getByTestId("authorized-allocated")).toHaveText("0");
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await root.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("authorized-allocated")).not.toHaveText("0");
  await expect(
    root.locator(
      '[data-water-channel="授权"] [data-replenishment]:not([data-replenishment="0"])',
    ),
  ).not.toHaveCount(0);
  await root.getByRole("tab", { name: "班次", exact: true }).click();
  await expect(page.getByTestId("logistics-trips-table")).toBeVisible();
  await expect(
    page.getByTestId("replenishment-logistics-map"),
  ).not.toBeVisible();
  await root.getByRole("tab", { name: "门店物流成本", exact: true }).click();
  await expect(
    page.getByTestId("logistics-costs-table").locator("tbody tr"),
  ).toHaveCount(79);
  await page.setViewportSize({ width: 390, height: 844 });
  const close = page.getByRole("button", { name: "关闭 CUI", exact: true });
  if (await close.isVisible()) await close.click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
