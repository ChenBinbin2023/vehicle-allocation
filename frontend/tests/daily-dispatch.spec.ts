import { expect, test } from "@playwright/test";
import { WORKSPACE_STORAGE, type WorkspaceData } from "../src/lib/sessions";

test("daily dispatch streams its own canvas from the exact requested prompt", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/skill 帮我整理今天需要处理的订单，并生成调度计划");
  await page.getByTestId("story-command").press("Enter");
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(0);
  await page.clock.runFor(3500);
  await expect(
    page.locator('[data-block-type="dispatch-summary"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-block-type="dispatch-shortage"]'),
  ).toHaveCount(0);
  await page.clock.runFor(12000);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(4);
  await expect(page.getByTestId("dispatch-map")).toBeVisible();
  await expect(page.getByTestId("dispatch-trip")).toHaveCount(4);
  await expect(page.getByTestId("dispatch-option")).toHaveCount(2);
  await expect(page.getByTestId("dispatch-recommendation")).toContainText(
    "推荐本区采购",
  );
  await expect(page.locator(".story-run-answer")).toContainText("今日需处理");
  await page.getByTestId("dispatch-demand").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("dispatch-demand")).toBeInViewport();
  await page.clock.runFor(300);
  await page.reload();
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await expect(page.getByTestId("dispatch-option")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("map, demand status and configuration hover stay linked", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/daily-dispatch 整理今日订单");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(15000);
  await page.getByLabel("需求门店").selectOption("MOCK-D-001");
  await expect(page.getByTestId("dispatch-store-total")).toHaveText(
    "10 台 / 3 笔订单",
  );
  await page.getByRole("button", { name: "待拼车", exact: true }).click();
  await expect(page.getByTestId("dispatch-store-total")).toHaveText(
    "3 台 / 1 笔订单",
  );
  await page.getByTestId("dispatch-model-bar").first().hover();
  await expect(page.getByRole("tooltip")).toContainText("豪华版");
  await page.getByRole("button", { name: "新增", exact: true }).click();
  await expect(page.getByTestId("dispatch-store-total")).toHaveText(
    "7 台 / 2 笔订单",
  );
  await page.locator('[data-dispatch-store="MOCK-D-007"]').click();
  await expect(page.getByLabel("需求门店")).toHaveValue("MOCK-D-007");
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "仅小车直送", exact: true }).click();
  for (const card of await page.getByTestId("dispatch-trip").all())
    await expect(card).toContainText("小车直送");
  await page.getByLabel("搜索调度批次").fill("没有这个订单");
  await expect(page.getByTestId("dispatch-trips-empty")).toBeVisible();
  await expect(page.getByTestId("dispatch-option")).toHaveCount(2);
});

test("daily dispatch exports a complete snapshot and restores its history after another skill", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  const command = page.getByTestId("story-command");
  await command.fill("/skill 帮我整理今天需要处理的订单，并生成调度计划");
  await command.press("Enter");
  await page.clock.runFor(15000);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出调度计划", exact: true }).click();
  expect((await download).suggestedFilename()).toContain("daily-dispatch");
  await command.fill("/query 查看基本统计");
  await command.press("Enter");
  await page.clock.runFor(10000);
  await expect(page.getByTestId("daily-dispatch")).toHaveCount(0);
  await page.getByTestId("canvas-history-toggle").click();
  await page.locator('[data-run-command="/daily-dispatch"]').click();
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await page.getByTestId("dispatch-shortage-item").last().click();
  await expect(page.getByTestId("dispatch-option")).toHaveCount(2);
});

test("older dispatch history without transport comparisons still opens its vehicle details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/daily-dispatch 整理今天订单");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(15000);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(4);
  await page.evaluate(
    (key) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("atlas-single-port-workspace", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction("snapshots", "readwrite");
          const store = transaction.objectStore("snapshots");
          const request = store.get(key);
          request.onsuccess = () => {
            const workspace = request.result as WorkspaceData;
            for (const session of workspace.sessions) {
              for (const run of session.snapshot.campaign.runs) {
                for (const trip of run.dispatch?.trips ?? []) {
                  Reflect.deleteProperty(trip, "comparison");
                }
              }
            }
            store.put(workspace, key);
          };
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    WORKSPACE_STORAGE,
  );
  await page.reload();
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await expect(
    page.getByText("逐车来源与配送明细", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("dispatch-trip")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("dispatch comparisons and batch details fit a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/daily-dispatch 整理今天订单");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(15000);
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await expect(page.getByTestId("daily-dispatch")).toBeVisible();
  await page.getByTestId("dispatch-shortage-item").last().click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(page.getByTestId("dispatch-option")).toHaveCount(2);
});
