import { expect, test } from "@playwright/test";
import { WORKSPACE_STORAGE } from "../src/lib/sessions";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("atlas-single-port-workspace");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

test("clean story shell starts every segment from the CUI skill picker", async ({
  page,
}) => {
  await expect(page.getByTestId("story-shell")).toBeVisible();
  await expect(page.getByText("供需总览", { exact: true })).toHaveCount(0);
  await expect(page.getByText("周度分货", { exact: true })).toHaveCount(0);

  await expect(page.getByTestId("workspace-sidebar")).toBeVisible();
  await expect(page.getByTestId("workspace-project-tree")).toContainText(
    "分车计划",
  );
  await expect(page.getByTestId("story-progress")).toHaveCount(0);
  await expect(page.getByTestId("cui-welcome")).toBeVisible();
  await expect(page.getByTestId("story-run-block")).toHaveCount(0);

  const command = page.getByTestId("story-command");
  await command.fill("/");
  await expect(page.getByTestId("story-skill-option")).toHaveCount(11);

  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText("/crisis-brief", { exact: true }) })
    .click();
  await expect(command).toHaveValue(/\/crisis-brief.*1,800/);
  await expect(page.getByTestId("story-user-message")).toHaveCount(0);

  await command.press("Enter");
  await expect(page.getByTestId("story-user-message")).toHaveCount(1);
  await expect(page.getByTestId("story-cui-event").first()).toContainText(
    "建立分析边界",
  );
  await expect(page.getByTestId("story-run-block").first()).toBeVisible();
});

test("mobile canvas stays contained and opens the CUI as a right overlay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("story-command")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);

  await page.getByRole("button", { name: "供应链工作台", exact: true }).click();
  await page.getByRole("button", { name: "关闭 CUI", exact: true }).click();
  await page.getByTestId("mobile-chat-toggle").click();
  await expect(page.locator(".story-chat")).toHaveClass(/open/);
  await page.getByTestId("story-command").fill("/");
  await expect(page.getByTestId("story-skill-option")).toHaveCount(11);
});

test("tablet width uses the compact overlay without horizontal clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.getByTestId("story-command")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
});

test("reload preserves streamed blocks and pauses an active story run", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  const command = page.getByTestId("story-command");
  await command.fill("/");
  await page
    .getByTestId("story-skill-option")
    .filter({ has: page.getByText("/crisis-brief", { exact: true }) })
    .click();
  await command.press("Enter");
  await page.clock.runFor(1_600);
  const visibleBefore = await page.locator(".story-block").count();
  expect(visibleBefore).toBeGreaterThan(0);
  await page.clock.runFor(400);
  const visibleAtSave = await page.locator(".story-block").count();
  // Let the 180ms persistence batch capture this stable reveal interval before
  // testing reload. The next block does not start streaming until 2340ms.
  await page.clock.runFor(200);
  await expect
    .poll(() =>
      page.evaluate(async (key) => {
        return new Promise<number>((resolve) => {
          const open = indexedDB.open("atlas-single-port-workspace", 1);
          open.onerror = () => resolve(0);
          open.onsuccess = () => {
            const request = open.result
              .transaction("snapshots")
              .objectStore("snapshots")
              .get(key);
            request.onerror = () => resolve(0);
            request.onsuccess = () =>
              resolve(
                request.result?.sessions?.[0]?.snapshot?.campaign?.runs
                  ?.length ?? 0,
              );
          };
        });
      }, WORKSPACE_STORAGE),
    )
    .toBe(1);
  const persistedStatus = await page.evaluate(
    async (key) =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open("atlas-single-port-workspace", 1);
        open.onsuccess = () => {
          const request = open.result
            .transaction("snapshots")
            .objectStore("snapshots")
            .get(key);
          request.onsuccess = () =>
            resolve(
              request.result.sessions[0].snapshot.campaign.runs[0].status,
            );
        };
      }),
    WORKSPACE_STORAGE,
  );
  expect(persistedStatus).toBe("running");

  await page.reload();
  await expect(page.locator(".story-run-state")).toContainText("已暂停");
  await expect(page.locator(".story-block")).toHaveCount(visibleAtSave);
  await expect(
    page.getByRole("button", { name: "继续", exact: true }),
  ).toBeVisible();
});
