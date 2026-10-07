import { expect, test } from "@playwright/test";

test("collapsing navigation gives the canvas more space and keeps navigation usable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "供应链工作台", exact: true }).click();
  const canvas = page.locator("main.story-canvas");
  const before = (await canvas.boundingBox())!.width;
  await page.getByRole("button", { name: "收起导航", exact: true }).click();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(before + 150);
  await page
    .getByRole("button", { name: "数据与业务规则", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "每个判断都有来源" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "展开导航", exact: true }).click();
  await expect(page.getByTestId("workspace-project-tree")).toContainText(
    "分车计划",
  );
});

test("closing the desktop CUI expands the canvas and preserves an unfinished command", async ({
  page,
}) => {
  await page.goto("/");
  const command = page.getByTestId("story-command");
  await command.fill("/smart-query 查看月度销量");
  await page.getByRole("button", { name: "供应链工作台", exact: true }).click();
  const canvas = page.locator("main.story-canvas");
  const before = (await canvas.boundingBox())!.width;
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await expect(command).not.toBeVisible();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(before + 300);
  await page
    .getByRole("button", { name: "打开 Agent CUI", exact: true })
    .click();
  await expect(command).toHaveValue("/smart-query 查看月度销量");
});

test("query filters can be tucked away without losing the selected scope", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/smart-query 查看月度销量");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  const toggle = page.getByRole("button", {
    name: "展开分析筛选",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByLabel("渠道", { exact: true }).selectOption("直营");
  await page.getByRole("button", { name: "收起分析筛选", exact: true }).click();
  await expect(page.getByTestId("query-scope")).toContainText("34 家门店");
  await expect(page.getByTestId("query-sales-chart")).toBeVisible();
  await toggle.click();
  await expect(page.getByLabel("渠道", { exact: true })).toHaveValue("直营");
  await page.getByLabel("门店", { exact: true }).selectOption("MOCK-D-001");
  await page.getByLabel("汇总维度", { exact: true }).selectOption("store");
  await page.getByRole("button", { name: "收起分析筛选", exact: true }).click();
  await expect(toggle).toContainText("直营·利雅得·01店");
  await expect(toggle).toContainText("按门店汇总");
  await toggle.click();
  await page.getByLabel("服务 VPC", { exact: true }).selectOption("JED");
  await page.getByRole("button", { name: "收起分析筛选", exact: true }).click();
  await expect(toggle).toContainText("吉达 VPC");
});

test("transport quotation ranges fit inside the phone metric card", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/smart-query 查看月度销量");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await page.getByRole("tab", { name: "陆路运输成本", exact: true }).click();
  const quote = page
    .locator(".query-metric")
    .filter({ hasText: "路线整趟报价" });
  const bounds = await quote.locator("strong").evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const card = element.closest("article")!.getBoundingClientRect();
    return { textRight: text.right, cardRight: card.right };
  });
  expect(bounds.textRight).toBeLessThanOrEqual(bounds.cardRight - 8);
});

test("monthly chart labels stay readable when the canvas narrows to a phone", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/smart-query 查看月度销量");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  const chart = page.getByTestId("query-sales-chart");
  await expect
    .poll(async () =>
      chart
        .locator("svg text")
        .first()
        .evaluate((element) => {
          const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
          return (
            parseFloat(getComputedStyle(element).fontSize) *
            Math.hypot(matrix.a, matrix.b)
          );
        }),
    )
    .toBeGreaterThanOrEqual(11);
  const monthLabels = await chart.locator("svg text").evaluateAll((elements) =>
    elements
      .filter((element) => /月$/.test(element.textContent ?? ""))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      }),
  );
  for (let index = 1; index < monthLabels.length; index++) {
    expect(monthLabels[index].left).toBeGreaterThanOrEqual(
      monthLabels[index - 1].right + 4,
    );
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await chart
    .getByRole("button", { name: "2026-07 总量历史 8,901 台", exact: true })
    .focus();
  await expect(chart.locator(".query-chart-readout")).toContainText("8,901");
});
