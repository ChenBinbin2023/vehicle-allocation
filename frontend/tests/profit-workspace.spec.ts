import { expect, test, type Page } from "@playwright/test";
async function run(page: Page, prompt: string) {
  await page.getByTestId("story-command").fill(prompt);
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.clock.install();
});
test("map exposes routes and saved batches, costs and selectable profit views", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await run(page, "/vessel-allocation 供给=1800");
  await run(page, "/delivery-plan 双港");
  const map = page.getByTestId("delivery-route-map");
  await expect(map).toBeVisible();
  if (process.env.H_VISUAL_REVIEW)
    await map.screenshot({ path: "docs/delivery-map-preview.png" });
  await expect(page.getByTestId("logistics-cost-summary")).toContainText(
    "待确认",
  );
  const routeOption = await map
    .getByLabel("地图路线")
    .locator("option")
    .filter({ hasText: "达曼 → 利雅得" })
    .getAttribute("value");
  await map.getByLabel("地图路线").selectOption(routeOption!);
  await expect(page.getByTestId("delivery-map-inspector")).toContainText(
    "达曼 → 利雅得",
  );
  await map.getByRole("button", { name: "计划批次", exact: true }).click();
  await expect(
    page.getByTestId("map-batch-table").locator("tbody tr"),
  ).not.toHaveCount(0);
  await expect(map).toContainText("无真实承运班次号");
  await page.getByRole("tab", { name: "路线地图", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "路线地图", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator(".delivery-parameters > summary").click();
  await page.locator(".profit-parameters summary").click();
  await page.getByRole("button", { name: "填入演示费率", exact: true }).click();
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(6500);
  await expect(page.getByTestId("logistics-cost-summary")).toContainText(
    "补充费率为模拟",
  );
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "情景全链路预算",
  );
  await page
    .getByRole("button", { name: "分析订单、车型和门店利润", exact: true })
    .click();
  await page.clock.runFor(6500);
  await expect(page.getByTestId("profit-workspace")).toBeVisible();
  if (process.env.H_VISUAL_REVIEW) {
    await page.getByTestId("profit-workspace").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/profit-desktop-preview.png",
      animations: "disabled",
    });
  }
  await expect(page.getByTestId("profit-conclusion")).toContainText(
    "亏损订单 2 笔",
  );
  await expect(
    page.getByTestId("profit-order-table").locator("tbody tr"),
  ).toHaveCount(6);
  await page.getByRole("tab", { name: "车型利润", exact: true }).click();
  await page
    .getByTestId("profit-models-table")
    .getByRole("button", { name: /海拉克斯/ })
    .click();
  await expect(
    page.getByTestId("profit-order-table").locator("tbody tr"),
  ).toHaveCount(2);
  await expect(page.getByTestId("profit-order-detail")).toContainText(
    "亏损原因",
  );
  if (process.env.H_VISUAL_REVIEW)
    await page
      .getByTestId("profit-bridge")
      .screenshot({ path: "docs/profit-bridge-preview.png" });
  await page.getByRole("tab", { name: "门店利润", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "门店利润", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByTestId("profit-stores-table").locator("tbody tr"),
  ).toHaveCount(3);
  expect(errors).toEqual([]);
});
test("profit re-runs editable prices, preserves history, and propagates missing costs on mobile", async ({
  page,
}) => {
  await run(page, "/vessel-allocation 供给=1800");
  await run(page, "/delivery-plan 双港");
  await run(page, "/profit-analysis 模拟");
  const before = await page.getByTestId("profit-conclusion").textContent();
  await page.locator(".profit-parameters summary").click();
  await page
    .getByLabel("SIM-SALE-1-1 purchase", { exact: true })
    .fill("200000");
  await page.getByRole("button", { name: "重算利润情景", exact: true }).click();
  await page.clock.runFor(6500);
  await expect(page.getByTestId("profit-conclusion")).toContainText(
    "亏损订单 3 笔",
  );
  await page.getByTestId("canvas-history-toggle").click();
  await page
    .locator(
      '[data-testid="canvas-history-item"][data-run-command="/profit-analysis"]',
    )
    .last()
    .click();
  await expect(page.getByTestId("profit-conclusion")).toHaveText(before!);
  await run(page, "/profit-analysis 整备=待确认");
  await expect(page.getByTestId("profit-conclusion")).toContainText(
    "贡献利润待确认",
  );
  await expect(page.getByTestId("profit-conclusion")).toContainText(
    "费用或价格未齐 6 笔",
  );
  await page.clock.runFor(400);
  await page.reload();
  await expect(page.getByTestId("profit-workspace")).toBeVisible();
  await expect(page.getByTestId("profit-conclusion")).toContainText(
    "贡献利润待确认",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await expect(page.locator(".story-chat")).not.toHaveClass(/open/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  if (process.env.H_VISUAL_REVIEW)
    await page.screenshot({
      path: "docs/profit-mobile-preview.png",
      animations: "disabled",
    });
});
