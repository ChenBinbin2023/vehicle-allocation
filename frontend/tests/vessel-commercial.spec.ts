import { expect, test } from "@playwright/test";

test("profit tabs switch charts and details while retaining store and model selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const profit = page.getByRole("region", { name: "利润计算", exact: true });
  const tabs = profit.getByRole("tablist", { name: "利润计算视图" });
  await expect(tabs.getByRole("tab")).toHaveCount(3);
  await expect(
    tabs.getByRole("tab", { name: "单车利润", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await profit.getByLabel("利润车型", { exact: true }).selectOption("Hilux");
  await expect(profit.locator(".vc-unit-profit")).toContainText("Hilux");
  await expect(
    profit.getByRole("heading", { name: "全部门店经营汇总" }),
  ).toHaveCount(0);

  await tabs.getByRole("tab", { name: "车型利润", exact: true }).click();
  await expect(profit.locator(".vc-unit-profit")).toHaveCount(0);
  await expect(
    profit.getByRole("columnheader", { name: "营业额", exact: true }),
  ).toBeVisible();
  await expect(
    profit.getByRole("columnheader", { name: "物流成本", exact: true }),
  ).toBeVisible();
  await expect(profit.locator('tr[data-selected="true"]')).toContainText(
    "Hilux",
  );

  await tabs.getByRole("tab", { name: "门店利润", exact: true }).click();
  await expect(
    profit.getByRole("heading", { name: "全部门店经营汇总" }),
  ).toBeVisible();
  await expect(
    profit.getByRole("columnheader", { name: "本店车型", exact: true }),
  ).toHaveCount(0);
  await expect(
    profit.getByRole("columnheader", { name: "门店", exact: true }),
  ).toBeVisible();
  await profit
    .getByLabel("利润门店", { exact: true })
    .selectOption("MOCK-D-008");

  await tabs.getByRole("tab", { name: "单车利润", exact: true }).click();
  await expect(profit.getByLabel("利润门店", { exact: true })).toHaveValue(
    "MOCK-D-008",
  );
  await expect(profit.getByLabel("利润车型", { exact: true })).toHaveValue(
    "Hilux",
  );
  await expect(profit.locator(".vc-unit-profit")).toContainText("Hilux");
  await expect(
    profit.getByRole("heading", { name: "全部门店经营汇总" }),
  ).toHaveCount(0);
});

test("simulation persists channel pricing, per-store logistics and selectable versions across reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500 预留比例=10%");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const workspace = page.getByTestId("vessel-replenishment");
  await workspace.locator(".vs-advanced > summary").click();
  await workspace.getByRole("tab", { name: "物流参数", exact: true }).click();
  await page.getByLabel("MOCK-D-001 物流系数", { exact: true }).fill("1.4");
  await page.getByLabel("MOCK-D-001 物流系数", { exact: true }).press("Tab");
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await workspace
    .getByRole("button", { name: "运行模拟", exact: true })
    .click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(page.getByTestId("logistics-coefficient-chart")).toBeVisible();
  await workspace.getByRole("tab", { name: "定价参数", exact: true }).click();
  await page.getByLabel("Camry 零售系数", { exact: true }).fill("1.1");
  await page.getByLabel("Camry 零售系数", { exact: true }).press("Tab");
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await workspace
    .getByRole("button", { name: "运行模拟", exact: true })
    .click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V3");
  await expect(
    page.getByTestId("replenishment-graph").locator("ellipse"),
  ).toHaveCount(24);
  await expect(
    page.getByTestId("replenishment-graph").locator("[data-edge]"),
  ).toHaveCount(24);
  await workspace.getByRole("tab", { name: "地图", exact: true }).click();
  await expect(page.getByTestId("replenishment-logistics-map")).toBeVisible();
  await workspace
    .getByRole("tab", { name: "中心 → 门店 · 订单触发", exact: true })
    .click();
  await expect(page.getByTestId("commercial-trip-list")).toContainText(
    "订单触发",
  );
  await expect(page.getByTestId("commercial-profit-summary")).toContainText(
    "预计营业额",
  );
  await expect(
    page.getByTestId("replenishment-graph").locator('[data-node="allocation"]'),
  ).toContainText("车型 17 台");
  await page.getByLabel("计算图车型", { exact: true }).selectOption("Hilux");
  await expect(
    page.getByTestId("replenishment-graph").locator('[data-node="allocation"]'),
  ).toContainText("车型 8 台");
  await page.getByLabel("计算图车型", { exact: true }).selectOption("Camry");
  await page.getByLabel("情景版本", { exact: true }).selectOption("V1");
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await expect(
    workspace.getByRole("button", { name: "运行模拟", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("情景版本", { exact: true }).selectOption("V3");
  await page.clock.runFor(500);
  await page.reload();
  await expect(page.getByTestId("scenario-version")).toHaveText("V3");
  await page.setViewportSize({ width: 390, height: 844 });
  const close = page.getByRole("button", { name: "关闭 CUI", exact: true });
  if (await close.isVisible()) await close.click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("authorized stores have zero fixed expense and an invalid logistics inversion keeps the saved version", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2500 级差=0");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const workspace = page.getByTestId("vessel-replenishment");
  await page
    .getByLabel("计算图门店", { exact: true })
    .selectOption("MOCK-L2-001");
  const graph = page.getByTestId("replenishment-graph");
  await expect(graph.locator('[data-node="unit-fixed"]')).toContainText(
    "0 SAR",
  );
  await expect(graph.locator('[data-node="unit-net"]')).toContainText("批发");
  await graph.locator('[data-node="unit-fixed"]').press("Enter");
  await expect(workspace.locator(".vr-graph-inspector")).toContainText(
    "授权店不扣固定费用",
  );
  await workspace.locator(".vs-advanced > summary").click();
  await workspace.getByRole("tab", { name: "物流参数", exact: true }).click();
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .fill("15000");
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .press("Enter");
  await expect(workspace.getByRole("alert")).toContainText(
    "直营单车净利必须高于授权",
  );
  await expect(
    workspace.getByRole("button", { name: "运行模拟", exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId("scenario-version")).toHaveText("V1");
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .fill("1400");
  await page
    .getByLabel("MOCK-D-001 基准物流成本", { exact: true })
    .press("Enter");
  await workspace
    .getByRole("button", { name: "运行模拟", exact: true })
    .click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await expect(workspace.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("情景版本", { exact: true }).selectOption("V1");
  await expect(
    page.getByLabel("MOCK-D-001 基准物流成本", { exact: true }),
  ).toHaveValue("1197.5");
});
