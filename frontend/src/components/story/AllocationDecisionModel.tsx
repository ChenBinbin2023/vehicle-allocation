"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import {
  simulateAllocation,
  type DecisionEvidence,
} from "@/lib/story/decision-evidence";
import { createCampaignState } from "@/lib/story/seed";
import { StatusPill } from "./shared";
import AllocationDecisionGraph from "./AllocationDecisionGraph";

export default function AllocationDecisionModel({
  evidence,
  canApply,
  stale,
  onApply,
}: {
  evidence: DecisionEvidence;
  canApply: boolean;
  stale: boolean;
  onApply: (value: number) => void;
}) {
  const { t: translateText } = useI18n();

  const initialSafety =
    evidence.scenarioInput?.planningParameters.dammamSafetyStock ?? 100;
  const [safety, setSafety] = useState(initialSafety);
  const [selectedPool, setSelectedPool] = useState("inventory");
  const input = useMemo(
    () => ({ ...createCampaignState(), ...evidence.scenarioInput }),
    [evidence],
  );
  const scenario = useMemo(
    () => simulateAllocation(input, safety),
    [input, safety],
  );
  const rows = evidence.replenishment ?? [];
  const change = safety - initialSafety;
  const sample = scenario.plan.assignments
    .filter((item) => item.pool === selectedPool)
    .slice(0, 5);
  return (
    <div
      className="allocation-decision-model"
      data-testid="allocation-decision-model"
    >
      <div className="decision-objective">
        <LockKeyhole size={18} />
        <div>
          <strong>{translateText("承诺优先，再补覆盖缺口")}</strong>
          <p>{translateText(evidence.objective)}</p>
        </div>
        <StatusPill>{translateText("订单硬保护")}</StatusPill>
      </div>
      <AllocationDecisionGraph
        plan={scenario.plan}
        safety={safety}
        onSafetyChange={setSafety}
      />
      <div className="allocation-rule-chain">
        {[
          {
            level: "P0",
            title: "不可分车辆",
            count: "0",
            text: "冻结不进入供给池",
          },
          {
            level: "P1–2",
            title: "已确认订单",
            count: "620",
            text: "240 企业 + 290 零售 + 90 高配",
          },
          {
            level: "P3",
            title: "明确补货",
            count: "780",
            text: "按覆盖缺口补足",
          },
          {
            level: "P4",
            title: "机动与缓冲",
            count: "400",
            text: "300 机动 + 100 异常缓冲",
          },
        ].map((item) => (
          <article key={item.level}>
            <span>{translateText(item.level)}</span>
            <strong>
              {translateText(item.count)}
              <small>{translateText("台")}</small>
            </strong>
            <h3>{translateText(item.title)}</h3>
            <p>{translateText(item.text)}</p>
          </article>
        ))}
      </div>
      <section className="model-section">
        <header>
          <h3>{translateText("补货不是按历史销量平分")}</h3>
          <small>{translateText("区域汇总 · 目标量为危机策略参数")}</small>
        </header>
        <div className="decision-formula">
          {translateText("目标覆盖量 − 可售库存 − 已确认在途 + 订单需求 ")}
          <ArrowRight size={14} />
          {translateText(" ")}
          {translateText("有效缺口")}
        </div>
        <div className="decision-table-wrap">
          <table className="decision-table">
            <thead>
              <tr>
                <th>VPC</th>
                <th>{translateText("目标量")}</th>
                <th>{translateText("可售")}</th>
                <th>{translateText("在途")}</th>
                <th>{translateText("订单需求")}</th>
                <th>{translateText("明确补货")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.vpc}>
                  <th>{translateText(row.name)}</th>
                  <td>{row.target}</td>
                  <td>− {row.available}</td>
                  <td>− {row.inbound}</td>
                  <td>+ {row.orders}</td>
                  <td>
                    <strong>{row.gap}</strong>
                    {translateText(" 台")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="model-note">
          {translateText(
            "明确补货 780 台只是一部分；区域最终入库量还包含机动与异常缓冲。东部已知订单不占用达曼自由库存。",
          )}
        </p>
      </section>
      <section className="scenario-console">
        <header>
          <div>
            <SlidersHorizontal size={15} />
            <h3>{translateText("调整达曼自由安全库存")}</h3>
          </div>
          <StatusPill tone="slate">{translateText("情景测算")}</StatusPill>
        </header>
        <p>
          {translateText(
            "多留在达曼的车，会从利雅得可调补货中让出；已确认订单保持不动。参数应用后还需重新校验物流容量。",
          )}
        </p>
        <div
          className="scenario-metrics"
          data-testid="allocation-scenario-result"
        >
          <article>
            <span>{translateText("吉达 VPC")}</span>
            <strong>{scenario.vpcs.JED}</strong>
            <small>{translateText("西部响应")}</small>
          </article>
          <article>
            <span>{translateText("利雅得 VPC")}</span>
            <strong>{scenario.vpcs.RUH}</strong>
            <small>
              {translateText(
                change
                  ? `${change > 0 ? "−" : "+"}${Math.abs(change)} 台中轴库存`
                  : "中央机动",
              )}
            </small>
          </article>
          <article>
            <span>{translateText("达曼 VPC")}</span>
            <strong>{scenario.vpcs.DMM}</strong>
            <small>{translateText("东部保底")}</small>
          </article>
          <footer>
            <LockKeyhole size={13} />
            {scenario.protected}
            {translateText(" 台订单不变 · 库存")}
            {translateText(" ")}
            {translateText(scenario.inventory.toLocaleString())}
            {translateText(" 台 · 总量 1,800")}
          </footer>
        </div>
        {stale ? (
          <p className="model-warning">
            {translateText(
              "参数已变更。请从 CUI 重跑 /vessel-allocation 形成新的有效草案。",
            )}
          </p>
        ) : (
          <div className="scenario-actions">
            <span>
              {translateText(
                canApply
                  ? "测算通过后，可采用参数并从 CUI 重跑。"
                  : "当前为只读快照，测算不会改变执行计划。",
              )}
            </span>
            {canApply && (
              <button
                type="button"
                disabled={safety === initialSafety}
                onClick={() => onApply(safety)}
              >
                {translateText("采用参数并准备重跑 ")}
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}
      </section>
      <section className="model-section">
        <header>
          <h3>{translateText("每台 VIN 为什么分到这里")}</h3>
          <div className="model-pills">
            <button
              type="button"
              className={selectedPool === "reserved" ? "active" : ""}
              onClick={() => setSelectedPool("reserved")}
            >
              {translateText("订单车")}
            </button>
            <button
              type="button"
              className={selectedPool === "inventory" ? "active" : ""}
              onClick={() => setSelectedPool("inventory")}
            >
              {translateText("补库车")}
            </button>
          </div>
        </header>
        <div className="vin-reasons">
          {sample.map((item) => (
            <div key={item.vehicleId}>
              <code>{translateText(item.vehicleId)}</code>
              <ArrowRight size={12} />
              <strong>{translateText(item.destination)}</strong>
              <small>{translateText(item.reason)}</small>
            </div>
          ))}
        </div>
      </section>
      <p className="model-footnote">
        <ArrowDown size={12} />
        {translateText(" ")}
        {translateText(
          "下方保留本轮分车明细；情景结果须重新运行后才写入正式版本。",
        )}
      </p>
    </div>
  );
}
