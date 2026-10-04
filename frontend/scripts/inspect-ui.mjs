import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1512, height: 982 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await expect(page.getByRole("heading", { name: "供需总览" })).toBeVisible();
await page.screenshot({ path: "docs/overview.png", animations: "disabled" });
await page.getByLabel("输入任务或追问").fill("/");
await page.screenshot({ path: "docs/skills-menu.png", animations: "disabled" });
await page
  .getByRole("listbox")
  .getByRole("option")
  .filter({ hasText: "/capacity-check" })
  .click();
await page.getByRole("button", { name: "发送消息", exact: true }).click();
await page.waitForTimeout(1300);
await page
  .getByRole("button", { name: "暂停执行", exact: true })
  .last()
  .click();
await page.screenshot({
  path: "docs/skill-stream.png",
  animations: "disabled",
});
await page
  .getByRole("button", { name: "继续执行", exact: true })
  .last()
  .click();
await expect(page.locator(".skill-run")).toHaveAttribute(
  "data-status",
  "complete",
  { timeout: 20000 },
);
await page.getByRole("button", { name: /查看共同路线资源/ }).click();
await page.screenshot({
  path: "docs/skill-result.png",
  animations: "disabled",
});
const nav = page.getByRole("navigation", { name: "业务工作区" });
await nav.getByRole("button", { name: "周度分货", exact: true }).click();
await page.screenshot({ path: "docs/planning.png", animations: "disabled" });
await nav.getByRole("button", { name: "每日调拨", exact: true }).click();
await page.locator(".transfer-selector button").nth(2).click();
await page.screenshot({ path: "docs/transfers.png", animations: "disabled" });
const desktopOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await page.screenshot({ path: "docs/mobile.png", animations: "disabled" });
console.log(
  JSON.stringify({
    errors,
    desktopOverflow,
    mobileOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    mobileChatVisible: await page.locator(".supply-cui").isVisible(),
  }),
);
await browser.close();
