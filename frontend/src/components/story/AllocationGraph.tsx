"use client";
import { useState, useEffect } from "react";
import type { StoreAllocation } from "@/lib/story/store-planning";
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });
type Node = {
  id: string;
  label: string;
  value: string;
  x: number;
  y: number;
  kind: "input" | "rule" | "compute" | "output";
  detail: string;
};
export default function AllocationGraph({
  result,
  focusNode,
}: {
  result: StoreAllocation;
  focusNode?: string;
}) {
  const [selected, setSelected] = useState("B10");
  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    if (focusNode) setSelected(focusNode);
  }, [focusNode]);
  const { input, rows, summary: s } = result;
  const active = rows.filter(
    (r) =>
      r.weeklySales > 0 &&
      r.effectiveStock < r.weeklySales * r.targetWeeks &&
      (r.allocationCap === null || r.allocationCap > r.orderAllocated),
  );
  const inventory = rows.reduce((s, r) => s + r.effectiveStock, 0);
  const nodes: Node[] = [
    {
      id: "SRC",
      label: "需求侧宽表",
      value: `${rows.length} 门店 × ${input.brand ?? "配置"}`,
      x: 100,
      y: 95,
      kind: "input",
      detail:
        "data/00_客户/门店主数据.csv + data/02_销速/销速汇总_门店.csv。按门店编码与品牌连接，每家门店独立计算；品牌车源独立。",
    },
    {
      id: "STOCK",
      label: "库存快照",
      value: `${fmt(inventory)} 台有效库存`,
      x: 100,
      y: 365,
      kind: "input",
      detail: `data/03_库存/当前库存_门店.csv，${input.source?.stockDate ?? "模拟情景"}。只用自由库存；已锁、冻结库存不参与注水。在途${input.includeTransit ? "假设按期到店并计入" : "因缺少 ETA 暂不计入"}。`,
    },
    {
      id: "SUPPLY",
      label: "可分货数量",
      value: `${fmt(input.supply)} 台情景供给`,
      x: 100,
      y: 635,
      kind: "input",
      detail:
        "1800 台是本次船量情景输入。data 的按月供给为全国销量代理，不能作为船量或 VIN 清单。",
    },
    {
      id: "R1",
      label: "销售速度配置",
      value: "采用来源周销速",
      x: 320,
      y: 65,
      kind: "rule",
      detail:
        "直营按 2026-06-01 至 07-26 的 8 周；授权按 2026-05-01 至 07-31 的 92 天折周。统计截至日距库存快照 60–65 天，保持原始窗口，不推断新增销量。",
    },
    {
      id: "R2",
      label: "目标 WoS 配置",
      value: `直营 ${input.targetDirect} / 授权 ${input.targetAuthorized} 周`,
      x: 320,
      y: 220,
      kind: "rule",
      detail:
        "默认采用库存 CSV 口径：直营 3 周、授权 4 周。目标台数 = 周销速 × 目标 WoS，缺口向上取整为整车。",
    },
    {
      id: "R3",
      label: "库存配置",
      value: input.includeTransit ? "自由 + 假设按期在途" : "仅自由库存",
      x: 320,
      y: 385,
      kind: "rule",
      detail:
        "库存口径是当前快照，尚无到店日库存预测。是否计入在途为本次显式情景假设。",
    },
    {
      id: "R4",
      label: "分货及排除规则",
      value: "整车 · 零销速不补",
      x: 320,
      y: 540,
      kind: "rule",
      detail:
        "没有车型拆包、保底和禁运源数据，默认无保底、无禁运。零销速、库存已达标及分车上限耗尽的门店不注水。可编辑门店分车上限。",
    },
    {
      id: "R5",
      label: "注水算法配置",
      value: `偏移 ${(input.offsetDirect ?? 0) * 100}% / ${(input.offsetAuthorized ?? 0) * 100}%`,
      x: 555,
      y: 665,
      kind: "rule",
      detail:
        "比较有效库存 ÷（周销速 × 目标 WoS）+ 渠道偏移；最低水位先补，满目标后停止。直营优先预设将授权起注水位推迟 30%。整车逐台给最低相对水位的门店，同水位按门店编码确定；追加供给不会回收已注入的车辆。",
    },
    {
      id: "B1",
      label: "需求合并宽表",
      value: `${rows.length} 条门店记录`,
      x: 555,
      y: 95,
      kind: "compute",
      detail:
        "门店 × 品牌连接销速和库存；不把锁定库存当成本船新订单。没有未配订单源数据，默认新订单 0，可通过 GUI 或 CUI 输入情景订单。",
    },
    {
      id: "B2",
      label: "目标 WoS",
      value: `${fmt(rows.reduce((v, r) => v + Math.ceil(r.weeklySales * r.targetWeeks), 0))} 台目标库存`,
      x: 555,
      y: 245,
      kind: "compute",
      detail:
        "各店目标库存分别计算。直营与授权使用各自目标周数，同一品牌共用供给。",
    },
    {
      id: "B3",
      label: "库存宽表",
      value: `${fmt(inventory)} 台参与水位`,
      x: 555,
      y: 395,
      kind: "compute",
      detail:
        "E 为选定口径的自由库存。订单车先保障，但属于订单履约，不加到补库水位。锁定和冻结库存仅用于核对。",
    },
    {
      id: "B4",
      label: "可分货量",
      value: `${fmt(input.supply - s.orders)} 台可注水`,
      x: 555,
      y: 545,
      kind: "compute",
      detail: `先扣除 ${fmt(s.orders)} 台订单分配，再将 ${fmt(input.supply - s.orders)} 台用于注水。分车上限约束订单与补库的合计。`,
    },
    {
      id: "ORD",
      label: "已订订单优先",
      value: `${fmt(s.orders)} 台 / 缺 ${fmt(s.orderShortage)}`,
      x: 785,
      y: 65,
      kind: "compute",
      detail:
        "按交期、门店编码排序，先分已确认且未配的情景订单。已经锁定在当前库存中的车辆不重复分配。",
    },
    {
      id: "B5",
      label: "保底",
      value: "默认 0 · 未配置",
      x: 785,
      y: 205,
      kind: "compute",
      detail:
        "data 没有独立保底政策数据，本次不额外生成保底量。订单保障在独立订单节点执行。",
    },
    {
      id: "B6",
      label: "不参与分货商宽表",
      value: `${rows.length - active.length} 家不注水`,
      x: 785,
      y: 345,
      kind: "compute",
      detail:
        "库存已达目标、零销速或额度耗尽的门店不参与补库；它们仍保留订单分配与最终门店归属。",
    },
    {
      id: "B7",
      label: "参与分货商宽表",
      value: `${active.length} 家可注水`,
      x: 785,
      y: 485,
      kind: "compute",
      detail:
        "合并周销速、有效库存、目标 WoS、渠道偏移和剩余额度。演示中展示全部门店，不用少量代表店代替数据。",
    },
    {
      id: "B8",
      label: "注水算法结果",
      value: `${fmt(s.replenishment)} 台补库`,
      x: 1015,
      y: 485,
      kind: "output",
      detail: `整车注水已分 ${fmt(s.replenishment)} 台，距目标仍缺 ${fmt(s.replenishmentGap)} 台。点击“分车计划模拟”逐步观察水位与分配过程。`,
    },
    {
      id: "B9",
      label: "留仓量",
      value: `${fmt(s.retained)} 台留仓`,
      x: 1015,
      y: 645,
      kind: "output",
      detail:
        "剩余供给超过可补缺口或门店额度时保留，不为耗尽供给而把库存补到目标以上。",
    },
    {
      id: "B10",
      label: "最终分货结果",
      value: `${fmt(s.assigned)} 台归属门店`,
      x: 1015,
      y: 190,
      kind: "output",
      detail: `${fmt(s.orders)} 订单 + ${fmt(s.replenishment)} 补库 + ${fmt(s.retained)} 留仓 = ${fmt(input.supply)} 台。归属到门店，下一步通过 /delivery-plan 决定直送、VPC 和批次。`,
    },
  ];
  const edges = [
    ["SRC", "B1"],
    ["R1", "B1"],
    ["R2", "B2"],
    ["B1", "B2"],
    ["STOCK", "B3"],
    ["R3", "B3"],
    ["B1", "B3"],
    ["SUPPLY", "B4"],
    ["B1", "ORD"],
    ["ORD", "B4"],
    ["R4", "B5"],
    ["B5", "B6"],
    ["B2", "B6"],
    ["R4", "B6"],
    ["B1", "B7"],
    ["B2", "B7"],
    ["B3", "B7"],
    ["B4", "B7"],
    ["B6", "B7"],
    ["R5", "B8"],
    ["B7", "B8"],
    ["B4", "B8"],
    ["B8", "B9"],
    ["B4", "B9"],
    ["B8", "B10"],
    ["ORD", "B10"],
    ["B6", "B10"],
    ["B7", "B10"],
  ];
  const chosen = nodes.find((n) => n.id === selected) ?? nodes[0];
  const related = edges.filter((e) => e.includes(selected)).flat();
  const palette = {
    input: "#dcedf5",
    rule: "#fff3d5",
    compute: "#eff2f0",
    output: "#dff1e9",
  };
  return (
    <section className="planning-panel ontology-panel">
      <header>
        <h2>分车图谱</h2>
        <p>参照本体节点 B1–B10。点击椭圆查看数据与规则，相关依赖直线会高亮。</p>
      </header>
      <div className="ontology-toolbar">
        <span>
          <i style={{ background: palette.input }} />
          源数据 <i style={{ background: palette.rule }} />
          配置 <i style={{ background: palette.compute }} />
          计算 <i style={{ background: palette.output }} />
          结果
        </span>
        <label>
          缩放{" "}
          <select
            aria-label="图谱缩放"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0}>适应画布</option>
            <option value={0.8}>80%</option>
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
          </select>
        </label>
      </div>
      <div className="ontology-scroll">
        <svg
          data-testid="allocation-graph"
          role="group"
          aria-label="分车本体逻辑图谱"
          viewBox="0 0 1130 715"
          style={{ width: zoom ? 1130 * zoom : "100%" }}
        >
          <defs>
            <marker
              id="allocation-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <polygon points="0,0 10,5 0,10" fill="#85a19a" />
            </marker>
            <marker
              id="allocation-arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <polygon points="0,0 10,5 0,10" fill="#288a72" />
            </marker>
          </defs>
          {edges.map(([from, to]) => {
            const a = nodes.find((n) => n.id === from)!,
              b = nodes.find((n) => n.id === to)!;
            const dx = b.x - a.x,
              dy = b.y - a.y;
            const factor =
              1 / Math.sqrt((dx * dx) / (94 * 94) + (dy * dy) / (38 * 38));
            const on = from === selected || to === selected;
            return (
              <line
                key={from + to}
                x1={a.x + dx * factor}
                y1={a.y + dy * factor}
                x2={b.x - dx * factor}
                y2={b.y - dy * factor}
                stroke={on ? "#288a72" : "#b4c3be"}
                strokeWidth={on ? 2 : 1}
                opacity={on ? 1 : 0.46}
                markerEnd={`url(#allocation-arrow${on ? "-active" : ""})`}
              />
            );
          })}
          {nodes.map((n) => (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${n.id} ${n.label}`}
              aria-pressed={n.id === selected}
              onClick={() => setSelected(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(n.id);
                }
              }}
              className="ontology-node"
            >
              <ellipse
                cx={n.x}
                cy={n.y}
                rx="94"
                ry="38"
                fill={palette[n.kind]}
                stroke={
                  n.id === selected
                    ? "#24876f"
                    : related.includes(n.id)
                      ? "#8eb9a8"
                      : "#cad9d2"
                }
                strokeWidth={n.id === selected ? 2.5 : 1}
              />
              <text
                x={n.x}
                y={n.y - 7}
                textAnchor="middle"
                fill="#31574f"
                fontSize="14"
                fontWeight="600"
              >
                {n.label}
              </text>
              <text
                x={n.x}
                y={n.y + 13}
                textAnchor="middle"
                fill="#68867f"
                fontSize="12"
              >
                {n.value}
              </text>
              <text
                x={n.x + 76}
                y={n.y - 29}
                fontSize="9"
                textAnchor="middle"
                fill="#839b91"
              >
                {n.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <aside className="ontology-inspector" data-testid="graph-inspector">
        <small>
          {chosen.id} ·{" "}
          {chosen.kind === "input"
            ? "源数据"
            : chosen.kind === "rule"
              ? "规则"
              : chosen.kind === "output"
                ? "结果"
                : "计算节点"}
        </small>
        <h3>
          {chosen.label} <span>{chosen.value}</span>
        </h3>
        <p>{chosen.detail}</p>
        <p className="ontology-dependencies">
          输入：
          {edges
            .filter((e) => e[1] === chosen.id)
            .map((e) => nodes.find((n) => n.id === e[0])!.label)
            .join("、") || "源数据 / 情景参数"}
          　→　输出：
          {edges
            .filter((e) => e[0] === chosen.id)
            .map((e) => nodes.find((n) => n.id === e[1])!.label)
            .join("、") || "保存分车快照"}
        </p>
      </aside>
    </section>
  );
}
