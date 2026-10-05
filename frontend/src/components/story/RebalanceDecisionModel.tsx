"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Filter, LockKeyhole } from "lucide-react";
import {
  evaluateOrderSources,
  type DecisionEvidence,
} from "@/lib/story/decision-evidence";
import type { DailyPlan } from "@/lib/story/types";
import { StatusPill } from "./shared";
import SourceDecisionGraph from "./SourceDecisionGraph";

const orderLabels = {
  enterprise: "企业大单",
  premium: "高利润",
  retail: "普通零售",
  remote: "偏远地区",
} as const;

export default function RebalanceDecisionModel({
  evidence,
  plan,
  canApprove,
  onApprove,
}: {
  evidence: DecisionEvidence;
  plan: DailyPlan;
  canApprove: boolean;
  onApprove: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(plan.orders[0]?.id ?? "");
  const [prioritizeTime, setPrioritizeTime] = useState(false);
  const order =
    plan.orders.find((item) => item.id === selectedId) ?? plan.orders[0];
  if (!order) return null;
  const comparison = evaluateOrderSources(plan, order.id);
  const decision = plan.decisions.find((item) => item.orderId === order.id);
  const selectedSources = comparison.filter((item) =>
    decision?.recommendedCandidateIds.includes(item.id),
  );
  const quantity = selectedSources.reduce(
    (sum, item) => sum + item.vehicleIds.length,
    0,
  );
  const totalCost = selectedSources.reduce((sum, item) => sum + item.cost, 0);
  const executable =
    selectedSources.length > 0 &&
    selectedSources.every((item) => item.eligible) &&
    quantity === order.quantity;
  const alternatives = [...comparison].sort(
    (a, b) =>
      Number(b.eligible) - Number(a.eligible) ||
      (prioritizeTime ? a.leadDays - b.leadDays : a.cost - b.cost),
  );
  return (
    <div
      className="rebalance-decision-model"
      data-testid="rebalance-decision-model"
    >
      <div className="decision-objective">
        <Filter size={18} />
        <div>
          <strong>先筛可执行车源，再比较贡献与来源影响</strong>
          <p>{evidence.objective}</p>
        </div>
      </div>
      <div className="model-pills order-selector">
        {plan.orders.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === order.id ? "active" : ""}
            onClick={() => setSelectedId(item.id)}
          >
            {orderLabels[item.type]} · {item.model}
          </button>
        ))}
      </div>
      <section className="order-demand">
        <div>
          <span>{order.id}</span>
          <h3>
            {order.quantity} 台 {order.model} → {order.destination}
          </h3>
        </div>
        <div>
          <small>承诺</small>
          <strong>{order.dueInDays} 天内</strong>
        </div>
        <div>
          <small>整单毛利</small>
          <strong>{order.margin.toLocaleString()} SAR</strong>
        </div>
      </section>
      <SourceDecisionGraph plan={plan} orderId={order.id} />
      <div className="source-filter-chain">
        <span>配置匹配</span>
        <ArrowRight size={12} />
        <span>VIN 可用 / 未占用</span>
        <ArrowRight size={12} />
        <span>权属与授权</span>
        <ArrowRight size={12} />
        <span>承诺内到达</span>
        <ArrowRight size={12} />
        <span>成本与源地影响</span>
      </div>
      <section className="model-section">
        <header>
          <h3>候选车源与淘汰原因</h3>
          <label className="scenario-checkbox">
            <input
              type="checkbox"
              checked={prioritizeTime}
              onChange={(event) => setPrioritizeTime(event.target.checked)}
            />
            按到达时间排序
          </label>
        </header>
        <div className="decision-table-wrap" data-testid="source-comparison">
          <table className="decision-table source-table">
            <thead>
              <tr>
                <th>车源 / 数量</th>
                <th>到达</th>
                <th>增量成本</th>
                <th>调出后覆盖</th>
                <th>
                  {order.type === "enterprise"
                    ? "组合角色 / 校验"
                    : "净贡献 / 校验"}
                </th>
              </tr>
            </thead>
            <tbody>
              {alternatives.map((source) => (
                <tr
                  key={source.id}
                  className={source.eligible ? "" : "excluded"}
                >
                  <th>
                    {source.location}
                    <small>
                      {source.vehicleIds.length} 台 ·{" "}
                      {decision?.recommendedCandidateIds.includes(source.id)
                        ? "当前组合"
                        : "备选"}
                    </small>
                  </th>
                  <td>
                    {source.leadDays === 0 ? "当日" : `${source.leadDays} 天`}
                  </td>
                  <td>
                    {source.cost.toLocaleString()}
                    <small>SAR</small>
                  </td>
                  <td>{source.sourceCoverAfter} 天</td>
                  <td>
                    <strong>
                      {order.type === "enterprise"
                        ? `${source.vehicleIds.length} / ${order.quantity} 台`
                        : `${source.netContribution.toLocaleString()} SAR`}
                    </strong>
                    <small className={source.eligible ? "pass" : "fail"}>
                      {source.eligible
                        ? "条件通过"
                        : source.exclusionReason || "当前不可执行"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="model-note">
          {order.type === "enterprise"
            ? "企业大单按整单齐套计算，不能把每个来源都当作可单独满足 80 台的方案。"
            : "净贡献 = 订单毛利 − 本来源增量成本；权属或承诺不通过的候选即使有利润也不执行。"}
        </p>
      </section>
      <section
        className={`order-recommendation ${!executable ? "warning" : ""}`}
      >
        <header>
          <StatusPill tone={executable ? "green" : "amber"}>
            {executable ? "条件通过" : "原建议 · 未通过"}
          </StatusPill>
          <h3>
            {order.type === "enterprise"
              ? "组合履约，而不是抽空一个 VPC"
              : "本轮建议与选择依据"}
          </h3>
        </header>
        <div className="order-source-equation">
          {selectedSources.map((source, i) => (
            <div key={source.id}>
              {i > 0 && <b>+</b>}
              <span>
                <strong>{source.vehicleIds.length} 台</strong>
                <small>{source.location}</small>
              </span>
            </div>
          ))}
          <em>
            {executable ? "=" : "原建议"} {quantity} / {order.quantity} 台
          </em>
        </div>
        <p>{decision?.rationale}</p>
        <div className="contribution-equation">
          <span>毛利 {order.margin.toLocaleString()}</span>
          <span>− 增量成本 {totalCost.toLocaleString()}</span>
          <ArrowRight size={14} />
          <strong>
            {executable
              ? `净贡献 ${(order.margin - totalCost).toLocaleString()} SAR`
              : "未形成可执行收益"}
          </strong>
        </div>
        <footer>
          <span>
            <LockKeyhole size={13} />
            审批时再次校验 VIN 占用
          </span>
          {decision?.status === "approved" ? (
            <StatusPill>
              <CheckCircle2 size={12} /> 已批准并生成任务
            </StatusPill>
          ) : !executable ? (
            <StatusPill tone="amber">需重新匹配 · 不生成任务</StatusPill>
          ) : decision?.status === "approval_required" && canApprove ? (
            <button
              type="button"
              disabled={!executable}
              onClick={() => decision && onApprove(decision.id)}
            >
              确认并锁车
            </button>
          ) : (
            <StatusPill tone="slate">
              {canApprove ? "随既有班次发货建议" : "历史方案 · 只读"}
            </StatusPill>
          )}
        </footer>
      </section>
      {!executable && (
        <p className="model-warning">
          不生成执行任务。请按候选列表中的实际排除原因补齐车源或解决条件，再重新匹配。
        </p>
      )}
    </div>
  );
}
