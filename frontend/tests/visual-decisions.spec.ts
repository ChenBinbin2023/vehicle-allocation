import { expect, test, type Page } from "@playwright/test";
import { seedPublishedCampaign } from "./legacy-campaign-fixture";

async function run(page: Page, command: string) {
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText(command, { exact: true }) })
    .click();
  await input.press("Enter");
  await page.clock.runFor(14_000);
}

test("store water levels and route splits stay readable on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.clock.install();
  await run(page, "/vessel-allocation");
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  await page.getByText("品牌注水情景 · 原分车图谱", { exact: true }).click();
  await expect(page.getByTestId("allocation-graph")).toBeVisible();
  await page
    .getByTestId("allocation-graph")
    .screenshot({ path: "docs/visual-allocation-graph.png" });
  await page.getByRole("tab", { name: "注水演示", exact: true }).click();
  await page.getByRole("button", { name: "查看最终水位", exact: true }).click();
  await expect(page.getByTestId("water-assigned")).toHaveText("1,800");
  await page
    .getByTestId("waterfill-player")
    .screenshot({ path: "docs/visual-waterfill.png" });
  await page.screenshot({
    path: "docs/visual-allocation.png",
    animations: "disabled",
  });
  await run(page, "/delivery-plan");
  await page.getByRole("tab", { name: "到店路线", exact: true }).click();
  await expect(page.locator(".planning-route-cards")).toContainText(
    "经 RUH VPC 84 台",
  );
  await page.getByRole("tab", { name: "港口比较", exact: true }).click();
  await expect(page.getByTestId("port-comparison")).toContainText(
    "干线运费小计",
  );
  await page.screenshot({
    path: "docs/visual-logistics.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await expect(page.getByTestId("store-planning-workspace")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "docs/visual-mobile.png",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("unavailable repeated-day sources do not appear as executable fulfillment", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await seedPublishedCampaign(page);
  await run(page, "/arrival-execution");
  await run(page, "/daily-rebalance");
  await page.getByTestId("approve-premium").click();
  await run(page, "/daily-rebalance");
  await page
    .getByRole("button", { name: "高利润 · Lexus LX", exact: true })
    .click();
  const graph = page.getByTestId("source-decision-graph");
  await graph.getByRole("button", { name: "查看 Lexus LX 订单" }).click();
  await expect(graph.getByTestId("graph-inspector")).toContainText(
    "可执行数量0 台",
  );
  await expect(graph.getByTestId("graph-inspector")).toContainText(
    "未形成可执行收益",
  );
  await expect(graph.locator('[data-edge-status="excluded"]')).toHaveCount(4);
  await expect(page.locator(".order-recommendation")).toContainText(
    "原建议 · 未通过",
  );
  await graph.getByRole("button", { name: "查看 待关闭执行条件" }).click();
  await expect(graph.getByTestId("graph-inspector")).toContainText(
    "历史运输任务",
  );
  await expect(graph.getByTestId("graph-inspector")).not.toContainText(
    "回购只能作为候选",
  );
  await page
    .getByRole("button", { name: "偏远地区 · Hilux", exact: true })
    .click();
  await graph.getByRole("button", { name: "查看 待关闭执行条件" }).click();
  await expect(graph.getByTestId("graph-inspector")).toContainText(
    "超过 4 天承诺",
  );
  await expect(graph.getByTestId("graph-inspector")).not.toContainText(
    "付款授权",
  );
});
