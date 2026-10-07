import { expect, test } from "@playwright/test";

const followup =
  "/skill， 针对所有的缺货，基于选择的方案，生成调度建议，以及授权店采购订单";

test("per-car choices survive reload and the follow-up skill appends two document tabs to the same page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.clock.install();
  const command = page.getByTestId("story-command");
  await command.fill("/daily-dispatch 整理今天订单");
  await command.press("Enter");
  await page.clock.runFor(15000);
  await expect(page.getByTestId("dispatch-selection-count")).toHaveText(
    "已选 0 / 6 台",
  );
  await expect(
    page.getByRole("button", { name: "生成调度建议与采购订单", exact: true }),
  ).toBeEnabled();
  for (let i = 0; i < 6; i++) {
    await page.getByTestId("dispatch-shortage-item").nth(i).click();
    await page
      .getByTestId("dispatch-option")
      .filter({ hasText: "本区域授权店采购" })
      .getByRole("button", { name: "选择此方案", exact: true })
      .click();
  }
  await expect(page.getByTestId("dispatch-selection-count")).toHaveText(
    "已选 6 / 6 台",
  );
  await page.clock.runFor(300);
  await page.reload();
  await expect(page.getByTestId("dispatch-selection-count")).toHaveText(
    "已选 6 / 6 台",
  );
  await expect(
    page.getByRole("button", { name: "已选择此方案", exact: true }),
  ).toBeVisible();
  await command.fill("/daily-dispatch 生成另一份未选择的计划");
  await command.press("Enter");
  await page.clock.runFor(15000);
  await page.getByTestId("canvas-history-toggle").click();
  await page.locator('[data-run-command="/daily-dispatch"]').last().click();
  await command.fill("/shortage-fulfillment");
  await expect(page.getByTestId("story-skill-option")).toContainText("可运行");
  await command.fill(followup);
  await command.press("Enter");
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(4);
  await page.clock.runFor(10000);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(5);
  await expect(page.getByTestId("dispatch-fulfillment")).toBeVisible();
  await expect(page.getByTestId("dispatch-instruction")).toHaveCount(6);
  await page.getByRole("tab", { name: "授权店采购订单", exact: false }).click();
  await expect(page.getByTestId("dispatch-purchase-order")).toHaveCount(5);
  await expect(
    page.getByTestId("dispatch-purchase-order").first(),
  ).toContainText("2 台");
  await expect(page.getByTestId("dispatch-purchase-line")).toHaveCount(6);
  await page.getByRole("tab", { name: "缺货调度建议", exact: false }).click();
  await expect(page.getByTestId("dispatch-instruction")).toHaveCount(6);
  await page.getByTestId("dispatch-shortage-item").first().click();
  await page
    .getByTestId("dispatch-option")
    .filter({ hasText: "跨区域调拨" })
    .getByRole("button", { name: "选择此方案", exact: true })
    .click();
  await expect(page.getByTestId("dispatch-fulfillment-stale")).toBeVisible();
  await page
    .getByRole("button", { name: "生成调度建议与采购订单", exact: true })
    .click();
  await page.clock.runFor(10000);
  await expect(page.getByTestId("dispatch-fulfillment-stale")).toHaveCount(0);
  await expect(page.getByTestId("dispatch-instruction").first()).toContainText(
    "跨区域调拨",
  );
  expect(errors).toEqual([]);
});

test("the compact shortage chooser and generated tabs stay usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/daily-dispatch 整理今日订单");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(15000);
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await page
    .getByRole("button", { name: "填入最高利润方案", exact: true })
    .click();
  await expect(page.getByTestId("dispatch-selection-count")).toHaveText(
    "已选 6 / 6 台",
  );
  await page
    .getByTestId("dispatch-option")
    .filter({ hasText: "本区域授权店采购" })
    .getByRole("button", { name: "选择此方案", exact: true })
    .click();
  await page
    .getByRole("button", { name: "生成调度建议与采购订单", exact: true })
    .click();
  await page.clock.runFor(10000);
  await page.getByRole("tab", { name: "授权店采购订单", exact: false }).click();
  await expect(
    page.getByTestId("dispatch-purchase-order").first(),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("the fulfillment skill runs without manual choices and saves the highest-profit defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  const input = page.getByTestId("story-command");
  await input.fill("/daily-dispatch 整理今天订单");
  await input.press("Enter");
  await page.clock.runFor(15000);
  await input.fill("/shortage-fulfillment");
  await expect(page.getByTestId("story-skill-option")).toContainText("可运行");
  await input.fill(followup);
  await input.press("Enter");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("dispatch-instruction")).toHaveCount(6);
  await expect(page.getByTestId("dispatch-instruction").first()).toContainText(
    "跨区域调拨",
  );
  await expect(page.getByTestId("dispatch-instruction").first()).toContainText(
    "20,568 SAR",
  );
  await expect(page.getByTestId("dispatch-selection-count")).toHaveText(
    "已选 6 / 6 台",
  );
  await expect(page.locator(".story-run-answer").last()).toContainText(
    "默认采用贡献利润最高",
  );
  await page.clock.runFor(300);
  await page.reload();
  await expect(page.getByTestId("dispatch-instruction").first()).toContainText(
    "20,568 SAR",
  );
  await expect(page.getByTestId("dispatch-fulfillment-stale")).toHaveCount(0);
});
