"use client";

import { useMemo, useState } from "react";
import { ArrowRight, GitBranch, Route, Truck } from "lucide-react";
import {
  simulateCapacity,
  type DecisionEvidence,
} from "@/lib/story/decision-evidence";
import { createCampaignState } from "@/lib/story/seed";
import { StatusPill } from "./shared";
import LogisticsMap from "./LogisticsMap";

const logisticsCases = [
  {
    id: "east",
    label: "东部已知订单",
    quantity: 360,
    title: "为什么不先进达曼 VPC？",
    choices: [
      {
        label: "吉达 → 东部交付点",
        cost: 7300,
        days: 3,
        handling: 1,
        reason: "目的地已知；减少一次中转，按订单成批交付。",
        recommended: true,
      },
      {
        label: "吉达 → 达曼 VPC → 门店",
        cost: 9450,
        days: 4,
        handling: 2,
        reason: "干线后再短驳；超过本船 D+3 订单承诺。",
        recommended: false,
      },
    ],
  },
  {
    id: "transition",
    label: "中东部过渡带",
    quantity: 170,
    title: "为什么在利雅得截流？",
    choices: [
      {
        label: "吉达 → 利雅得 → 中东部",
        cost: 5800,
        days: 3,
        handling: 2,
        reason: "利用中轴干线和区域短驳，避免东去后折返。",
        recommended: true,
      },
      {
        label: "吉达 → 达曼 → 中东部",
        cost: 9450,
        days: 4,
        handling: 2,
        reason: "先向东运再向西回送，额外里程且超承诺。",
        recommended: false,
      },
    ],
  },
] as const;

