"use client";

import type { DailyPlan } from "@/lib/story/types";
import { evaluateOrderSources } from "@/lib/story/decision-evidence";
import RelationshipGraph, {
  type RelationshipNode,
  type RelationshipEdge,
} from "./RelationshipGraph";

export default function SourceDecisionGraph({
  plan,
  orderId,
}: {
  plan: DailyPlan;
  orderId: string;
}) {
  const order = plan.orders.find((item) => item.id === orderId);
  if (!order) return null;
  const candidates = evaluateOrderSources(plan, orderId);
  const decision = plan.decisions.find((item) => item.orderId === orderId);
  const chosen = candidates.filter((item) =>
    decision?.recommendedCandidateIds.includes(item.id),
  );
  const quantity = chosen.reduce(
    (sum, item) => sum + item.vehicleIds.length,
    0,
  );
  const cost = chosen.reduce((sum, item) => sum + item.cost, 0);
  const eligible = candidates.filter((item) => item.eligible);
  const excluded = candidates.filter((item) => !item.eligible);
  const executable =
    chosen.length > 0 &&
    chosen.every((item) => item.eligible) &&
    quantity === order.quantity;
  const availableQuantity = chosen
    .filter((item) => item.eligible)
    .reduce((sum, item) => sum + item.vehicleIds.length, 0);
  const executableQuantity = executable ? quantity : 0;
  const exclusions = excluded
    .map(
      (item) => `${item.location}：${item.exclusionReason || "车源不可执行"}`,
    )
    .join("；");
  const nodes: RelationshipNode[] = candidates.map((candidate, index) => ({
    id: candidate.id,
    x: 24,
    y: candidates.length === 3 ? 64 + index * 146 : 100 + index * 208,
    width: 174,
    height: 125,
    title: candidate.location,
    kicker: candidate.eligible ? "SOURCE CANDIDATE" : "CONDITIONAL SOURCE",
    tone: candidate.eligible ? "data" : "excluded",
    value: `${candidate.vehicleIds.length} 台`,
    lines: [
      `${candidate.cost.toLocaleString()} SAR · ${candidate.leadDays === 0 ? "当日" : `${candidate.leadDays} 天`}`,
      candidate.eligible
        ? `调出后 ${candidate.sourceCoverAfter} 天覆盖`
        : "执行条件未关闭",
    ],
    summary: candidate.eligible ? candidate.reason : candidate.exclusionReason,
    rule: candidate.eligible
      ? "通过可用性与承诺校验后，才比较贡献和来源影响；通过不等于已选中。"
      : "权属、授权或交期不通过，不生成执行任务。",
    facts: [
      {
        label: "候选状态",
        value: candidate.eligible
          ? chosen.some((item) => item.id === candidate.id)
            ? "当前组合"
            : "可行备选"
          : "排除",
      },
      { label: "调出后覆盖", value: `${candidate.sourceCoverAfter} 天` },
    ],
  }));
  nodes.push({
    id: "filter",
    x: 242,
    y: 150,
    width: 174,
    height: 140,
    title: "可执行条件筛选",
    kicker: "HARD FILTER",
    tone: "rule",
    value: `${eligible.length} 个通过`,
    lines: ["VIN / 权属 / 授权", `必须 ${order.dueInDays} 天内到达`],
    summary: "先过滤不可执行车源，再进入经济性比较。",
    rule: "VIN 未占用、交易条件关闭、交期通过；不能用利润覆盖硬约束。",
    facts: [
      { label: "候选", value: `${candidates.length} 个` },
      { label: "通过", value: `${eligible.length} 个` },
      { label: "排除", value: `${excluded.length} 个` },
    ],
  });
  if (excluded.length)
    nodes.push({
      id: "excluded",
      x: 242,
      y: 345,
      width: 174,
      height: 114,
      title: "待关闭执行条件",
      kicker: "NOT EXECUTABLE",
      tone: "excluded",
      value: `${excluded.length} 个候选`,
      lines: ["不进入执行方案"],
      summary: exclusions,
      rule: `按本轮实际校验原因排除：${exclusions}。条件解决并重新匹配前，不进入可执行组合。`,
    });
  nodes.push({
    id: "combination",
    x: 450,
    y: 170,
    width: 174,
    height: 145,
    title: order.type === "enterprise" ? "多来源组合履约" : "比较并选择车源",
    kicker: "COST & IMPACT",
    tone: executable ? "rule" : "excluded",
    value: `${availableQuantity} / ${order.quantity} 台`,
    lines: [
      executable
        ? `${chosen.length} 个来源 · 齐套通过`
        : `原建议 ${quantity} 台 · 需重匹配`,
      `${executable ? "成本" : "候选测算"} ${cost.toLocaleString()} SAR`,
    ],
    summary: executable
      ? (decision?.rationale ?? "尚无推荐组合。")
      : `原建议不能直接执行；本轮可用 ${availableQuantity} 台，需求 ${order.quantity} 台。${exclusions}`,
    rule:
      order.type === "enterprise"
        ? "组合成本按各来源相加，不能重复计算整单毛利；还需保护来源安全覆盖。"
        : "同城低干扰调拨优先；普通订单优先既有班次，偏远地区先拼单。",
    facts: chosen.map((item) => ({
      label: item.location,
      value: `${item.vehicleIds.length} 台`,
    })),
  });
  nodes.push({
    id: "order",
    x: 658,
    y: 170,
    width: 174,
    height: 158,
    title: `${order.model} 订单`,
    kicker:
      decision?.status === "approved" ? "LOCKED & RELEASED" : "ORDER RESULT",
    tone: executable ? "result" : "excluded",
    value: `${executableQuantity} 台${executable ? "" : "可执行"}`,
    lines: [
      executable
        ? `净贡献 ${(order.margin - cost).toLocaleString()}`
        : "未形成可执行收益",
      decision?.status === "approved"
        ? "已批准 · 生成运输任务"
        : executable
          ? decision?.status === "approval_required"
            ? "待负责人批准"
            : "既有班次发货建议"
          : "不可执行 · 条件未关闭",
    ],
    summary: `${order.destination} · ${order.dueInDays} 天内。${executable ? (decision?.rationale ?? "") : "当前组合未通过硬约束，不生成运输任务。"}`,
    rule: "批准时再次检查 VIN 与数量，再锁车和生成运输任务；不把候选状态当执行状态。",
    facts: [
      { label: "订单需求", value: `${order.quantity} 台` },
      { label: "可执行数量", value: `${executableQuantity} 台` },
      { label: "毛利", value: `${order.margin.toLocaleString()} SAR` },
      {
        label: "净贡献",
        value: executable
          ? `${(order.margin - cost).toLocaleString()} SAR`
          : "未形成可执行收益",
      },
    ],
  });
  const edges: RelationshipEdge[] = candidates.map((candidate) => ({
    from: candidate.id,
    to: candidate.eligible ? "filter" : "excluded",
    status: candidate.eligible ? "active" : "excluded",
  }));
  edges.push(
    {
      from: "filter",
      to: "combination",
      label: executable ? "筛选后比较" : "组合未通过",
      labelX: 433,
      labelY: 184,
      status: executable ? "rule" : "excluded",
    },
    {
      from: "combination",
      to: "order",
      label: executable ? "锁车前复核" : "阻断执行",
      labelX: 640,
      labelY: 207,
      status: executable ? "active" : "excluded",
    },
  );
  return (
    <RelationshipGraph
      key={orderId}
      title={
        order.type === "enterprise"
          ? "一笔大单，为什么需要三个来源"
          : "从候选车源，到可执行订单"
      }
      subtitle="绿线进入可行集合，虚线停在条件检查；只有选中的组合才进入订单履约。"
      nodes={nodes}
      edges={edges}
      initialNode="combination"
      testId="source-decision-graph"
      height={510}
    />
  );
}
