import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("tab3 reserves vehicles, shows both movable diagrams, and saves a rerun that can be replayed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/vessel-allocation 基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  const workspace = page.getByTestId("vessel-replenishment");
  await expect(workspace).toBeVisible();
  await workspace.locator(".vs-advanced > summary").click();
  await expect(page.getByLabel("本船总量", { exact: true })).toHaveValue(
    "2500",
  );
  await expect(page.getByLabel("预留比例", { exact: true })).toHaveValue("10");
  await expect(page.getByTestId("replenishment-budget")).toHaveText("608");
  await expect(page.getByTestId("replenishment-reserved")).toHaveText("250");
  const graph = page.getByTestId("replenishment-graph");
  await expect(graph.locator("ellipse")).toHaveCount(24);
  await expect(graph.locator("[data-edge]")).toHaveCount(24);
  const node = graph.locator('[data-node="sales"]');
  await node.scrollIntoViewIfNeeded();
  const original = await node.getAttribute("transform");
  const box = (await node.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 35,
    box.y + box.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(node).not.toHaveAttribute("transform", original!);
  await workspace.getByRole("tab", { name: "注水图", exact: true }).click();
  await workspace
    .getByRole("button", { name: "重新演示", exact: true })
    .click();
  await expect(workspace.locator("[data-water-store]")).toHaveCount(16);
  await workspace
    .getByRole("button", { name: "下一步注水", exact: true })
    .click();
  await expect(page.getByTestId("water-assigned")).not.toHaveText("0");
  await workspace
    .getByRole("button", { name: "查看最终水位", exact: true })
    .click();
  await expect(page.getByTestId("water-assigned")).toHaveText("512");
  await page.getByLabel("注水进度", { exact: true }).press("Home");
  await expect(page.getByTestId("water-assigned")).toHaveText("0");
  await page.getByLabel("预留比例", { exact: true }).fill("20");
  await expect(workspace).toContainText("参数待运行");
  await workspace
    .getByRole("button", { name: "运行模拟", exact: true })
    .click();
  await page.clock.runFor(12000);
  await expect(
    page.getByRole("tab", { name: "分车计划模拟", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("replenishment-reserved")).toHaveText("500");
  await expect(page.getByTestId("replenishment-budget")).toHaveText("358");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出快照", exact: true }).click();
  const file = await downloadEvent;
  const snapshot = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(snapshot.replenishment.parameters.reserveRatio).toBe(0.2);
  expect(snapshot.replenishment.summary.reserved).toBe(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test("changed totals stay consistent across tabs and an authorized-only prefix identifies the active channel", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation 补库存 总量=2000 预留比例=10%");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await expect(page.getByTestId("replenishment-budget")).toHaveText("277");
  await page.getByRole("tab", { name: "基本统计", exact: true }).click();
  await expect(
    page.getByTestId("vessel-overview").locator(".vo-kpis article").first(),
  ).toContainText("2,000");
  await expect(
    page.getByTestId("vessel-overview").locator(".vo-kpis article").nth(1),
  ).toContainText("171");
  await page.getByRole("tab", { name: "订单分车", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出订单与物流快照", exact: true })
    .click();
  const file = await downloadEvent;
  const snapshot = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(snapshot.orders.plans.dual.quantity).toBe(1523);
  expect(
    snapshot.orders.orders.reduce(
      (n: number, o: { allocated: number }) => n + o.allocated,
      0,
    ),
  ).toBe(1523);
  await page.getByRole("tab", { name: "分车计划模拟", exact: true }).click();
  await page.locator(".vs-advanced > summary").click();
  await page
    .getByLabel("精细 · 直营目标 WoS 系数", { exact: true })
    .fill("0.1");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await page.clock.runFor(12000);
  await page.getByRole("tab", { name: "注水图", exact: true }).click();
  await page.getByRole("button", { name: "重新演示", exact: true }).click();
  await page.getByRole("button", { name: "下一步注水", exact: true }).click();
  await expect(page.getByTestId("water-stage")).toContainText("授权注水");
  await expect(page.getByTestId("water-stage")).not.toContainText(
    "授权尚未起注",
  );
});
