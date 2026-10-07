import { expect, test } from "@playwright/test";

test("underfilled batches visibly wait while full loads retain their dispatch conditions after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill(
      "/vessel-allocation 模拟门店补库 总量=2500 预留比例=10% 基准WoS=4 级差=10%",
    );
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  const logistics = page.getByRole("region", { name: "物流方案", exact: true });
  await logistics.getByRole("tab", { name: "班次", exact: true }).click();
  await expect(
    logistics.getByTestId("logistics-dispatch-policy"),
  ).toContainText("满载才发运");
  const table = logistics.getByTestId("logistics-trips-table");
  await expect(
    table.getByRole("columnheader", { name: "配载状态", exact: true }),
  ).toBeVisible();
  const waiting = table.locator('tr[data-dispatch-status="awaiting-load"]');
  expect(await waiting.count()).toBeGreaterThan(0);
  for (const row of await waiting.all()) {
    const load = await row.locator("td").nth(4).textContent();
    const [quantity, capacity] = load!.split("/").map(Number);
    expect(quantity).toBeLessThan(capacity);
    await expect(row).toContainText(`还差 ${capacity - quantity} 台`);
  }
  const ready = table.locator('tr[data-dispatch-status="ready"]');
  expect(await ready.count()).toBeGreaterThan(0);
  for (const row of await ready.all()) {
    await expect(row.locator("td").nth(4)).toHaveText("8 / 8");
  }
  await logistics
    .getByRole("tab", { name: "中心 → 门店 · 订单触发", exact: true })
    .click();
  await expect(table.locator('tr[data-dispatch-status="ready"]')).toHaveCount(
    0,
  );
  await expect(
    table.locator('tr[data-dispatch-status="awaiting-order"]').first(),
  ).toContainText("已满载 · 待订单触发");
  const singleCar = table
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "1 / 8", exact: true }) })
    .first();
  await singleCar.getByRole("button").click();
  await expect(logistics.getByTestId("trip-dispatch-status")).toContainText(
    "还差 7 台",
  );
  await expect(
    logistics.getByLabel("补库物流班次").locator("option:checked"),
  ).toContainText("待拼车 / 待满载");
  await logistics.screenshot({
    path: testInfo.outputPath("logistics-full-load.png"),
  });
  await page.clock.runFor(500);
  await page.reload();
  await logistics.getByRole("tab", { name: "班次", exact: true }).click();
  await expect(
    table.locator('tr[data-dispatch-status="awaiting-load"]').first(),
  ).toContainText("待拼车 / 待满载");
});
