import { expect, test } from "@playwright/test";

test("captures desktop and mobile visual acceptance", async ({ page }) => {
  await page.goto("/");
  await page.clock.install();
  const input = page.getByTestId("story-command");
  await input.fill("/");
  await page.getByTestId("story-skill-option").filter({ hasText: "/crisis-brief" }).click();
  await input.press("Enter");
  await page.clock.runFor(8_000);
  await expect(page.locator(".story-block")).toHaveCount(6);
  await page.screenshot({ path: "docs/new-story-desktop.png", fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId("mobile-chat-toggle").click();
  await expect(page.locator(".story-chat")).toHaveClass(/open/);
  await page.screenshot({ path: "docs/new-story-mobile.png", fullPage: false });
});
