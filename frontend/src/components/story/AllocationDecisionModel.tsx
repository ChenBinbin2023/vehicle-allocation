"use client";

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
          <strong>承诺优先，再补覆盖缺口</strong>
          <p>{evidence.objective}</p>
        </div>
        <StatusPill>订单硬保护</StatusPill>
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
            <span>{item.level}</span>
            <strong>
              {item.count}
              <small>台</small>
            </strong>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <section className="model-section">
        <header>
          <h3>补货不是按历史销量平分</h3>
          <small>区域汇总 · 目标量为危机策略参数</small>
        </header>
        <div className="decision-formula">
          目标覆盖量 − 可售库存 − 已确认在途 + 订单需求 <ArrowRight size={14} />{" "}
          有效缺口
        </div>
        <div className="decision-table-wrap">
          <table className="decision-table">
            <thead>
              <tr>
                <th>VPC</th>
                <th>目标量</th>
                <th>可售</th>
                <th>在途</th>
                <th>订单需求</th>
                <th>明确补货</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.vpc}>
                  <th>{row.name}</th>
                  <td>{row.target}</td>
                  <td>− {row.available}</td>
                  <td>− {row.inbound}</td>
                  <td>+ {row.orders}</td>
                  <td>
                    <strong>{row.gap}</strong> 台
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="model-note">
          明确补货 780
          台只是一部分；区域最终入库量还包含机动与异常缓冲。东部已知订单不占用达曼自由库存。
        </p>
      </section>
      <section className="scenario-console">
        <header>
          <div>
            <SlidersHorizontal size={15} />
            <h3>调整达曼自由安全库存</h3>
          </div>
          <StatusPill tone="slate">情景测算</StatusPill>
        </header>
        <p>
          多留在达曼的车，会从利雅得可调补货中让出；已确认订单保持不动。参数应用后还需重新校验物流容量。
        </p>
        <div
          className="scenario-metrics"
          data-testid="allocation-scenario-result"
        >
          <article>
            <span>吉达 VPC</span>
            <strong>{scenario.vpcs.JED}</strong>
            <small>西部响应</small>
          </article>
          <article>
            <span>利雅得 VPC</span>
            <strong>{scenario.vpcs.RUH}</strong>
            <small>
              {change
                ? `${change > 0 ? "−" : "+"}${Math.abs(change)} 台中轴库存`
                : "中央机动"}
            </small>
          </article>
          <article>
            <span>达曼 VPC</span>
            <strong>{scenario.vpcs.DMM}</strong>
            <small>东部保底</small>
          </article>
          <footer>
            <LockKeyhole size={13} />
            {scenario.protected} 台订单不变 · 库存{" "}
            {scenario.inventory.toLocaleString()} 台 · 总量 1,800
          </footer>
        </div>
        {stale ? (
          <p className="model-warning">
            参数已变更。请从 CUI 重跑 /vessel-allocation 形成新的有效草案。
          </p>
        ) : (
          <div className="scenario-actions">
            <span>
              {canApply
                ? "测算通过后，可采用参数并从 CUI 重跑。"
                : "当前为只读快照，测算不会改变执行计划。"}
            </span>
            {canApply && (
              <button
                type="button"
                disabled={safety === initialSafety}
                onClick={() => onApply(safety)}
              >
                采用参数并准备重跑 <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}
      </section>
      <section className="model-section">
        <header>
          <h3>每台 VIN 为什么分到这里</h3>
          <div className="model-pills">
            <button
              type="button"
              className={selectedPool === "reserved" ? "active" : ""}
              onClick={() => setSelectedPool("reserved")}
            >
              订单车
            </button>
            <button
              type="button"
              className={selectedPool === "inventory" ? "active" : ""}
              onClick={() => setSelectedPool("inventory")}
            >
              补库车
            </button>
          </div>
        </header>
        <div className="vin-reasons">
          {sample.map((item) => (
            <div key={item.vehicleId}>
              <code>{item.vehicleId}</code>
              <ArrowRight size={12} />
              <strong>{item.destination}</strong>
              <small>{item.reason}</small>
            </div>
          ))}
        </div>
      </section>
      <p className="model-footnote">
        <ArrowDown size={12} />{" "}
        下方保留本轮分车明细；情景结果须重新运行后才写入正式版本。
      </p>
    </div>
  );
}
