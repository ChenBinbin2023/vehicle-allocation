import { expect, test, type Page } from "@playwright/test";
async function runSkill(page: Page, command: string) {
  await page
    .getByTestId("story-command")
    .fill(
      command === "/vessel-allocation"
        ? command + " 供给=1800 直营WoS=3 授权WoS=4"
        : command + " 模拟",
    );
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(8000);
  if (command === "/vessel-allocation")
    await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
}
test("store simulation preserves all assigned cars and cannot fabricate arrival execution", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await runSkill(page, "/crisis-brief");
  await expect(page.locator(".story-block")).toHaveCount(6);
  await runSkill(page, "/vessel-allocation");
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "先分订单 0 台",
  );
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "补库存 1,800 台",
  );
  await runSkill(page, "/delivery-plan");
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "首批直送 557 台",
  );
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "经 VPC 1,070 台",
  );
  await runSkill(page, "/arrival-execution");
  await expect(
    page.getByText("前置条件尚未满足", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("final-conservation")).toHaveCount(0);
  await page.getByTestId("canvas-history-toggle").click();
  await page
    .locator(
      '[data-testid="canvas-history-item"][data-run-command="/vessel-allocation"]',
    )
    .click();
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  await page.getByText("品牌注水情景 · 原分车图谱", { exact: true }).click();
  await expect(page.getByTestId("allocation-graph")).toBeVisible();
});
test("channel targets alter waterfill while the old canvas retains its own parameters", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await runSkill(page, "/vessel-allocation");
  await page.locator(".allocation-parameters summary").click();
  await page.getByLabel("授权目标 WoS", { exact: true }).fill("3");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await page.locator(".allocation-parameters summary").click();
  await expect(page.getByLabel("授权目标 WoS", { exact: true })).toHaveValue(
    "3",
  );
  await page.getByTestId("canvas-history-toggle").click();
  await page
    .locator(
      '[data-testid="canvas-history-item"][data-run-command="/vessel-allocation"]',
    )
    .last()
    .click();
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.getByLabel("授权目标 WoS", { exact: true })).toHaveValue(
    "4",
  );
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  await page.getByText("品牌注水情景 · 原分车图谱", { exact: true }).click();
  await expect(page.getByTestId("allocation-graph")).toContainText("授权 4 周");
});
