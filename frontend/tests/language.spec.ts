import { expect, test, type Page } from "@playwright/test";

async function selectLanguage(page: Page, language: "English" | "简体中文") {
  await page.getByTestId("account-menu-toggle").click();
  await page.getByTestId("language-menu-toggle").click();
  await page
    .getByRole("menuitemradio", { name: language, exact: true })
    .click();
}

test("account menu switches the whole workspace and remembers the language", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("cui-welcome")).toContainText(
    "我们该处理什么工作?",
  );
  await page
    .getByTestId("story-command")
    .fill("保留这段输入 / keep this draft");
  await selectLanguage(page, "English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("cui-welcome")).toContainText(
    "What should we work on?",
  );
  await expect(
    page.getByRole("button", { name: "New task", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("story-command")).toHaveValue(
    "保留这段输入 / keep this draft",
  );
  await page
    .getByRole("button", { name: "Plugins", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Plugins & Skills" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Daily dispatch plan");
  await page
    .getByRole("button", { name: "Close plugins", exact: true })
    .click();
  await page.reload();
  await expect(page.getByTestId("cui-welcome")).toContainText(
    "What should we work on?",
  );
  await selectLanguage(page, "简体中文");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("cui-welcome")).toContainText(
    "我们该处理什么工作?",
  );
});

test("English Skill prompts run and changing languages preserves the analysis", async ({
  page,
}) => {
  await page.goto("/");
  await selectLanguage(page, "English");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ hasText: "/daily-dispatch" })
    .click();
  await expect(page.getByTestId("story-command")).toHaveValue(
    /\/daily-dispatch [A-Za-z]/,
  );
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(20000);
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await expect(page.getByTestId("daily-dispatch")).toContainText(
    "Regional shortages",
  );
  const userMessage = await page.getByTestId("story-user-message").innerText();
  await selectLanguage(page, "简体中文");
  await expect(page.getByTestId("daily-dispatch")).toContainText("区域缺货");
  await expect(page.getByTestId("story-user-message")).toHaveText(userMessage);
  await selectLanguage(page, "English");
  await expect(page.getByTestId("daily-dispatch")).toContainText(
    "Regional shortages",
  );
});

test("language menu is keyboard accessible on a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByTestId("account-menu-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("language-menu-toggle")).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitemradio", { name: "English", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cui-welcome")).toContainText(
    "What should we work on?",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByTestId("account-menu-toggle").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("account-menu-toggle")).toBeFocused();
  await expect(page.getByTestId("account-menu")).toHaveCount(0);
});

test("English brand and channel filters retain their original business values", async ({
  page,
}) => {
  await page.goto("/");
  await selectLanguage(page, "English");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/order-allocation");
  await page.getByTestId("story-command").press("Escape");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(20000);
  const brand = page.getByLabel("Order brand", { exact: true });
  await brand.selectOption({ label: "Lexus" });
  await expect(page.getByTestId("vessel-orders")).not.toContainText(
    "No matching stores",
  );
  await expect(
    page.getByTestId("vessel-orders").locator("[data-store-bubble]").first(),
  ).toBeVisible();
  await page
    .getByLabel("Order channel", { exact: true })
    .selectOption({ label: "Direct" });
  await expect(
    page.getByTestId("vessel-orders").locator("[data-store-bubble]").first(),
  ).toBeVisible();
});

test("English agent notices translate while user messages remain unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await selectLanguage(page, "English");
  await page.getByTestId("story-command").fill("/unknown 保留用户输入");
  await page.getByTestId("story-command").press("Escape");
  await page.getByTestId("story-command").press("Enter");
  await expect(page.getByTestId("story-agent-message")).not.toContainText(
    /[\u4e00-\u9fff]/,
  );
  await expect(page.getByTestId("story-user-message")).toHaveText(
    "/unknown 保留用户输入",
  );
});

test("existing Chinese prompt titles switch language in both navigation and canvas after reload", async ({
  page,
}) => {
  const prompt =
    "/query 查看截至 2026-08-05 的本船供给、订单缺口、全网销速与库存基本统计。";
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill(prompt);
  await page.getByTestId("story-command").press("Escape");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(20000);
  await expect(page.getByTestId("workspace-session")).toContainText("查看截至");
  await selectLanguage(page, "English");
  await expect(page.getByTestId("workspace-session")).not.toContainText(
    /[\u4e00-\u9fff]/,
  );
  await expect(
    page.locator(".workspace-canvas-toolbar strong"),
  ).not.toContainText(/[\u4e00-\u9fff]/);
  await expect(page.getByTestId("story-user-message")).toHaveText(prompt);
  await page.reload();
  await expect(page.getByTestId("workspace-session")).not.toContainText(
    /[\u4e00-\u9fff]/,
  );
  await expect(page.locator(".workspace-canvas-toolbar strong")).toContainText(
    "2026-08-05",
  );
  await expect(page.getByTestId("story-user-message")).toHaveText(prompt);
  await selectLanguage(page, "简体中文");
  await expect(page.getByTestId("workspace-session")).toContainText("查看截至");
});

test("English chart descriptions and expanded process labels do not mix languages", async ({
  page,
}) => {
  await page.goto("/");
  await selectLanguage(page, "English");
  await page.clock.install();
  const command = page.getByTestId("story-command");
  for (const skill of [
    "/query",
    "/smart-query",
    "/daily-dispatch",
    "/order-allocation",
  ]) {
    await command.fill(skill);
    await command.press("Escape");
    await command.press("Enter");
    await page.clock.runFor(20000);
    const descriptions = await page
      .locator(
        ".vo-line-datum, .query-line-chart circle[aria-label], .cui-step-detail",
      )
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")),
      );
    expect(descriptions.length).toBeGreaterThan(0);
    for (const description of descriptions)
      expect(description).not.toMatch(/[\u4e00-\u9fff]/);
    if (skill === "/query") {
      await page.locator(".vo-line-datum").first().focus();
      await expect(page.locator(".vo-tooltip").first()).not.toContainText(
        /[\u4e00-\u9fff]/,
      );
    }
  }
});
