import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { freshSnapshot } from "../src/lib/sessions";
import { storySkills } from "../src/lib/story/skill-catalog";

test("contains only the new story and no legacy business entrypoints", () => {
  assert.deepEqual(
    storySkills.map((skill) => skill.command),
    [
      "/crisis-brief",
      "/vessel-allocation",
      "/delivery-plan",
      "/arrival-execution",
      "/daily-rebalance",
    ],
  );

  const snapshot = freshSnapshot() as unknown as Record<string, unknown>;
  for (const legacyField of [
    "month",
    "scenario",
    "strategy",
    "allocation",
    "logistics",
    "state",
    "view",
    "stage",
  ]) {
    assert.equal(legacyField in snapshot, false, legacyField);
  }

  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /allocation\.css|strategy\.css|logistics\.css/);
  const renderedStory = [
    "src/components/SessionHost.tsx",
    "src/components/story/StoryWorkspace.tsx",
    "src/components/story/StoryProgress.tsx",
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(renderedStory, /周度分货|教学算例|周末复盘/);

  for (const legacyPath of [
    "src/lib/domain.ts",
    "src/lib/strategy.ts",
    "src/lib/strategy-command.ts",
    "src/lib/skills.ts",
    "src/components/Workspace.tsx",
    "src/components/Chat.tsx",
    "src/components/SkillCanvas.tsx",
  ]) {
    assert.equal(existsSync(legacyPath), false, legacyPath);
  }
});
