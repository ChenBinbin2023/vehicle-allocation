import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("allocation opens the eleven-chart overview and CUI can return to it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(8000);

  await expect(
    page.getByRole("tab", { name: "基本统计", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const overview = page.getByTestId("vessel-overview");
  await expect(overview).toBeVisible();
  await expect(overview).toContainText("2026-08-05");
  await expect(
    overview.locator('[data-testid^="overview-chart-"]'),
  ).toHaveCount(11);
  await expect(overview).toContainText("霍尔木兹");
  await expect(overview).toContainText("模拟");
  const coverage = page.getByTestId("overview-sellable-weeks");
  await expect(coverage.locator("strong")).toHaveText("3.7周");
  await expect(coverage).toContainText("8,365");
  await expect(coverage.locator(".vo-coverage-models")).toHaveText(
    "Camry4.4 周Yaris4.3 周Hilux3.9 周",
  );
  const kpiTops = await overview
    .locator(".vo-kpis article")
    .evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().top),
    );
  expect(kpiTops).toHaveLength(5);
  expect(Math.max(...kpiTops) - Math.min(...kpiTops)).toBeLessThanOrEqual(1);
  const rows = await overview
    .locator(".vo-grid")
    .evaluateAll((grids) =>
      grids.map((grid) =>
        Array.from(grid.children).map(
          (child) => child.getBoundingClientRect().top,
        ),
      ),
    );
  expect(rows.map((row) => row.length)).toEqual([2, 3, 2, 2, 2]);
  for (const row of rows) {
    expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1);
  }
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出统计快照", exact: true }).click();
  const download = await downloadEvent;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.simulation).toBe(true);
  expect(exported.overview.snapshotDate).toBe("2026-08-05");
  expect(exported.overview.stores).toHaveLength(79);
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  await expect(page.getByTestId("vessel-orders")).toBeVisible();
  await page
    .getByRole("button", { name: /查看基本统计/ })
    .first()
    .click();
  await expect(overview).toBeVisible();
  await page.getByRole("tab", { name: "基本统计", exact: true }).press("End");
  await expect(
    page.getByRole("tab", { name: "门店结果", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "门店结果", exact: true }).press("Home");
  await expect(overview).toBeVisible();
  await page.getByRole("tab", { name: "门店结果", exact: true }).click();
  await expect(
    page.getByTestId("store-allocation-table").locator("tbody tr"),
  ).toHaveCount(79);
  expect(errors).toEqual([]);
});

test("both store charts retain all 79 stores in the same rank order on mobile", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(8000);
  const sales = page.getByTestId("overview-chart-store-sales");
  const stock = page.getByTestId("overview-chart-store-stock");
  await expect(sales.locator("[data-store-id]")).toHaveCount(79);
  await expect(stock.locator("[data-store-id]")).toHaveCount(79);
  const ids = (chart: typeof sales) =>
    chart
      .locator("[data-store-id]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-store-id")),
      );
  expect(await ids(stock)).toEqual(await ids(sales));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("vessel-overview")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
