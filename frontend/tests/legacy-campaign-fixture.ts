import { createCampaignState } from "../src/lib/story/seed";
import { allocateVessel } from "../src/lib/story/allocation-engine";
import { planDelivery } from "../src/lib/story/delivery-engine";
import {
  startStoryRun,
  advanceStoryRun,
  applyStoryRunResult,
} from "../src/lib/story/skill-runner";
import {
  addSession,
  createWorkspace,
  WORKSPACE_STORAGE,
} from "../src/lib/sessions";
import type { Page } from "@playwright/test";

// The independently tested execution/rebalance fixture predates the new store simulation.
// Do not pass a simulated store plan off as a published VIN-level dispatch plan.
export function publishedCampaign() {
  const state = createCampaignState();
  state.allocation = allocateVessel(state);
  const plan = planDelivery(state);
  state.deliveryPlan = { ...plan, status: "published" };
  return state;
}
export function dailyCampaign() {
  const state = publishedCampaign();
  const run = startStoryRun("/arrival-execution", "", state);
  return applyStoryRunResult(state, advanceStoryRun(run, run.duration));
}
export async function seedPublishedCampaign(page: Page) {
  const workspace = addSession(
    createWorkspace(),
    "single-port",
    "吉达单港供应保障",
  );
  workspace.sessions[0].snapshot.campaign = publishedCampaign();
  await page.evaluate(
    async ({ key, workspace }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("atlas-single-port-workspace", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("snapshots");
        request.onerror = () => reject(request.error);
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
      });
    },
    { key: WORKSPACE_STORAGE, workspace },
  );
  await page.reload();
}
