import assert from "node:assert/strict";
import test from "node:test";

import { startStoryRun } from "../src/lib/story/skill-runner";
import {
  WORKSPACE_STORAGE,
  addSession,
  createWorkspace,
  restoreWorkspace,
} from "../src/lib/sessions";

test("v3 workspace starts with a clean Jeddah single-port campaign", () => {
  const workspace = createWorkspace();
  const snapshot = workspace.sessions[0].snapshot;

  assert.equal(workspace.version, 3);
  assert.equal(WORKSPACE_STORAGE, "atlas-single-port-workspace-v3");
  assert.equal(workspace.sessions[0].title, "吉达单港供应保障");
  assert.equal(snapshot.campaign.vessel.vehicles.length, 1800);
  assert.equal(snapshot.campaign.runs.length, 0);
  assert.equal(snapshot.messages.length, 0);
  assert.equal(snapshot.activeStage, "welcome");
});

test("v3 workspace keeps campaign state isolated between sessions", () => {
  let workspace = createWorkspace();
  const folderId = workspace.folders[0].id;
  workspace.sessions[0].snapshot.campaign.auditTrail.push({
    id: "AUDIT-ONE",
    at: "T-14",
    action: "test",
    detail: "first only",
  });
  workspace = addSession(workspace, folderId, "第二个船次演练");

  assert.equal(workspace.sessions[0].snapshot.campaign.auditTrail.length, 1);
  assert.equal(workspace.sessions[1].snapshot.campaign.auditTrail.length, 0);
});

test("pauses active story run while restoring a valid v3 workspace", () => {
  const workspace = createWorkspace();
  const snapshot = workspace.sessions[0].snapshot;
  snapshot.campaign.runs = [
    startStoryRun("/crisis-brief", "分析单港影响", snapshot.campaign),
  ];
  snapshot.campaign.activeRunId = snapshot.campaign.runs[0].id;

  const restored = restoreWorkspace(JSON.stringify(workspace));

  assert.equal(restored.sessions[0].snapshot.campaign.runs[0].status, "paused");
  assert.equal(restored.sessions[0].snapshot.campaign.activeRunId, snapshot.campaign.runs[0].id);
});

test("drops legacy story snapshots and invalid JSON into a clean v3 workspace", () => {
  const legacy = createWorkspace() as unknown as Record<string, unknown>;
  legacy.version = 2;
  const fromLegacy = restoreWorkspace(JSON.stringify(legacy));
  const fromInvalid = restoreWorkspace("{not-json");

  assert.equal(fromLegacy.version, 3);
  assert.equal(fromLegacy.sessions[0].snapshot.campaign.crisis, null);
  assert.equal(fromLegacy.sessions[0].snapshot.campaign.runs.length, 0);
  assert.equal(fromInvalid.version, 3);
  assert.equal(fromInvalid.sessions[0].title, "吉达单港供应保障");
});
