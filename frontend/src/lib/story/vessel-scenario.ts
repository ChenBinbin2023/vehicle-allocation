import {
  calculateVesselReplenishment,
  replenishmentAllocation,
  type ReplenishmentParameters,
  type VesselReplenishment,
} from "./vessel-replenishment";
import {
  calculateCommercial,
  commercialCalculationVersion,
  defaultCommercialParameters,
} from "./vessel-commercial";
import type { PlanningSnapshot } from "./store-planning";
import type { StoryRun } from "./types";
import { vesselInventoryVersion } from "./vessel-overview";
export type VesselScenarioVersion = {
  id: string;
  parentId: string | null;
  createdAt: string;
  reason: string;
  parameters: ReplenishmentParameters;
};
export type VesselScenarioAction = {
  parameters?: ReplenishmentParameters;
  reason?: string;
  versionId?: string;
};
export type SaveVesselScenario = (
  runId: string,
  action: VesselScenarioAction,
) => void;
function normalized(parameters: ReplenishmentParameters) {
  const next = structuredClone(parameters);
  next.commercial ??= defaultCommercialParameters();
  return next;
}
export function createVesselScenario(
  result: VesselReplenishment,
): Extract<PlanningSnapshot, { kind: "allocation" }> {
  result = structuredClone(result);
  result.parameters = normalized(result.parameters);
  return {
    kind: "allocation",
    result: replenishmentAllocation(result),
    replenishment: result,
    commercial: calculateCommercial(result),
    versionId: "V1",
    versions: [
      {
        id: "V1",
        parentId: null,
        createdAt: new Date().toISOString(),
        reason: "初始分车、物流与定价参数",
        parameters: structuredClone(result.parameters),
      },
    ],
  };
}
export function hydrateVesselScenario(run: StoryRun): StoryRun {
  if (run.planning?.kind !== "allocation" || !run.planning.replenishment)
    return run;
  if (
    run.planning.replenishment.sourceVersion === vesselInventoryVersion &&
    run.planning.commercial?.calculationVersion ===
      commercialCalculationVersion &&
    run.planning.versions?.length
  )
    return run;
  if (run.planning.versions?.length)
    return selectVesselScenarioVersion(
      run,
      run.planning.versionId ?? run.planning.versions[0].id,
    );
  const next = {
    ...run,
    planning: createVesselScenario(
      calculateVesselReplenishment(
        normalized(run.planning.replenishment.parameters),
      ),
    ),
  };
  next.planningSummary = scenarioSummary(next.planning);
  next.answer = next.planningSummary;
  return next;
}
export function selectVesselScenarioVersion(
  run: StoryRun,
  versionId: string,
): StoryRun {
  if (run.planning?.kind !== "allocation" || !run.planning.replenishment)
    throw new Error("需要门店补库情景");
  const prior = run.planning.versions?.length
    ? run.planning
    : createVesselScenario(run.planning.replenishment);
  const version = prior.versions!.find((v) => v.id === versionId);
  if (!version) throw new Error("找不到情景版本 " + versionId);
  const result = calculateVesselReplenishment(normalized(version.parameters));
  const next = structuredClone(run);
  next.planning = {
    ...structuredClone(prior),
    versionId,
    result: replenishmentAllocation(result),
    replenishment: result,
    commercial: calculateCommercial(result),
  };
  next.planningSummary = scenarioSummary(next.planning);
  next.answer = next.planningSummary;
  return next;
}
export function reviseVesselScenario(
  run: StoryRun,
  parameters: ReplenishmentParameters,
  reason: string,
): StoryRun {
  if (run.planning?.kind !== "allocation" || !run.planning.replenishment)
    throw new Error("需要门店补库情景");
  const prior = run.planning.versions?.length
    ? run.planning
    : createVesselScenario(run.planning.replenishment);
  const p = normalized(parameters);
  if (
    JSON.stringify(p) ===
    JSON.stringify(normalized(prior.replenishment!.parameters))
  )
    return run;
  const result = calculateVesselReplenishment(p),
    commercial = calculateCommercial(result);
  const id = "V" + (prior.versions!.length + 1);
  const next = structuredClone(run);
  next.planning = {
    kind: "allocation",
    result: replenishmentAllocation(result),
    replenishment: result,
    commercial,
    versionId: id,
    versions: [
      ...structuredClone(prior.versions!),
      {
        id,
        parentId: prior.versionId ?? "V1",
        createdAt: new Date().toISOString(),
        reason,
        parameters: structuredClone(p),
      },
    ],
  };
  next.planningSummary = scenarioSummary(next.planning);
  next.answer = next.planningSummary;
  next.events.push({
    id: next.id + "-version-" + id,
    duration: 1,
    role: "agent",
    title: id + " · " + reason,
    detail: next.planningSummary,
    planningTab: "water",
    planningNode: "store-net",
  });
  next.duration += 1;
  next.elapsed = next.duration;
  return next;
}
export function scenarioSummary(
  snapshot: Extract<PlanningSnapshot, { kind: "allocation" }>,
) {
  const r = snapshot.replenishment!.summary,
    f = snapshot.commercial!.profit.summary;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    (snapshot.versionId ?? "V1") +
    "：本船 " +
    fmt(r.supply) +
    " 台，预留 " +
    fmt(r.reserved) +
    " 台，订单 " +
    fmt(r.orders) +
    " 台，补库 " +
    fmt(r.replenishment) +
    " 台，余量 " +
    fmt(r.retained) +
    " 台。补库物流预算 " +
    fmt(snapshot.commercial!.logistics.totalCost) +
    " SAR；预计营业额 " +
    fmt(f.revenue) +
    " SAR，净利 " +
    fmt(f.net) +
    " SAR。直营按零售价、授权按批发价分别乘以价格系数并扣采购价、物流；仅直营扣单车固定费用。同车型计入各店物流后，直营单车净利高于授权；按补库车辆全部售出测算，非实际营业收入。"
  );
}
