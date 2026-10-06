import { expect, test, type Page } from "@playwright/test";
import { seedPublishedCampaign } from "./legacy-campaign-fixture";

async function runSkill(page: Page, command: string, duration = 10_000) {
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText(command, { exact: true }) })
    .click();
  await input.press("Enter");
  await page.clock.runFor(duration);
}

test("daily transfer stays gated, then supports approval and inventory locking", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();

  await runSkill(page, "/daily-transfer", 500);
  await expect(
    page.getByText("前置条件尚未满足", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/库存基线/).last()).toBeVisible();
  await expect(page.getByTestId("story-progress")).toHaveCount(0);
  await expect(page.getByTestId("story-run-block")).toHaveCount(0);

  await seedPublishedCampaign(page);
  await runSkill(page, "/arrival-execution", 12_000);
  await runSkill(page, "/daily-transfer", 14_000);

  await expect(page.getByTestId("transfer-demand-pool")).toContainText(
    "企业大单",
  );
  await expect(
    page.getByTestId("transfer-enterprise-assembly"),
  ).toContainText("40");
  await expect(
    page.getByTestId("transfer-enterprise-assembly"),
  ).toContainText("24");
  await expect(
    page.getByTestId("transfer-enterprise-assembly"),
  ).toContainText("16");
  await expect(page.getByTestId("transfer-dual-impact")).toContainText(
    "安全线",
  );
  await expect(page.getByTestId("transfer-tradeoff")).toContainText(
    "同城调拨",
  );
  await expect(page.getByTestId("transfer-exception-replan")).toContainText(
    "JED-HLX-0455",
  );
  await expect(page.getByTestId("transfer-value-summary")).toContainText(
    "安全线例外",
  );
  await expect(page.getByTestId("transfer-buyback-disabled")).toBeDisabled();

  await page.getByTestId("approve-enterprise").click();
  await expect(page.getByTestId("transfer-execution-docs")).toContainText(
    "3 个任务已释放",
  );
  await expect(page.getByTestId("transfer-execution-docs")).toContainText(
    "80 台已锁定",
  );
});
