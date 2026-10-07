"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useEffect, useRef } from "react";
import { Database, Download } from "lucide-react";
import { resolveStorySkill } from "@/lib/story/skill-catalog";
import type { StoryRun } from "@/lib/story/types";
import { vesselOverview } from "@/lib/story/vessel-overview";
import { vesselOrders } from "@/lib/story/vessel-orders";
import {
  replenishmentOverview,
  replenishmentOrders,
} from "@/lib/story/vessel-replenishment";
import type { SaveVesselScenario } from "@/lib/story/vessel-scenario";
import { SkillStream } from "./SkillStream";
import VesselOverviewDashboard from "./VesselOverviewDashboard";
import VesselOrdersDashboard from "./VesselOrdersDashboard";
import VesselReplenishmentWorkspace from "./VesselReplenishmentWorkspace";

export default function VesselSkillWorkspace({
  run,
  busy,
  focusedStep,
  focusRevision,
  onSaveScenario,
}: {
  run: StoryRun;
  busy: boolean;
  focusedStep: number | null;
  focusRevision: number;
  onSaveScenario?: SaveVesselScenario;
}) {
  const { t: translateText } = useI18n();

  const root = useRef<HTMLDivElement>(null);
  const snapshot = run.planning;
  const event = focusedStep === null ? undefined : run.events[focusedStep];
  useEffect(() => {
    if (event?.guiBlock)
      root.current
        ?.querySelector(`[data-block-type="${event.guiBlock}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [event?.id, focusRevision]);
  if (snapshot?.kind !== "allocation") return null;
  const skill = resolveStorySkill(run.command)!;
  const result = snapshot.replenishment;
  const overview = result ? replenishmentOverview(result) : vesselOverview;
  const orders = result ? replenishmentOrders(result) : vesselOrders;
  const statistics = run.command === "/query";
  const orderSkill = run.command === "/order-allocation";
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              runId: run.id,
              command: run.command,
              simulation: true,
              ...(statistics
                ? { overview }
                : orderSkill
                  ? { orders }
                  : snapshot),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${run.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div
      className="planning-workspace vessel-skill-workspace"
      ref={root}
      data-testid="store-planning-workspace"
      data-skill-command={run.command}
    >
      <header className="planning-heading">
        <div>
          <small>
            {translateText(
              statistics
                ? "VESSEL OVERVIEW"
                : orderSkill
                  ? "ORDER ALLOCATION"
                  : "ALLOCATION SIMULATION",
            )}
            {translateText(" ")}· SKILL WORKSPACE
          </small>
          <h1>{translateText(skill.title)}</h1>
          <p>{translateText(skill.description)}</p>
        </div>
        <span className="planning-status">
          {translateText(
            run.status === "complete"
              ? "已完成"
              : run.status === "paused"
                ? "已暂停"
                : "生成中",
          )}
          {translateText(" ")}· {Math.round((run.elapsed / run.duration) * 100)}
          %
        </span>
      </header>
      <div className="planning-context">
        <span>
          <Database size={14} />
          {translateText(overview.snapshotDate)}
          {translateText(" · 模拟统计快照")}
        </span>
        <span>
          {translateText("丰田 / 雷克萨斯 · ")}
          {overview.stores.length}
          {translateText(" 家门店")}
        </span>
        <button
          type="button"
          disabled={run.status !== "complete"}
          onClick={download}
        >
          <Download size={14} />
          {translateText(
            statistics
              ? "导出统计快照"
              : orderSkill
                ? "导出订单与物流快照"
                : "导出快照",
          )}
        </button>
      </div>
      <SkillStream run={run}>
        {statistics ? (
          <VesselOverviewDashboard data={overview} />
        ) : orderSkill ? (
          <VesselOrdersDashboard
            key={focusRevision}
            data={orders}
            prompt={run.prompt}
            focusNode={event?.planningNode}
          />
        ) : result ? (
          <VesselReplenishmentWorkspace
            result={result}
            commercial={snapshot.commercial}
            versions={snapshot.versions}
            versionId={snapshot.versionId ?? "V1"}
            busy={busy}
            focusNode={event?.planningNode}
            onSave={(parameters, reason) =>
              onSaveScenario?.(run.id, { parameters, reason })
            }
            onSelectVersion={(versionId) =>
              onSaveScenario?.(run.id, { versionId })
            }
          />
        ) : null}
      </SkillStream>
    </div>
  );
}
