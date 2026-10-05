import { expect, test, type Page } from "@playwright/test";

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

test("decision diagrams explain selected nodes and reflect live scenario changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.clock.install();
  await run(page, "/crisis-brief");
  await run(page, "/vessel-allocation");
  const graph = page.getByTestId("allocation-decision-graph");
  await expect(graph).toBeVisible();
  await graph.getByRole("button", { name: "查看 VPC 库存落点" }).click();
  await expect(graph.getByTestId("graph-inspector")).toContainText("680");
  await page.getByTestId("allocation-safety-slider").fill("120");
  await expect(graph.getByTestId("graph-inspector")).toContainText("660");
  await expect(graph).toContainText("620");
  await graph.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/visual-allocation.png",
    animations: "disabled",
  });

  await run(page, "/delivery-plan");
  const map = page.getByTestId("logistics-map");
  await map.getByRole("button", { name: "查看 东部订单直达" }).click();
  await expect(map.getByTestId("map-route-detail")).toContainText("360");
  await expect(map.getByTestId("map-route-detail")).toContainText("7,300");
  await map.getByRole("button", { name: "显示淘汰路径" }).click();
  await expect(map.locator('[data-route-status="rejected"]')).toBeVisible();
  await page.getByTestId("capacity-shortfall-toggle").click();
  await expect(map.getByTestId("map-capacity-alert")).toContainText("80");
  await map.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/visual-logistics.png",
    animations: "disabled",
  });

  await run(page, "/arrival-execution");
  await run(page, "/daily-rebalance");
  await page
    .getByRole("button", { name: "高利润 · Lexus LX", exact: true })
    .click();
  const sources = page.getByTestId("source-decision-graph");
  await sources.getByRole("button", { name: "查看 利雅得授权车商" }).click();
  await expect(sources.getByTestId("graph-inspector")).toContainText(
    "确认车辆权属",
  );
  await expect(sources.locator('[data-edge-status="excluded"]')).toHaveCount(1);
  await sources.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/visual-rebalance.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await expect(sources).toBeVisible();
  const bounds = await sources.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
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
  for (const command of [
    "/crisis-brief",
    "/vessel-allocation",
    "/delivery-plan",
    "/arrival-execution",
    "/daily-rebalance",
  ])
    await run(page, command);
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
