import { expect, test } from "@playwright/test";
import {
  addSession,
  createWorkspace,
  WORKSPACE_STORAGE,
} from "../src/lib/sessions";
import { startStorePlanningRun } from "../src/lib/story/store-planning-run";
import { advanceStoryRun } from "../src/lib/story/skill-runner";

test("supply-chain entry starts clean despite old demo cache and persists new tasks", async ({
  page,
}) => {
  const oldWorkspace = addSession(
    createWorkspace(),
    "single-port",
    "旧演示任务",
  );
  await page.goto("/");
  await page.getByTestId("story-command").waitFor();
  await page.clock.install();
  await page.clock.runFor(300);
  await page.evaluate(async (workspace) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("atlas-single-port-workspace", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction(
          "snapshots",
          "readwrite",
        );
        transaction
          .objectStore("snapshots")
          .put(workspace, "atlas-single-port-workspace-v3");
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, oldWorkspace);
  await page.reload();

  await expect(page.getByTestId("cui-welcome")).toBeVisible();
  await expect(page.getByTestId("workspace-session")).toHaveCount(0);
  await expect(page.locator("main.story-canvas")).toHaveCount(0);
  const projects = page.getByTestId("workspace-project-tree");
  await expect(projects.locator("[data-folder-id]")).toHaveCount(2);
  await expect(
    projects.getByRole("button", { name: "全局", exact: true }),
  ).toBeVisible();
  await expect(
    projects.getByRole("button", { name: "分车计划", exact: true }),
  ).toBeVisible();

  await page.getByTestId("story-command").fill("/query 查看本船供给");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(9000);
  await expect(page.getByTestId("workspace-session")).toHaveCount(1);
  await page.reload();
  await expect(page.getByTestId("workspace-session")).toHaveCount(1);
  await expect(page.getByTestId("story-user-message")).toHaveText(
    "/query 查看本船供给",
  );
  await expect(page.getByTestId("vessel-overview")).toBeVisible();
});

test("entry screen creates a session only on first send, in the selected project", async ({
  page,
}) => {
  await page.goto("/");
  const command = page.getByTestId("story-command");
  await expect(page.getByTestId("cui-welcome")).toBeVisible();
  await expect(page.locator("main.story-canvas")).toHaveCount(0);
  await expect(page.getByTestId("workspace-session")).toHaveCount(0);
  await page.getByRole("button", { name: "新任务", exact: true }).click();
  await expect(page.getByLabel("当前项目")).toHaveValue("global");
  await command.fill("查看当前库存");
  await expect(page.getByTestId("workspace-session")).toHaveCount(0);
  await command.fill(" ");
  await command.press("Enter");
  await expect(page.getByTestId("workspace-session")).toHaveCount(0);
  await page
    .getByRole("button", { name: "在分车计划中新建任务", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("当前项目")).toHaveValue("single-port");
  await command.fill("查看本船基本统计");
  await page.clock.install();
  await command.press("Enter");
  await expect(
    page
      .locator('[data-folder-id="single-port"]')
      .getByTestId("workspace-session"),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-folder-id="global"]').getByTestId("workspace-session"),
  ).toHaveCount(0);
  await page.clock.runFor(9000);
  await page.getByRole("button", { name: "新任务", exact: true }).click();
  await expect(page.getByTestId("cui-welcome")).toBeVisible();
  await expect(page.getByTestId("workspace-session")).toHaveCount(1);
  await command.fill("/order-allocation 查看订单");
  await command.press("Enter");
  await page.clock.runFor(9000);
  await expect(
    page.locator('[data-folder-id="global"]').getByTestId("workspace-session"),
  ).toHaveCount(1);
  await expect(page.getByTestId("workspace-session")).toHaveCount(2);
});

test("three skills stream separate GUI pages and retain their own history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.clock.install();
  const command = page.getByTestId("story-command");
  await command.fill("/query 查看基本统计");
  await command.press("Enter");
  await expect(page.locator('[data-skill-command="/query"]')).toBeVisible();
  await expect(page.getByRole("tablist", { name: "分车分析" })).toHaveCount(0);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(0);
  await page.clock.runFor(2200);
  const partial = await page.getByTestId("skill-gui-block").count();
  expect(partial).toBeGreaterThan(0);
  expect(partial).toBeLessThan(6);
  await page.clock.runFor(8000);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(6);
  await expect(
    page
      .getByTestId("vessel-overview")
      .locator('[data-testid^="overview-chart-"]'),
  ).toHaveCount(11);
  await command.fill("/order-allocation 查看订单分车与物流建议");
  await command.press("Enter");
  await page.clock.runFor(9000);
  await expect(
    page.locator('[data-skill-command="/order-allocation"]'),
  ).toBeVisible();
  await expect(page.getByTestId("vessel-orders")).toBeVisible();
  await expect(page.getByTestId("vessel-overview")).toHaveCount(0);
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(3);
  await command.fill("/vessel-allocation 模拟门店补库 总量=2500");
  await command.press("Enter");
  await page.clock.runFor(12000);
  await expect(page.getByTestId("vessel-replenishment")).toBeVisible();
  await expect(page.getByTestId("skill-gui-block")).toHaveCount(4);
  await page
    .getByRole("slider", { name: "直营 / 授权级差", exact: true })
    .press("ArrowRight");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
  await page.getByTestId("canvas-history-toggle").click();
  await page.locator('[data-run-command="/query"]').click();
  await expect(page.getByTestId("vessel-overview")).toBeVisible();
  await expect(page.getByTestId("story-user-message")).toHaveCount(3);
  await page.getByRole("button", { name: "关闭 GUI 画布" }).click();
  await expect(page.locator("main.story-canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "打开 GUI 画布" }).click();
  await expect(page.getByTestId("vessel-overview")).toBeVisible();
  await page.clock.runFor(300);
  await page.reload();
  await expect(page.getByTestId("story-user-message")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("entry composer and plugin picker fit a phone viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("cui-welcome")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByTestId("story-command").fill("/");
  await expect(
    page.getByTestId("story-skill-option").filter({ hasText: "/query" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("story-skill-option").filter({ hasText: "/smart-query" }),
  ).toHaveCount(0);
  await page.getByTestId("story-command").press("Escape");
  await page.getByRole("button", { name: "插件", exact: true }).first().click();
  await expect(
    page.getByRole("dialog", { name: "插件与 Skills" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .filter({ hasText: "基本统计" })
    .click();
  await expect(page.getByTestId("story-command")).toHaveValue(/^\/query /);
  await expect(page.getByTestId("workspace-session")).toHaveCount(0);
});

test("a multiline Skill prompt keeps its simulation parameters", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page
    .getByTestId("story-command")
    .fill("/vessel-allocation\n补库 总量=3000");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(12000);
  await page.locator(".vs-advanced > summary").click();
  await expect(page.getByLabel("本船总量", { exact: true })).toHaveValue(
    "3000",
  );
});

test("pre-change simulation history retains parameters and all four sections", async ({
  page,
}) => {
  const workspace = addSession(
    createWorkspace(),
    "single-port",
    "历史分车计划",
  );
  const snapshot = workspace.sessions[0].snapshot;
  const started = startStorePlanningRun(
    "LEGACY-ALLOCATION",
    "/vessel-allocation",
    "门店补库 总量=2500",
    snapshot.campaign,
    {},
  );
  const run = advanceStoryRun(started, started.duration);
  snapshot.campaign.runs = [run];
  snapshot.campaign.activeRunId = run.id;
  snapshot.activeStage = "allocation";
  snapshot.messages = [
    { id: 1, role: "user", text: "/vessel-allocation 门店补库 总量=2500" },
    { id: 2, role: "agent", text: "", storyRunId: run.id },
  ];
  await page.goto("/");
  await page.getByTestId("story-command").waitFor();
  await page.clock.install();
  await page.clock.runFor(300);
  await page.evaluate(
    async ({ workspace, key }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("atlas-single-port-workspace", 1);
        request.onsuccess = () => {
          const transaction = request.result.transaction(
            "snapshots",
            "readwrite",
          );
          transaction.objectStore("snapshots").put(workspace, key);
          transaction.oncomplete = () => {
            request.result.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { workspace, key: WORKSPACE_STORAGE },
  );
  await page.reload();
  await expect(page.getByTestId("vessel-replenishment")).toBeVisible();
  await expect(
    page.getByTestId("vessel-replenishment").locator(".vs-section-heading"),
  ).toHaveCount(4);
  await page
    .getByRole("slider", { name: "直营 / 授权级差", exact: true })
    .press("ArrowRight");
  await page.getByRole("button", { name: "运行模拟", exact: true }).click();
  await expect(page.getByTestId("scenario-version")).toHaveText("V2");
});
