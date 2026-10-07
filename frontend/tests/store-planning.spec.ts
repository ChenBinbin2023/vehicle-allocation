import { expect, test, type Page } from "@playwright/test";
async function run(page: Page, prompt = "/vessel-allocation 供给=1800") {
  await page.getByTestId("story-command").fill(prompt);
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(8000);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.clock.install();
});
test("overview uses the source stores and reflects the saved supply scenario", async ({
  page,
}) => {
  await page.getByRole("button", { name: "供应链工作台", exact: true }).click();
  await expect(page.getByTestId("workspace-overview")).toContainText(
    "79 家门店",
  );
  await run(page, "/vessel-allocation 供给=2000");
  await page.getByRole("button", { name: "供应链工作台", exact: true }).click();
  await expect(page.getByTestId("workspace-overview")).toContainText(
    "2,000 台",
  );
  await expect(page.getByTestId("workspace-overview")).toContainText("2,000");
});
test("paused runs keep parameter reruns disabled until resumed", async ({
  page,
}) => {
  await page.getByTestId("story-command").fill("/vessel-allocation 模拟");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(3800);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.locator(".vs-advanced > summary").click();
  await expect(
    page.getByRole("slider", { name: "零售价格系数", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "运行模拟", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "继续", exact: true }).click();
  await page.clock.runFor(8000);
  if ((await page.locator(".vs-advanced").getAttribute("open")) === null)
    await page.locator(".vs-advanced > summary").click();
  await page
    .getByRole("slider", { name: "零售价格系数", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "运行模拟", exact: true }),
  ).toBeEnabled();
});
test("ontology uses ellipses and straight dependencies, with selectable graph nodes and water playback", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await run(page);
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "补库存 1,800 台",
  );
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  await page.getByText("品牌注水情景 · 原分车图谱", { exact: true }).click();
  const graph = page.getByTestId("allocation-graph");
  await expect(graph.locator("ellipse")).toHaveCount(19);
  await expect(graph.locator("circle,path")).toHaveCount(0);
  await expect(graph.locator("line")).toHaveCount(28);
  await graph.getByRole("button", { name: "B3 库存宽表", exact: true }).click();
  await expect(page.getByTestId("graph-inspector")).toContainText(
    "订单车先保障",
  );
  await graph.getByRole("button", { name: /需求合并/ }).click();
  await expect(page.getByTestId("graph-inspector")).toContainText(
    "需求合并宽表",
  );
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.getByRole("tab", { name: "分车计划模拟" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByTestId("water-assigned")).toHaveText("0");
  await page.getByRole("button", { name: "下一步注水" }).click();
  await expect(page.getByTestId("water-assigned")).toHaveText("23");
  await page.getByRole("button", { name: "播放注水", exact: true }).click();
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "暂停注水", exact: true }).click();
  const paused = await page.getByTestId("water-progress").textContent();
  await page.clock.runFor(1000);
  await expect(page.getByTestId("water-progress")).toHaveText(paused!);
  await page.getByRole("button", { name: "查看最终水位" }).click();
  await expect(page.getByTestId("water-assigned")).toHaveText("1,800");
  await expect(page.locator(".water-bar")).toHaveCount(79);
  await page.getByLabel("注水进度").press("Home");
  await expect(page.getByTestId("water-assigned")).toHaveText("0");
  await page.getByRole("tab", { name: "门店结果", exact: true }).click();
  await expect(
    page.getByTestId("store-allocation-table").locator("tbody tr"),
  ).toHaveCount(79);
  await expect(page.getByTestId("allocation-MOCK-D-001")).toContainText("68.5");
  await expect(page.getByTestId("allocation-MOCK-D-001")).toContainText("119");
  expect(errors).toEqual([]);
});
test("editable order assumptions and source brand filters rerun without mutating history", async ({
  page,
}) => {
  await run(page);
  await page.locator(".allocation-parameters summary").click();
  await page.getByLabel("MOCK-D-001 未配订单", { exact: true }).fill("100");
  await page.getByLabel("供给数量", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "先分订单 100 台",
  );
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "补库存 1,400 台",
  );
  await page.getByTestId("canvas-history-toggle").click();
  await page
    .locator(
      '[data-testid="canvas-history-item"][data-run-command="/vessel-allocation"]',
    )
    .last()
    .click();
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "补库存 1,800 台",
  );
  await page.locator(".allocation-parameters summary").click();
  await page.getByLabel("分车品牌", { exact: true }).selectOption("雷克萨斯");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.locator(".planning-context")).toContainText("20 家门店");
  await page.getByRole("tab", { name: "门店结果" }).click();
  await expect(
    page.getByTestId("store-allocation-table").locator("tbody tr"),
  ).toHaveCount(20);
  await page.clock.runFor(300);
  await page.reload();
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await expect(page.locator(".planning-context")).toContainText("20 家门店");
});
test("source logistics keeps partial receiving and unknown total costs explicit on mobile", async ({
  page,
}) => {
  await run(page);
  await page
    .getByRole("button", { name: "生成到店物流模拟", exact: true })
    .click();
  await page.clock.runFor(8000);
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "首批直送 557 台",
  );
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "经 VPC 1,070 台",
  );
  await page.locator(".delivery-parameters > summary").click();
  await page.getByLabel("MOCK-D-001 后续接车时段", { exact: true }).fill("");
  await page.getByRole("button", { name: "模拟重跑", exact: true }).click();
  await page.clock.runFor(8000);
  await expect(page.getByTestId("planning-conclusion")).toContainText(
    "待排到店时段 92 台",
  );
  await page.getByRole("tab", { name: "港口比较", exact: true }).click();
  await expect(page.getByTestId("port-comparison")).toContainText(
    "干线运费小计",
  );
  await expect(page.getByTestId("port-comparison")).toContainText("待确认");
  await page.getByRole("tab", { name: "到店批次", exact: true }).click();
  await expect(page.getByTestId("store-batch-table")).toContainText(
    "干线摊分单台费",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
