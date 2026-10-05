import { expect, test, type Page } from "@playwright/test";

async function runSkill(page: Page, command: string) {
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText(command, { exact: true }) })
    .click();
  await input.press("Enter");
  await page.clock.runFor(14_000);
}

test("product navigation and explainable workbenches show decisions rather than a story wizard", async ({
  page,
}) => {
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await expect(page.locator(".story-sidebar")).not.toContainText("故事进度");
  await expect(page.getByTestId("workspace-project-tree")).toContainText(
    "ALJ · 沙特供应链",
  );
  await runSkill(page, "/crisis-brief");
  await runSkill(page, "/vessel-allocation");
  await expect(page.getByTestId("allocation-decision-model")).toContainText(
    "目标覆盖量 − 可售库存 − 已确认在途 + 订单需求",
  );
  await page.getByTestId("allocation-safety-slider").fill("120");
  await expect(page.getByTestId("allocation-scenario-result")).toContainText(
    "660",
  );
  await expect(page.getByTestId("allocation-scenario-result")).toContainText(
    "620 台订单不变",
  );
  await page.getByTestId("decision-step-1").click();
  await expect(page.getByTestId("decision-detail")).toContainText("硬锁定");
  await runSkill(page, "/delivery-plan");
  await page.getByTestId("capacity-shortfall-toggle").click();
  await expect(page.getByTestId("logistics-scenario-result")).toContainText(
    "80 台待调整",
  );
  await expect(page.getByTestId("logistics-scenario-result")).toContainText(
    "0 台已预订订单受影响",
  );
  await page.getByTestId("logistics-decision-model").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/decision-logistics-desktop.png",
    animations: "disabled",
  });
  await runSkill(page, "/arrival-execution");
  await runSkill(page, "/daily-rebalance");
  await page
    .getByRole("button", { name: "高利润 · Lexus LX", exact: true })
    .click();
  await expect(page.getByTestId("source-comparison")).toContainText("45,200");
  await expect(page.getByTestId("source-comparison")).toContainText(
    "确认车辆权属",
  );
  await page.getByTestId("rebalance-decision-model").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/decision-rebalance-desktop.png",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("applying a safety-stock scenario blocks overloaded routes and supports joint-plan recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await runSkill(page, "/crisis-brief");
  await runSkill(page, "/vessel-allocation");
  await page.getByTestId("allocation-safety-slider").fill("120");
  await page.getByRole("button", { name: "采用参数并准备重跑" }).click();
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(14_000);
  await runSkill(page, "/delivery-plan");
  await expect(page.locator('[data-block-type="joint-publish"]')).toContainText(
    "未发布 · 阻断",
  );
  await expect(page.getByTestId("logistics-scenario-result")).toContainText(
    "20 台待调整",
  );
  await page.getByTestId("canvas-history-toggle").click();
  await page
    .locator(
      '[data-testid="canvas-history-item"][data-run-command="/vessel-allocation"]',
    )
    .first()
    .click();
  await page.getByTestId("allocation-safety-slider").fill("100");
  await page.getByRole("button", { name: "采用参数并准备重跑" }).click();
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(14_000);
  await runSkill(page, "/delivery-plan");
  await expect(page.locator('[data-block-type="joint-publish"]')).toContainText(
    "已发布",
  );
});
