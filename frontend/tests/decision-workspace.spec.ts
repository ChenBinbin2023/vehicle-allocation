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
}
test("delivery tabs reveal matching results and report unknown receiving dates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.clock.install();
  await expect(page.locator(".story-sidebar")).not.toContainText("故事进度");
  await runSkill(page, "/vessel-allocation");
  await runSkill(page, "/delivery-plan");
  await page.getByRole("tab", { name: "到店批次", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "到店批次", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("store-batch-table")).toContainText("D+14");
  await page.locator(".delivery-parameters > summary").click();
  await page.getByLabel("MOCK-D-001 后续接车时段").fill("");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await page.getByRole("tab", { name: "到店路线", exact: true }).click();
  await expect(page.getByTestId("store-route-table")).toContainText("待确认");
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "待排到店时段 92 台",
  );
  expect(errors).toEqual([]);
});
test("shared VPC capacity shortage is an unresolved simulation, never automatic publication", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await runSkill(page, "/vessel-allocation");
  await runSkill(page, "/delivery-plan");
  await page.locator(".delivery-parameters > summary").click();
  await page.getByLabel("RUH VPC 可用车位").fill("0");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "未落实 661 台",
  );
  await page.getByRole("tab", { name: "港口比较", exact: true }).click();
  await expect(page.getByTestId("port-comparison")).toContainText("待确认");
  await runSkill(page, "/arrival-execution");
  await expect(
    page.getByText("前置条件尚未满足", { exact: true }),
  ).toBeVisible();
});
