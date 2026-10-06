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

test("daily rebalance stays gated, then supports approval and inventory locking", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();

  await runSkill(page, "/daily-rebalance", 500);
  await expect(
    page.getByText("前置条件尚未满足", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/库存基线/).last()).toBeVisible();
  await expect(page.getByTestId("story-progress")).toHaveCount(0);
  await expect(page.getByTestId("story-run-block")).toHaveCount(0);

  await seedPublishedCampaign(page);
  await runSkill(page, "/arrival-execution", 12_000);
  await runSkill(page, "/daily-rebalance", 14_000);

  await expect(page.getByTestId("daily-orders")).toContainText("企业大单");
  await expect(page.getByTestId("enterprise-assembly")).toContainText("40");
  await expect(page.getByTestId("enterprise-assembly")).toContainText("24");
  await expect(page.getByTestId("enterprise-assembly")).toContainText("16");
  await expect(page.getByTestId("remote-consolidation")).toContainText("拼单");
  await expect(page.getByTestId("buyback-disabled")).toBeDisabled();

  await page.getByTestId("approve-enterprise").click();
  await expect(page.getByTestId("daily-execution")).toContainText(
    "3 个运输任务",
  );
  await expect(page.getByTestId("daily-execution")).toContainText(
    "80 台已锁定",
  );
});
