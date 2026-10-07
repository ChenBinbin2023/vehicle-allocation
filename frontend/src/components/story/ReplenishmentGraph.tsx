"use client";
import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import type { CommercialResult } from "@/lib/story/vessel-commercial";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import type {
  ReplenishmentStore,
  VesselReplenishment,
} from "@/lib/story/vessel-replenishment";

const fmt = (n: number, d = 1) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
const initialPositions: Record<string, { x: number; y: number }> = {
  "sales-factor": { x: 180, y: 695 },
  sales: { x: 180, y: 800 },
  stock: { x: 180, y: 935 },
  "adjusted-sales": { x: 470, y: 738 },
  "before-stock": { x: 470, y: 907 },
  target: { x: 410, y: 1060 },
  "direct-factor": { x: 410, y: 1170 },
  "performance-factor": { x: 410, y: 1280 },
  "adjusted-target": { x: 695, y: 1130 },
  "water-rule": { x: 750, y: 578 },
  allocation: { x: 1095, y: 725 },
  "pairing-rule": { x: 1100, y: 914 },
  paired: { x: 1350, y: 830 },
  purchase: { x: 760, y: 195 },
  retail: { x: 760, y: 300 },
  wholesale: { x: 760, y: 405 },
  "retail-factor": { x: 990, y: 85 },
  "wholesale-factor": { x: 990, y: 185 },
  "unit-gross": { x: 1270, y: 300 },
  "logistics-factor": { x: 990, y: 455 },
  "unit-logistics": { x: 1270, y: 455 },
  "unit-fixed": { x: 1270, y: 575 },
  "unit-net": { x: 1560, y: 520 },
  "store-net": { x: 1900, y: 680 },
};
export const replenishmentEdges = [
  ["sales-factor", "adjusted-sales"],
  ["sales", "adjusted-sales"],
  ["sales", "before-stock"],
  ["stock", "before-stock"],
  ["adjusted-sales", "allocation"],
  ["before-stock", "allocation"],
  ["target", "adjusted-target"],
  ["direct-factor", "adjusted-target"],
  ["performance-factor", "adjusted-target"],
  ["adjusted-target", "allocation"],
  ["water-rule", "allocation"],
  ["allocation", "paired"],
  ["pairing-rule", "paired"],
  ["purchase", "unit-gross"],
  ["retail", "unit-gross"],
  ["wholesale", "unit-gross"],
  ["retail-factor", "unit-gross"],
  ["wholesale-factor", "unit-gross"],
  ["logistics-factor", "unit-logistics"],
  ["unit-gross", "unit-net"],
  ["unit-logistics", "unit-net"],
  ["unit-fixed", "unit-net"],
  ["unit-net", "store-net"],
  ["allocation", "store-net"],
];

