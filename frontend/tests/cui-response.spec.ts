import { expect, test } from "@playwright/test";

test("analysis streams into an expandable timeline without navigation prompts", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/query 查看基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(240);
  const thought = page.getByTestId("story-cui-event").first();
  await expect(
    thought.getByRole("button", { name: /理解本轮统计范围/ }),
  ).toHaveAttribute("aria-expanded", "true");
  const initial = await thought.locator(".cui-step-detail").innerText();
  await page.clock.runFor(480);
  expect(
    (await thought.locator(".cui-step-detail").innerText()).length,
  ).toBeGreaterThan(initial.length);
  await page.clock.runFor(9000);
  const toggle = thought.getByRole("button", { name: /理解本轮统计范围/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(thought.locator(".cui-step-detail li")).toHaveCount(4);
  await expect(page.locator(".story-chat .cui-evidence-link")).toHaveCount(0);
  await expect(page.locator(".story-chat .cui-followups")).toHaveCount(0);
  await expect(page.locator(".cui-answer-content")).not.toContainText(
    "可继续运行",
  );
  const detail = thought.getByRole("region", { name: "理解本轮统计范围详情" });
  await detail.focus();
  await expect(detail).toBeFocused();
});

test("the completion time includes a pause and remains unchanged after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install({ time: new Date("2026-10-07T06:00:00Z") });
  await page.getByTestId("story-command").fill("/query 查看基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(2000);
  await page.getByRole("button", { name: "暂停任务", exact: true }).click();
  await page.clock.runFor(120000);
  await page.getByRole("button", { name: "继续任务", exact: true }).click();
  await page.clock.runFor(10000);
  const time = page.getByTestId("cui-final-answer").locator("time");
  const expectedMinute = await page.evaluate(() =>
    new Date("2026-10-07T06:02:08Z").toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  );
  await expect(time).toHaveText(expectedMinute);
  await page.clock.runFor(300);
  await page.reload();
  await expect(time).toHaveText(expectedMinute);
});

test("completed answers expose working copy, feedback, process, expansion and stable time controls", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.clock.install();
  await page.getByTestId("story-command").fill("/query 查看基本统计");
  await page.getByTestId("story-command").press("Enter");
  await page.clock.runFor(10000);
  const answer = page.getByTestId("cui-final-answer");
  await expect(answer.getByRole("button", { name: /用时/ })).toBeVisible();
  await expect(answer.locator("time")).toHaveText(/^\d{2}:\d{2}$/);
  const time = await answer.locator("time").innerText();
  const text = await answer.locator(".cui-answer-content").innerText();
  await answer.getByRole("button", { name: "复制回复", exact: true }).click();
  await expect(
    answer.getByRole("button", { name: "已复制", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "2,500",
  );
  await answer.getByRole("button", { name: "回复优秀" }).click();
  await expect(
    answer.getByRole("button", { name: "回复优秀" }),
  ).toHaveAttribute("aria-pressed", "true");
  await answer.getByRole("button", { name: "回复不佳" }).click();
  await expect(
    answer.getByRole("button", { name: "回复优秀" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    answer.getByRole("button", { name: "回复不佳" }),
  ).toHaveAttribute("aria-pressed", "true");
  await answer.getByRole("button", { name: "展开回复" }).click();
  const dialog = page.getByRole("dialog", { name: "完整回复" });
  await expect(dialog).toBeVisible();
  expect(await dialog.locator(":scope > div").innerText()).toBe(text);
  await page.getByRole("button", { name: "关闭完整回复" }).click();
  await answer.getByRole("button", { name: /用时/ }).click();
  await expect(page.locator(".cui-event-stream")).toBeHidden();
  await expect(answer.locator(".cui-answer-content")).toBeVisible();
  await answer.getByRole("button", { name: /用时/ }).click();
  await expect(page.locator(".cui-event-stream")).toBeVisible();
  await page.clock.runFor(300);
  await page.reload();
  await expect(page.getByTestId("cui-final-answer").locator("time")).toHaveText(
    time,
  );
});
