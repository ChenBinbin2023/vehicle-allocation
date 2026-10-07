import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("atlas-single-port-workspace");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

test("CUI streams the query into three linked analytical tabs", async ({
  page,
}) => {
  const command = page.getByTestId("story-command");
  await command.fill("/smart-query 查看月度销量、库存和陆路运输成本");
  await expect(page.getByTestId("smart-query-workspace")).toHaveCount(0);
  await command.press("Enter");
  await expect(page.getByRole("tab", { name: /销量与预测/ })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(page.getByTestId("query-sales-chart")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".query-run-status")).toContainText("已完成", {
    timeout: 15000,
  });
  await expect(page.locator(".story-chat-body")).toContainText("ReadFile");
  await expect(page.locator(".story-chat-body")).toContainText("执行计划");
  await expect(page.locator(".story-run-answer")).toContainText("6,709");

  await page.getByRole("tab", { name: /库存与渠道/ }).click();
  await expect(page.getByTestId("query-physical-stock")).toContainText("6,709");
  await page.getByRole("button", { name: "展开分析筛选", exact: true }).click();
  await page.getByLabel("渠道", { exact: true }).selectOption("直营");
  await expect(page.getByTestId("query-scope")).toContainText("34 家门店");
  await page.getByLabel("区域", { exact: true }).selectOption("东部");
  await expect(page.getByTestId("query-inventory-table")).toBeVisible();

  await page.getByRole("tab", { name: /陆路运输成本/ }).click();
  await expect(page.getByTestId("query-route-table")).toBeVisible();
  await expect(page.getByTestId("query-transport-chart")).toHaveCount(0);
  await expect(
    page.getByText("按销量估算运输费用", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.getByTestId("query-capacity")).toContainText("3,226");
  await page.getByLabel("运输场景").selectOption("west");
  await expect(page.getByTestId("query-capacity")).toContainText("1,865");
  await page.getByRole("tab", { name: /库存与渠道/ }).click();
  await expect(page.getByRole("tab", { name: /库存与渠道/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.reload();
  await expect(page.getByTestId("smart-query-workspace")).toBeVisible();
  await expect(page.locator(".query-run-status")).toContainText("已完成");
});

test("sales curves switch dimension and allow selecting stores beyond the default top five", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.getByTestId("story-command").fill("/smart-query 查看月度销量");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  const chart = page.getByTestId("query-sales-chart");
  await page.getByRole("button", { name: "展开分析筛选", exact: true }).click();
  const dimension = page.getByLabel("汇总维度", { exact: true });
  await expect(dimension).toHaveValue("total");
  await expect(
    chart.getByRole("button", {
      name: "2026-07 总量历史 8,901 台",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    chart.getByRole("button", {
      name: "2026-07 总量预测 8,901 台",
      exact: true,
    }),
  ).toHaveCount(0);
  await chart
    .getByRole("button", { name: "2026-07 总量历史 8,901 台", exact: true })
    .focus();
  await expect(chart.locator(".query-chart-readout")).not.toContainText("预测");
  await dimension.selectOption("region");
  await expect(
    chart.getByRole("button", {
      name: "2026-07 西部历史 3,060 台",
      exact: true,
    }),
  ).toHaveCount(1);
  await dimension.selectOption("vpc");
  await expect(
    chart.getByRole("button", {
      name: "2026-07 吉达 VPC历史 4,067 台",
      exact: true,
    }),
  ).toHaveCount(1);
  await dimension.selectOption("store");
  await expect(
    chart.getByRole("button", { name: /2026-07 .*历史/ }),
  ).toHaveCount(5);
  await page.getByText("选择趋势门店", { exact: false }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(5);
  await page.getByRole("button", { name: "清空选择", exact: true }).click();
  await expect(chart).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "直营·利雅得·02店", exact: true })
    .check();
  await expect(
    page.getByTestId("query-sales-chart").getByRole("button", {
      name: "2026-07 直营·利雅得·02店历史 251 台",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page
      .getByTestId("query-sales-chart")
      .getByRole("button", { name: /2026-07 .*历史/ }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: /库存与渠道/ }).click();
  await page.getByRole("tab", { name: /销量与预测/ }).click();
  await expect(
    page
      .getByTestId("query-sales-chart")
      .getByRole("button", { name: /2026-07 .*历史/ }),
  ).toHaveCount(1);
  await page.getByText("选择趋势门店", { exact: false }).click();
  await page.getByRole("button", { name: "恢复前 5 家", exact: true }).click();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(5);
  await page.getByLabel("区域", { exact: true }).selectOption("东部");
  await expect(
    page.getByTestId("query-sales-chart").getByRole("button", {
      name: "2026-07 直营·胡拜尔·01店历史 270 台",
      exact: true,
    }),
  ).toHaveCount(1);
});

test("transport map selects source routes and follows scenario and store filters", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await page.getByTestId("story-command").fill("/smart-query 查看物流路线");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  await page.getByRole("tab", { name: /陆路运输成本/ }).click();
  const map = page.getByTestId("query-route-map");
  await expect(map).toBeVisible();
  await expect(map.locator("[data-route-id]")).toHaveCount(18);
  await expect(map.locator("[data-origin-id]")).toHaveCount(2);
  const shortRoute = map.locator('[data-route-id="P-E-KHO"]');
  await shortRoute.scrollIntoViewIfNeeded();
  const shortRoutePoint = await shortRoute
    .locator(".query-map-route-line")
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const midpoint = path.getPointAtLength(path.getTotalLength() / 2);
      const hub = path
        .ownerSVGElement!.querySelector<SVGRectElement>(
          '[data-origin-id="P-E"] rect',
        )!
        .getBBox();
      const screen = midpoint.matrixTransform(path.getScreenCTM()!);
      return {
        outsideHub:
          midpoint.x < hub.x ||
          midpoint.x > hub.x + hub.width ||
          midpoint.y < hub.y ||
          midpoint.y > hub.y + hub.height,
        x: screen.x,
        y: screen.y,
      };
    });
  await expect(shortRoutePoint.outsideHub).toBe(true);
  await page.mouse.click(shortRoutePoint.x, shortRoutePoint.y);
  await expect(page.getByTestId("query-route-detail")).toContainText("P-E-KHO");
  await expect(page.getByTestId("query-route-detail")).not.toContainText(
    "同城接驳",
  );
  await map
    .getByRole("button", { name: "路线 P-E-RUH：达曼 → 利雅得", exact: true })
    .press("Enter");
  const detail = page.getByTestId("query-route-detail");
  await expect(detail).toContainText("P-E-RUH");
  await expect(detail).toContainText("2,158");
  await expect(page.getByLabel("地图路线", { exact: true })).toHaveValue(
    "P-E-RUH",
  );
  await page.getByLabel("运输场景").selectOption("west");
  await expect(map.locator("[data-route-id]")).toHaveCount(18);
  await expect(map.locator("[data-origin-id]")).toHaveCount(1);
  await expect(map.getByRole("button", { name: /路线 P-E-/ })).toHaveCount(0);
  await page.getByLabel("地图路线", { exact: true }).selectOption("P-W-RUH");
  await expect(detail).toContainText("4,458");
  await expect(detail.getByTestId("query-map-gap")).toContainText("150");
  await page.getByRole("button", { name: "展开分析筛选", exact: true }).click();
  await page.getByLabel("区域", { exact: true }).selectOption("东部");
  await expect(map.locator("[data-route-id]")).toHaveCount(4);
  await expect(page.getByLabel("地图路线", { exact: true })).not.toHaveValue(
    "P-W-RUH",
  );
  await expect(detail).not.toContainText("P-W-RUH");
  await page.getByLabel("门店", { exact: true }).selectOption("MOCK-D-012");
  await expect(map.locator("[data-route-id]")).toHaveCount(1);
  await expect(detail).toContainText("P-W-DMM");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await page.getByRole("button", { name: "重置筛选", exact: true }).click();
  await page.getByLabel("地图路线", { exact: true }).selectOption("P-W-JED");
  await expect(detail).toContainText("同城接驳");
  await expect(detail).toContainText("569");
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width);
  await page.getByLabel("区域", { exact: true }).selectOption("东部");
  await page.getByLabel("服务 VPC", { exact: true }).selectOption("JED");
  await expect(page.getByTestId("query-empty")).toBeVisible();
  await expect(map).toHaveCount(0);
});

test("query reports an empty intersection without stale totals or page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByTestId("story-command").fill("/smart-query 查询销售库存物流");
  await page.getByTestId("story-command").press("Enter");
  await page.getByRole("button", { name: "关闭 CUI" }).click();
  await expect(page.getByTestId("query-sales-chart")).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "展开分析筛选", exact: true }).click();
  await page.getByLabel("区域", { exact: true }).selectOption("东部");
  await page.getByLabel("服务 VPC", { exact: true }).selectOption("JED");
  await expect(page.getByTestId("query-empty")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});

