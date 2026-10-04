import { createCampaignState } from "./seed";
import { applyExecutionEvent } from "./execution-engine";
import type { CampaignAction, CampaignState } from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function restoreCampaignState(value: unknown): CampaignState {
  if (
    !value ||
    typeof value !== "object" ||
    (value as CampaignState).schemaVersion !== 1 ||
    !Array.isArray((value as CampaignState).vessel?.vehicles) ||
    (value as CampaignState).vessel.vehicles.length !== 1800 ||
    !Array.isArray((value as CampaignState).runs)
  ) {
    return createCampaignState();
  }
  const restored = clone(value as CampaignState);
  restored.planningParameters ??= { dammamSafetyStock: 100 };
  restored.runs = restored.runs.map((run) =>
    run.status === "running" ? { ...run, status: "paused" as const } : run,
  );
  return restored;
}

export function reduceCampaign(
  state: CampaignState,
  action: CampaignAction,
): CampaignState {
  const version = state.version + 1;
  if (action.type === "set_crisis")
    return { ...state, version, crisis: action.analysis };
  if (action.type === "set_allocation")
    return { ...state, version, allocation: action.plan };
  if (action.type === "set_delivery")
    return { ...state, version, deliveryPlan: action.plan };
  if (action.type === "execution_event")
    return applyExecutionEvent(state, action.event);
  if (action.type === "set_inventory_baseline")
    return {
      ...state,
      version,
      phase: "daily",
      inventoryBaseline: action.baseline,
    };
  if (action.type === "save_daily_plan")
    return {
      ...state,
      version,
      dailyOperations: [...state.dailyOperations, action.plan],
    };
  if (action.type === "save_run")
    return {
      ...state,
      activeRunId: action.run.id,
      runs: [...state.runs, action.run],
    };
  if (action.type === "update_run")
    return {
      ...state,
      runs: state.runs.map((run) =>
        run.id === action.run.id ? action.run : run,
      ),
    };
  return state;
}
