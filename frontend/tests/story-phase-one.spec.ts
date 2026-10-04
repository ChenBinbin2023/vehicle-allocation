import { expect, test, type Page } from "@playwright/test";

async function runSkill(page: Page, command: string) {
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ hasText: command })
    .click();
  await input.press("Enter");
}

test("phase one streams four workbenches and conserves all 1800 vehicles", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();

  await runSkill(page, "/crisis-brief");
  await page.clock.runFor(900);
  const partialCount = await page.locator(".story-block").count();
  expect(partialCount).toBeGreaterThan(0);
  expect(partialCount).toBeLessThan(6);
  await page.clock.runFor(8_000);
  await expect(page.locator(".story-block")).toHaveCount(6);

  await runSkill(page, "/vessel-allocation");
  await page.clock.runFor(10_000);
  await expect(page.getByTestId("allocation-pools")).toContainText("620");
  await expect(page.getByTestId("allocation-pools")).toContainText("1,180");

  await runSkill(page, "/delivery-plan");
  await page.clock.runFor(10_000);
  const routes = page.getByTestId("route-counts");
  for (const quantity of ["520", "650", "360", "170", "100"]) {
    await expect(routes).toContainText(quantity);
  }
  await runSkill(page, "/arrival-execution");
  await expect(page.getByTestId("stage-execution")).toBeEnabled();
  await expect(page.locator(".story-run-state")).toContainText("Agent 运行中");
  await page.clock.runFor(12_000);
  await expect(page.getByTestId("final-conservation")).toContainText("1,800");
  await expect(page.getByTestId("inventory-baseline")).toContainText("1,180");
  await page.getByTestId("stage-allocation").click();
  await expect(page.getByTestId("raise-dammam-safety")).toHaveCount(0);
  await expect(page.getByText("只读运行快照", { exact: true })).toBeVisible();
});

test("allocation parameter changes invalidate the snapshot and preserve run history", async ({ page }) => {
  await page.goto("/");
  await page.clock.install();

  await runSkill(page, "/crisis-brief");
  await page.clock.runFor(10_000);
  await runSkill(page, "/vessel-allocation");
  await page.clock.runFor(10_000);
  await page.getByTestId("raise-dammam-safety").click();
  await expect(page.locator(".story-run-state")).toContainText("输入已变更");
  await expect(page.getByText(/CUI 重新运行 \/vessel-allocation/)).toBeVisible();

  await runSkill(page, "/vessel-allocation");
  await page.clock.runFor(10_000);
  await expect(page.getByTestId("run-history-select")).toBeVisible();
  await expect(page.getByText("达曼 VPC · 120", { exact: true })).toBeVisible();
  await page.getByTestId("run-history-select").selectOption({ index: 0 });
  await expect(page.locator(".story-run-state")).toContainText("输入已变更");
  await expect(page.getByTestId("raise-dammam-safety")).toHaveCount(0);
});
