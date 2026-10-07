"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import type { AllocationPlan, VpcId } from "@/lib/story/types";
import RelationshipGraph, {
  type RelationshipNode,
  type RelationshipEdge,
} from "./RelationshipGraph";

export default function AllocationDecisionGraph({
  plan,
  safety,
  onSafetyChange,
}: {
  plan: AllocationPlan;
  safety: number;
  onSafetyChange: (value: number) => void;
}) {
  const { t: translateText } = useI18n();

  const reserved = plan.assignments.filter(
    (item) => item.pool === "reserved",
  ).length;
  const inventory = plan.assignments.length - reserved;
  const totals = plan.assignments.reduce<Record<VpcId, number>>(
    (acc, item) => {
      if (item.targetVpc) acc[item.targetVpc]++;
      return acc;
    },
    { JED: 0, RUH: 0, DMM: 0 },
  );
  const count = (demand: string) =>
    plan.assignments.filter((item) => item.demandId === demand).length;
  const base = (
    id: string,
    x: number,
    y: number,
    title: string,
    kicker: string,
    tone: RelationshipNode["tone"],
    value: string,
    summary: string,
    rule: string,
    lines?: string[],
    height = 116,
  ): RelationshipNode => ({
    id,
    x,
    y,
    width: 174,
    height,
    title,
    kicker,
    tone,
    value,
    summary,
    rule,
    lines,
  });
  const nodes: RelationshipNode[] = [
    base(
      "manifest",
      24,
      190,
      "本船可分供给",
      "VIN MANIFEST",
      "data",
      `${plan.assignments.length.toLocaleString()} 台`,
      "本船 Toyota / Lexus 车辆是本次决策的供给边界。",
      "有效 VIN 去重后进入可分池；冻结车辆不参加分配。",
      ["同一船次 · 唯一 VIN"],
    ),
    base(
      "orders",
      236,
      52,
      "已确认订单",
      "HARD CONSTRAINT",
      "rule",
      `${reserved} 台`,
      "企业 240、付款零售 290、稀缺配置 90 台先锁定。",
      "后续补货、机动分配及物流回压不能挤占已承诺 VIN。",
      ["合同 / 付款 / 配置承诺"],
    ),
    base(
      "inventory",
      236,
      292,
      "自由库存池",
      "AVAILABLE SUPPLY",
      "data",
      `${inventory.toLocaleString()} 台`,
      "扣除已确认订单后，余量进入区域库存保障。",
      "把明确补货、机动与缓冲分开，避免按历史销量简单均分。",
      ["补覆盖 · 留机动"],
    ),
    base(
      "delivery",
      658,
      52,
      "订单交付落点",
      "PROTECTED RESULT",
      "result",
      `${reserved} 台`,
      "按最终客户交付地址落点，而不是先进入旧区域母库。",
      "东部订单从吉达穿透直达；中东部允许利雅得截流。",
      ["按订单地址分配"],
    ),
    base(
      "coverage",
      446,
      218,
      "有效补货缺口",
      "COVERAGE POLICY",
      "rule",
      `${count("DEM-REPLENISHMENT")} 台`,
      "目标覆盖量 − 可售库存 − 已确认在途 + 订单需求。",
      "区域目标是演示危机策略参数；随后按单港库存落点规则分配。",
      ["覆盖目标 + 订单需求"],
    ),
    base(
      "buffer",
      446,
      360,
      "机动与异常缓冲",
      "RESILIENCE",
      "rule",
      `${count("DEM-MOBILE") + count("DEM-CONTINGENCY")} 台`,
      "全国机动 300 台、异常缓冲 100 台，为供应不确定性留空间。",
      "运力不足先回压缓冲，再机动，最后普通补货。",
      ["300 机动 + 100 缓冲"],
    ),
    {
      ...base(
        "vpcs",
        658,
        260,
        "VPC 库存落点",
        "INVENTORY RESULT",
        "result",
        `${inventory.toLocaleString()} 台`,
        `吉达 ${totals.JED} 台 · 利雅得 ${totals.RUH} 台 · 达曼 ${totals.DMM} 台。`,
        "已知东部订单不占达曼自由库存；增加达曼安全量，从利雅得可调补货让出。",
        [
          `JED ${totals.JED}  ·  RUH ${totals.RUH}`,
          `DMM ${totals.DMM}  ·  安全量 ${safety}`,
        ],
        140,
      ),
      facts: [
        { label: "吉达", value: `${totals.JED} 台` },
        { label: "利雅得", value: `${totals.RUH} 台` },
        { label: "达曼", value: `${totals.DMM} 台` },
      ],
    },
  ];
  const edges: RelationshipEdge[] = [
    {
      from: "manifest",
      to: "orders",
      label: "优先锁定",
      labelX: 217,
      labelY: 150,
    },
    {
      from: "manifest",
      to: "inventory",
      label: "扣除承诺",
      labelX: 217,
      labelY: 321,
    },
    {
      from: "orders",
      to: "delivery",
      label: "配置与交期不变",
      labelX: 532,
      labelY: 101,
    },
    {
      from: "inventory",
      to: "coverage",
      label: "缺口计算",
      labelX: 429,
      labelY: 272,
      status: "rule",
    },
    {
      from: "inventory",
      to: "buffer",
      label: "策略预留",
      labelX: 426,
      labelY: 431,
      status: "rule",
    },
    { from: "coverage", to: "vpcs", labelX: 640, labelY: 281 },
    { from: "buffer", to: "vpcs" },
  ];
  return (
    <RelationshipGraph
      title={translateText("1,800 台车，怎样形成两类承诺")}
      subtitle="订单先锁定，库存再按覆盖与响应能力落点。数量来自当前情景计算。"
      nodes={nodes}
      edges={edges}
      initialNode="orders"
      testId="allocation-decision-graph"
      controls={
        <div className="graph-scenario-control">
          <div>
            <strong>{translateText("达曼自由安全库存")}</strong>
            <small>{translateText("情景预览 · 尚未采用")}</small>
          </div>
          <label>
            <input
              type="range"
              min="80"
              max="160"
              step="10"
              aria-label={translateText("达曼安全库存")}
              data-testid="allocation-safety-slider"
              value={safety}
              onChange={(event) => onSafetyChange(Number(event.target.value))}
            />
            <b>
              {safety}
              <small>{translateText(" 台")}</small>
            </b>
          </label>
          <span>{translateText("620 台订单不变")}</span>
        </div>
      }
      height={498}
    />
  );
}