export default function LogisticsDecisionModel({
  evidence,
}: {
  evidence: DecisionEvidence;
}) {
  const [caseId, setCaseId] = useState<string>("east");
  const [shortfall, setShortfall] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const input = useMemo(
    () => ({ ...createCampaignState(), ...evidence.scenarioInput }),
    [evidence],
  );
  const simulation = useMemo(
    () => simulateCapacity(input, shortfall ? 570 : 650),
    [input, shortfall],
  );
  const activeCase =
    logisticsCases.find((item) => item.id === caseId) ?? logisticsCases[0];
  const batch = evidence.delivery?.batches[batchIndex];
  const riyadhDemand = simulation.plan.assignments.filter(
    (item) => item.route === "riyadh",
  ).length;
  const riyadhGap = Math.max(0, riyadhDemand - (shortfall ? 570 : 650));
  const blocked = simulation.plan.status === "blocked";
  const vehicles = new Map(
    input.vessel.vehicles.map((vehicle) => [vehicle.id, vehicle]),
  );
  const affectedTypes = simulation.affected.reduce<Record<string, number>>(
    (counts, item) => ({
      ...counts,
      [item.demandId]: (counts[item.demandId] ?? 0) + 1,
    }),
    {},
  );
  return (
    <div
      className="logistics-decision-model"
      data-testid="logistics-decision-model"
    >
      <div className="decision-objective">
        <Route size={19} />
        <div>
          <strong>先满足交期，再比较全程成本与装卸</strong>
          <p>{evidence.objective}</p>
        </div>
      </div>
      <LogisticsMap
        plan={simulation.plan}
        affectedQuantity={simulation.affected.length}
      />
      <div className="model-pills case-selector">
        {logisticsCases.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setCaseId(item.id)}
            className={caseId === item.id ? "active" : ""}
          >
            {item.label} · {item.quantity} 台
          </button>
        ))}
      </div>
      <section className="model-section">
        <header>
          <h3>{activeCase.title}</h3>
          <small>同一需求，比较两条候选路径</small>
        </header>
        <div className="route-comparison">
          {activeCase.choices.map((choice) => (
            <article
              key={choice.label}
              className={choice.recommended ? "recommended" : "rejected"}
            >
              <StatusPill tone={choice.recommended ? "green" : "amber"}>
                {choice.recommended ? "保留并推荐" : "交期淘汰"}
              </StatusPill>
              <h4>{choice.label}</h4>
              <div className="route-stops">
                <span>JED</span>
                <i />
                <Truck size={18} />
                <i />
                <span>
                  {choice.recommended && caseId === "east"
                    ? "交付点"
                    : caseId === "transition" && choice.recommended
                      ? "RUH"
                      : "DMM"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>每板全程</dt>
                  <dd>{choice.cost.toLocaleString()} SAR</dd>
                </div>
                <div>
                  <dt>批次预算</dt>
                  <dd>
                    {(
                      Math.ceil(activeCase.quantity / 8) * choice.cost
                    ).toLocaleString()}{" "}
                    SAR
                  </dd>
                </div>
                <div>
                  <dt>到达 / 装卸</dt>
                  <dd>
                    D+{choice.days} / {choice.handling} 次
                  </dd>
                </div>
              </dl>
              <p>{choice.reason}</p>
            </article>
          ))}
        </div>
        <p className="model-note">
          备选线路运价为演示报价；以 8 位板车估算批次费用。先达曼再短驳按 7,600
          + 1,850 SAR/板测算。
        </p>
      </section>
      <section className="scenario-console">
        <header>
          <div>
            <GitBranch size={15} />
            <h3>运力不足时，怎样回压分车</h3>
          </div>
          <button
            type="button"
            data-testid="capacity-shortfall-toggle"
            className={shortfall ? "active" : ""}
            onClick={() => setShortfall((value) => !value)}
          >
            {shortfall ? "恢复 650 台容量" : "模拟中轴运力减 80 台"}
          </button>
        </header>
        <div className="capacity-relationship">
          <span>
            利雅得干线需求 <b>{riyadhDemand}</b>
          </span>
          <ArrowRight size={16} />
          <span>
            已确认容量 <b>{shortfall ? 570 : 650}</b>
          </span>
          <ArrowRight size={16} />
          <span>
            中轴缺口 <b>{riyadhGap}</b>
          </span>
        </div>
        <div
          className={`capacity-outcome ${blocked ? "warning" : ""}`}
          data-testid="logistics-scenario-result"
        >
          <strong>
            {simulation.affected.length} 台待调整 ·{" "}
            {simulation.protectedAffected} 台已预订订单受影响
          </strong>
          <p>
            {blocked
              ? `按优先级标记 ${affectedTypes["DEM-CONTINGENCY"] ?? 0} 台异常缓冲、${affectedTypes["DEM-MOBILE"] ?? 0} 台机动、${affectedTypes["DEM-REPLENISHMENT"] ?? 0} 台补货待调整。当前情景不能发布。`
              : "每条路线分别校验；当前路线容量通过，可进入执行。"}
          </p>
        </div>
        {blocked && (
          <div className="capacity-vins">
            {simulation.affected.slice(0, 4).map((item) => (
              <span key={item.vehicleId}>
                {item.vehicleId} ·{" "}
                {item.pool === "reserved"
                  ? "已确认订单"
                  : item.demandId === "DEM-CONTINGENCY"
                    ? "异常缓冲"
                    : item.demandId === "DEM-MOBILE"
                      ? "机动库存"
                      : "普通补货"}
              </span>
            ))}
            <small>
              共 {simulation.affected.length} 台，原归属仍保留；需重排后再发布
            </small>
          </div>
        )}
        <p className="model-note">
          这是本轮输入的运力情景测算，不会修改已经发布的运输任务。
        </p>
      </section>
      <section className="model-section">
        <header>
          <h3>从 VIN 到板位，而不只是路线总数</h3>
          <select
            aria-label="查看配载批次"
            value={batchIndex}
            onChange={(event) => setBatchIndex(Number(event.target.value))}
          >
            {evidence.delivery?.batches
              .filter(
                (_, i) =>
                  i < 3 || i === (evidence.delivery?.batches.length ?? 0) - 1,
              )
              .map((item) => (
                <option
                  key={item.id}
                  value={evidence.delivery?.batches.indexOf(item)}
                >
                  {item.id.replace("DEMO-TRUCK-", "")}
                </option>
              ))}
          </select>
        </header>
        <p className="model-note">
          同方向分组 → 每板 8 位 → 唯一 VIN 入板 → 校验尾板装载率。
        </p>
        <div className="truck-slot-grid">
          {Array.from({ length: 8 }, (_, i) => {
            const vin = batch?.vehicleIds[i];
            const vehicle = vin ? vehicles.get(vin) : undefined;
            return (
              <article className={vin ? "occupied" : "empty"} key={i}>
                <span>板位 {i + 1}</span>
                <Truck size={18} />
                <strong>{vehicle?.model ?? "空位"}</strong>
                <small>{vin?.replace("DEMO-", "") ?? "尾板允许未满载"}</small>
              </article>
            );
          })}
        </div>
        {batch && (
          <div className="truck-batch-facts">
            <span>
              发运 D+{batch.departDay} → 到达 D+{batch.arrivalDay}
            </span>
            <span>装载 {batch.vehicleIds.length}/8</span>
            <span>预算 {batch.cost.toLocaleString()} SAR</span>
          </div>
        )}
      </section>
    </div>
  );
}