test("prompt scopes remain visible for Chinese dates, VPC unions and displayed store names", async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  const command = page.getByTestId("story-command");
  await command.fill(
    "/smart-query 查看吉达 VPC 和达曼 VPC 2026年1月至3月的库存",
  );
  await command.press("Enter");
  await page.clock.runFor(10000);
  await expect(page.getByLabel("服务 VPC", { exact: true })).toHaveValue(
    "JED,DMM",
  );
  await expect(page.getByLabel("截止月份")).toHaveValue("2026-03");
  await expect(page.getByTestId("query-scope")).toContainText("52 家门店");
  await page.getByRole("tab", { name: /库存与渠道/ }).click();
  await expect(page.getByTestId("query-physical-stock")).toContainText("4,508");

  await command.fill("/smart-query 查看直营·利雅得·01店 2026-07 的销量");
  await command.press("Enter");
  await page.clock.runFor(10000);
  await expect(page.getByLabel("门店", { exact: true })).toHaveValue(
    "MOCK-D-001",
  );
  await expect(page.getByTestId("query-scope")).toContainText("1 家门店");

  await command.fill("/smart-query 查看 2027年1月至3月的销量");
  await command.press("Enter");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("query-empty")).toContainText(
    "所选期间没有可用月度数据",
  );
  await expect(page.getByLabel("起始月份")).toHaveValue("2027-01");
});
