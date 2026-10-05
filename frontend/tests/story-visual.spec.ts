import { expect, test } from "@playwright/test";

test("captures desktop and mobile visual acceptance", async ({ page }) => {
  await page.goto("/");
  await page.clock.install();
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText("/crisis-brief", { exact: true }) })
    .click();
  await input.press("Enter");
  await page.clock.runFor(8_000);
  await expect(page.locator(".story-block")).toHaveCount(6);
  await page.screenshot({
    path: "docs/new-story-desktop.png",
    fullPage: false,
  });

  await input.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText("/vessel-allocation", { exact: true }) })
    .click();
  await input.press("Enter");
  await page.clock.runFor(10_000);
  await page.locator(".decision-model-block").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/decision-allocation-desktop.png",
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator(".decision-model-block").scrollIntoViewIfNeeded();
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
  const blockBounds = await page
    .locator(".decision-model-block")
    .evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      width: element.getBoundingClientRect().width,
    }));
  expect(blockBounds.right).toBeLessThanOrEqual(dimensions.viewport);
  expect(blockBounds.width).toBeLessThanOrEqual(dimensions.viewport - 64);
  await page.screenshot({ path: "docs/new-story-mobile.png", fullPage: false });
});