export default function ReplenishmentGraph({
  result,
  store,
  focusNode,
  commercial,
  model,
}: {
  result: VesselReplenishment;
  store: ReplenishmentStore;
  focusNode?: string;
  commercial: CommercialResult;
  model: string;
}) {
  const [positions, setPositions] = useState(initialPositions);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [selected, setSelected] = useState("allocation");
  const marker = useId().replaceAll(":", "");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    id?: string;
    x: number;
    y: number;
    originalX: number;
    originalY: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    if (focusNode && initialPositions[focusNode]) setSelected(focusNode);
  }, [focusNode]);
  const p = result.parameters;
  const rate = (n: number | null) =>
    n === null ? "无销速" : fmt(n * 100, 1) + "%";
  const m = store.models.find((r) => r.model === model)!;
  const adjustedSales = m.weeklySales;
  const originalSales = adjustedSales / store.salesFactor;
  const beforeWos = adjustedSales > 0 ? m.stock / adjustedSales : null;
  const beforeRate = beforeWos === null ? null : beforeWos / store.targetWeeks;
  const afterRate =
    adjustedSales > 0
      ? (m.stock + m.replenishment) / adjustedSales / store.targetWeeks
      : null;
  const pricing = commercial.input.pricing[model];
  const unit = commercial.profit.rows.find(
    (r) => r.storeId === store.id && r.model === model,
  )!;
  const total = commercial.profit.stores.find((r) => r.id === store.id)!;
  const channelLabel = store.channel === "直营" ? "零售" : "批发";
  const money = (n: number) => fmt(n, 2) + " SAR";
  const nodes = [
    {
      id: "sales-factor",
      label: ["销售系数"],
      value: `× ${fmt(store.salesFactor, 2)}`,
      rule: true,
      formula:
        "每家门店独立设置销速系数，用于区域需求倾斜。默认 ×1；完成修改后保存新情景版本。",
    },
    {
      id: "sales",
      label: ["销售速度"],
      value: `${fmt(originalSales, 2)} 台 / 周`,
      formula: `${model} 的模拟周销速；本店全车型周销速为 ${fmt(store.weeklySales, 2)} 台。沿用 Tab1 的 2026-06-08—08-02 八周窗口，按车型权重分摊。`,
    },
    {
      id: "stock",
      label: ["库存"],
      value: `${fmt(m.stock, 0)} 台`,
      formula: `${model} 现有库存 ${m.stock} 台，本店全车型库存 ${store.stock} 台。2026-08-05 模拟库存；本船订单车、现有 VPC 库存和预留不重复计入。`,
    },
    {
      id: "adjusted-sales",
      label: ["销售速度", "加成后"],
      value: `${fmt(adjustedSales, 2)} 台 / 周`,
      formula: `${model}：${fmt(originalSales, 2)} × ${fmt(store.salesFactor, 2)} = ${fmt(adjustedSales, 2)} 台 / 周。门店全车型加成后销速 ${fmt(store.adjustedWeeklySales, 2)} 台 / 周。`,
    },
    {
      id: "before-stock",
      label: ["分车前库存"],
      value:
        beforeWos === null
          ? "无销速"
          : `${fmt(beforeWos, 2)} 周 · ${rate(beforeRate)}`,
      formula: `${model} 库存 WoS = ${m.stock} ÷ ${fmt(adjustedSales, 2)}；满足率 = 库存 WoS ÷ ${fmt(store.targetWeeks, 2)} 周。销速为 0 时不推算 WoS。门店汇总分车前满足率 ${rate(store.beforeSatisfaction)}。`,
    },
    {
      id: "target",
      label: ["目标 WoS"],
      value: `${fmt(p.baseWos, 2)} 周`,
      formula: "基础目标默认覆盖 4 周销售。",
    },
    {
      id: "direct-factor",
      label: ["直营店", "系数"],
      value: `× ${fmt(store.channel === "直营" ? p.directTargetFactor : 1, 2)}`,
      rule: true,
      formula:
        "直营店目标 WoS 乘以直营目标系数；授权店此项为 ×1。该系数改变目标，渠道级差改变起注顺序。",
    },
    {
      id: "performance-factor",
      label: ["绩效系数"],
      value: store.performance
        ? `× ${fmt(p.performanceTargetFactor, 2)}`
        : "× 1 · 未加成",
      rule: true,
      formula:
        "勾选绩效加成的门店，其目标 WoS 乘以绩效目标系数。没有真实绩效评分时，通过门店配置显式指定。",
    },
    {
      id: "adjusted-target",
      label: ["目标 WoS", "加成后"],
      value: `${fmt(store.targetWeeks, 2)} 周`,
      formula: `基准 ${p.baseWos} × 直营系数 ${store.channel === "直营" ? p.directTargetFactor : 1} × 绩效系数 ${store.performance ? p.performanceTargetFactor : 1} = ${fmt(store.targetWeeks, 2)} 周。`,
    },
    {
      id: "water-rule",
      label: ["注水算法", "系数"],
      value: `直营领先 ${fmt(p.channelGap * 100, 0)}pp`,
      rule: true,
      formula: `先扣预留 ${result.summary.reserved} 台和已分订单 ${result.summary.orders} 台。以满足率 + 渠道级差比较水位，最低门店先补。授权偏移 ${p.channelGap * 100} 个百分点；100% 表示直营全部达到目标或已无可补车源后再给授权。`,
    },
    {
      id: "allocation",
      label: ["分车量"],
      value: `车型 ${m.replenishment} 台`,
      formula: `${model} 本轮补库 ${m.replenishment} 台；本店全车型 ${store.replenishment} 台，全网 ${result.summary.replenishment} 台。按门店水位逐台注入，车型库存、车型缺口与搭配约束共同限制分配。补库缺口 = max(0, ceil(加成后销速 × 目标 WoS) − 库存)，订单不计自由库存。`,
    },
    {
      id: "pairing-rule",
      label: ["车型搭配", "系数"],
      value: p.pairingEnabled ? `${p.hotPerSlow} : 1` : "关闭",
      rule: true,
      formula: `同品牌内每 ${p.hotPerSlow} 台畅销车可搭配 1 台滞销车。每店独立计数，不使用另一品牌凑数，任何车型不超过扣除订单和预留后的余量。Fortuner / Highlander / Lexus RX 为本次模拟滞销分类。缺少搭配车或对应缺口时保留余量。`,
    },
    {
      id: "paired",
      label: ["搭配车型", "分车量"],
      value: `搭配 ${p.pairingEnabled && m.slow ? m.replenishment : 0} 台`,
      formula: `${model} 补库 ${m.replenishment} 台，${m.slow ? "为滞销分类车型" : "为畅销分类车型"}；该车型分车后满足率 ${rate(afterRate)}。本店总搭配 ${store.pairedQty} 台，全车型直送 ${store.directQty} 台、VPC 暂存 ${store.vpcQty} 台。`,
    },
  ];
  nodes.push(
    {
      id: "purchase",
      label: ["采购价格"],
      value: money(pricing.purchasePrice),
      formula:
        "采购价为成本价格。修改毛利率时反算采购价，采购价与毛利率共用同一成本依据。",
    },
    {
      id: "retail",
      label: ["零售价格"],
      value: money(pricing.retailPrice),
      formula: "直营店销售基准价；必须高于批发价。",
    },
    {
      id: "wholesale",
      label: ["批发价格"],
      value: money(pricing.wholesalePrice),
      formula: "授权店收入采用批发价，采用厂商供货利润口径。",
    },
    {
      id: "retail-factor",
      label: ["零售单车价", "格系数"],
      value: "× " + fmt(pricing.retailFactor, 2),
      rule: true,
      formula:
        "零售成交价 = 基准零售价格 × 零售系数；低于 1 为折扣，高于 1 为加价。",
    },
    {
      id: "wholesale-factor",
      label: ["批发单车价", "格系数"],
      value: "× " + fmt(pricing.wholesaleFactor, 2),
      rule: true,
      formula:
        "批发成交价 = 基准批发价格 × 批发系数。调整后零售价仍须高于批发价。",
    },
    {
      id: "unit-gross",
      label: [channelLabel + "单车", "毛利"],
      value: money(unit.unitGross),
      formula:
        store.channel +
        "门店：" +
        money(unit.unitPrice) +
        "成交价 − " +
        money(pricing.purchasePrice) +
        "采购价 = " +
        money(unit.unitGross) +
        "。另一渠道价格不参与本店毛利。",
    },
    {
      id: "logistics-factor",
      label: ["物流系数"],
      value: "× " + fmt(commercial.input.logistics[store.id].factor, 2),
      rule: true,
      formula:
        "本店 8 台满载基准单车物流成本 × 高低峰系数 × 8 ÷ 板车容量；直营与授权使用同一物流规则。",
    },
    {
      id: "unit-logistics",
      label: ["单车物流", "成本"],
      value: money(unit.unitLogistics),
      formula:
        "本店 8 台满载基准 " +
        money(commercial.input.logistics[store.id].baseUnitCost) +
        " × 系数 " +
        fmt(commercial.input.logistics[store.id].factor, 2) +
        " × 8 ÷ " +
        p.truckCapacity +
        " = " +
        money(unit.unitLogistics) +
        "。包含直送或中转与末端调拨的完整单车预算。",
    },
    {
      id: "unit-fixed",
      label: ["单车固定", "费用"],
      value: money(unit.unitFixed),
      rule: true,
      formula:
        store.channel === "直营"
          ? "直营店扣除本车型单车固定费用；分配数量 × 单车费用计入门店总成本。同等物流成本下，零售与批发成交价差须大于该费用。"
          : "授权店不扣固定费用，本节点按 0 计算。该车型直营固定费用为 " +
            money(pricing.fixedCost),
    },
    {
      id: "unit-net",
      label: [channelLabel + "单车", "净利"],
      value: money(unit.unitNet),
      formula:
        money(unit.unitGross) +
        "毛利 − " +
        money(unit.unitLogistics) +
        "物流 − " +
        money(unit.unitFixed) +
        "固定费用 = " +
        money(unit.unitNet) +
        "；允许负利润。",
    },
    {
      id: "store-net",
      label: ["门店净利"],
      value: money(total.net),
      formula:
        "本店所有车型的补库数量 × 各车型单车净利之和。预计营业额 " +
        money(total.revenue) +
        "；净利率 " +
        (total.margin === null ? "—" : fmt(total.margin * 100, 2) + "%") +
        "。以补库全部售出作模拟。",
    },
  );
  const chosen = nodes.find((n) => n.id === selected)!;
  function point(e: PointerEvent<SVGSVGElement>) {
    const position = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.current!.getScreenCTM()!.inverse(),
    );
    return { x: position.x, y: position.y };
  }
  function start(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const id =
      (e.target as Element).closest("[data-node]")?.getAttribute("data-node") ??
      undefined;
    const loc = id ? positions[id] : view;
    drag.current = {
      id,
      ...point(e),
      originalX: loc.x,
      originalY: loc.y,
      moved: false,
    };
    svg.current?.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active) return;
    const pos = point(e),
      dx = pos.x - active.x,
      dy = pos.y - active.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) active.moved = true;
    if (active.id)
      setPositions((prev) => ({
        ...prev,
        [active.id!]: {
          x: active.originalX + dx / view.scale,
          y: active.originalY + dy / view.scale,
        },
      }));
    else
      setView((prev) => ({
        ...prev,
        x: active.originalX + dx,
        y: active.originalY + dy,
      }));
  }
  function end(e: PointerEvent<SVGSVGElement>) {
    if (drag.current?.id && !drag.current.moved) setSelected(drag.current.id);
    drag.current = null;
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  }
  function zoom(factor: number) {
    setView((v) => {
      const scale = Math.max(0.5, Math.min(3, v.scale * factor)),
        ratio = scale / v.scale;
      return {
        scale,
        x: 1035 - (1035 - v.x) * ratio,
        y: 677 - (677 - v.y) * ratio,
      };
    });
  }
  return (
    <section className="vr-panel vr-graph-panel">
      <header className="vr-panel-heading">
        <div>
          <small>CALCULATION GRAPH</small>
          <h3>分车、物流与利润计算图</h3>
        </div>
        <span>
          {store.shortName} · {model} · 拖动节点
        </span>
      </header>
      <div className="vr-graph-tools">
        <button aria-label="放大计算图" onClick={() => zoom(1.25)}>
          <Plus size={14} />
        </button>
        <button aria-label="缩小计算图" onClick={() => zoom(0.8)}>
          <Minus size={14} />
        </button>
        <button
          aria-label="适应画布"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
        >
          <Maximize2 size={14} />
        </button>
        <button
          aria-label="重置节点位置"
          onClick={() => {
            setPositions(initialPositions);
            setView({ x: 0, y: 0, scale: 1 });
          }}
        >
          <RotateCcw size={14} />
        </button>
        <span>黄色参数 · 蓝色价格 / 成本 · 点击查看公式</span>
      </div>
      <svg
        ref={svg}
        className="vr-graph-canvas"
        viewBox="0 0 2070 1354"
        aria-label="门店补库存计算依赖图"
        data-testid="replenishment-graph"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <polyline
              points="1,1 9,5 1,9"
              fill="none"
              stroke="#768493"
              strokeWidth="1.5"
            />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {replenishmentEdges.map(([from, to]) => {
            const a = positions[from],
              b = positions[to],
              dx = b.x - a.x,
              dy = b.y - a.y;
            const norm = Math.sqrt((dx / 90) ** 2 + (dy / 44) ** 2);
            if (norm <= 2) return null;
            const related = from === selected || to === selected;
            return (
              <line
                key={from + to}
                data-edge={`${from}:${to}`}
                x1={a.x + dx / norm}
                y1={a.y + dy / norm}
                x2={b.x - dx / norm}
                y2={b.y - dy / norm}
                stroke={related ? "#4f77aa" : "#7c8790"}
                strokeWidth={related ? 3 : 2}
                markerEnd={`url(#${marker})`}
              />
            );
          })}
          {nodes.map((n) => (
            <g
              key={n.id}
              data-node={n.id}
              transform={`translate(${positions[n.id].x} ${positions[n.id].y})`}
              role="button"
              tabIndex={0}
              aria-label={n.label.join("")}
              aria-pressed={selected === n.id}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(n.id);
                }
              }}
            >
              <ellipse
                rx="90"
                ry="44"
                fill={
                  n.rule
                    ? "#fff0ac"
                    : [
                          "purchase",
                          "retail",
                          "wholesale",
                          "unit-logistics",
                        ].includes(n.id)
                      ? "#a9daf7"
                      : "#fff"
                }
                stroke={selected === n.id ? "#5882af" : "#485461"}
                strokeWidth={selected === n.id ? 3 : 2}
              />
              <text
                textAnchor="middle"
                fill="#354457"
                fontSize="19"
                fontWeight="600"
                pointerEvents="none"
              >
                {n.label.map((line, i) => (
                  <tspan
                    key={line}
                    x="0"
                    y={n.label.length === 1 ? -7 : -20 + i * 23}
                  >
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                textAnchor="middle"
                y="24"
                fill="#718096"
                fontSize="13"
                pointerEvents="none"
              >
                {n.value}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <aside className="vr-graph-inspector" aria-live="polite">
        <strong>
          {chosen.label.join("")} <span>{chosen.value}</span>
        </strong>
        <p>{chosen.formula}</p>
      </aside>
    </section>
  );
}
