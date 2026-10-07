"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useId, useState, type ReactNode } from "react";
import { ArrowUpRight, CircleDot, GitBranch } from "lucide-react";

export type RelationshipNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  kicker: string;
  value?: string;
  lines?: string[];
  tone: "data" | "rule" | "result" | "excluded";
  summary: string;
  rule: string;
  facts?: Array<{ label: string; value: string }>;
};
export type RelationshipEdge = {
  from: string;
  to: string;
  label?: string;
  status?: "active" | "excluded" | "rule";
  // Custom paths keep orthogonal branches separated where the reference graph converges.
  path?: string;
  labelX?: number;
  labelY?: number;
};

export default function RelationshipGraph({
  title,
  subtitle,
  nodes,
  edges,
  initialNode,
  testId,
  controls,
  height = 460,
}: {
  title: string;
  subtitle: string;
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  initialNode: string;
  testId: string;
  controls?: ReactNode;
  height?: number;
}) {
  const { t: translateText } = useI18n();

  const id = useId().replace(/:/g, "");
  const [selectedId, setSelectedId] = useState(initialNode);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const connected = new Set(
    edges
      .filter((edge) => edge.from === selected.id || edge.to === selected.id)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  return (
    <section className="relationship-board" data-testid={testId}>
      <header className="visual-board-heading">
        <div>
          <span className="visual-eyebrow">
            <GitBranch size={12} /> DECISION NETWORK
          </span>
          <h3>{translateText(title)}</h3>
          <p>{translateText(subtitle)}</p>
        </div>
        <span className="visual-interaction-hint">
          <CircleDot size={13} />
          {translateText("点击节点查看依据")}
        </span>
      </header>
      {translateText(controls)}
      <div className="relationship-scroll">
        <svg
          className="relationship-svg"
          viewBox={`0 0 840 ${height}`}
          aria-label={translateText(title)}
        >
          <defs>
            <pattern
              id={`${id}-grid`}
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="#dae3de" />
            </pattern>
            {["active", "excluded", "rule"].map((status) => (
              <marker
                key={status}
                id={`${id}-${status}`}
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={
                    status === "active"
                      ? "#66967e"
                      : status === "rule"
                        ? "#bd9d63"
                        : "#b5a490"
                  }
                />
              </marker>
            ))}
          </defs>
          <rect width="840" height={height} fill={`url(#${id}-grid)`} />
          <text className="graph-column-label" x="24" y="25">
            {translateText("业务输入")}
          </text>
          <text className="graph-column-label" x="242" y="25">
            {translateText("筛选与决策")}
          </text>
          <text className="graph-column-label" x="468" y="25">
            {translateText("计算与约束")}
          </text>
          <text className="graph-column-label" x="674" y="25">
            {translateText("业务结果")}
          </text>
          {edges.map((edge, index) => {
            const from = nodes.find((node) => node.id === edge.from)!;
            const to = nodes.find((node) => node.id === edge.to)!;
            const sx = from.x + from.width,
              sy = from.y + from.height / 2,
              tx = to.x,
              ty = to.y + to.height / 2;
            const status = edge.status ?? "active";
            const d =
              edge.path ??
              `M${sx},${sy} C${sx + (tx - sx) / 2},${sy} ${tx - (tx - sx) / 2},${ty} ${tx},${ty}`;
            return (
              <g
                key={`${edge.from}-${edge.to}-${index}`}
                className={`graph-edge ${status} ${edge.from === selected.id || edge.to === selected.id ? "focused" : ""}`}
                data-edge-status={status}
              >
                <path d={d} markerEnd={`url(#${id}-${status})`} />
                {translateText(
                  edge.label && (
                    <text
                      x={edge.labelX ?? (sx + tx) / 2}
                      y={edge.labelY ?? (sy + ty) / 2 - 9}
                      textAnchor="middle"
                    >
                      {translateText(edge.label)}
                    </text>
                  ),
                )}
              </g>
            );
          })}
          {nodes.map((node, index) => (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              role="button"
              tabIndex={0}
              aria-label={translateText(`查看 ${node.title}`)}
              aria-pressed={selected.id === node.id}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(node.id);
                }
              }}
              className={`relationship-node ${node.tone} ${selected.id === node.id ? "selected" : ""} ${connected.has(node.id) ? "connected" : ""}`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <rect
                className="node-selection-halo"
                x="-4"
                y="-4"
                width={node.width + 8}
                height={node.height + 8}
                rx="15"
              />
              <rect
                className="node-surface"
                width={node.width}
                height={node.height}
                rx="11"
              />
              <circle cx="15" cy="17" r="3" />
              <text className="node-kicker" x="24" y="20">
                {translateText(node.kicker)}
              </text>
              <text className="node-title" x="14" y="43">
                {translateText(node.title)}
              </text>
              {translateText(
                node.value && (
                  <text className="node-value" x="14" y="75">
                    {translateText(node.value)}
                  </text>
                ),
              )}
              {node.lines?.map((line, i) => (
                <text
                  className="node-caption"
                  key={line}
                  x="14"
                  y={(node.value ? 98 : 66) + i * 19}
                >
                  {translateText(line)}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div
        className={`graph-inspector ${selected.tone}`}
        data-testid="graph-inspector"
        aria-live="polite"
      >
        <div className="graph-inspector-title">
          <span>{translateText(selected.kicker)}</span>
          <strong>{translateText(selected.title)}</strong>
          <ArrowUpRight size={15} />
        </div>
        <div className="graph-inspector-copy">
          <p>{translateText(selected.summary)}</p>
          <small>{translateText(selected.rule)}</small>
        </div>
        {selected.facts && (
          <div className="graph-inspector-facts">
            {selected.facts.map((fact) => (
              <div key={fact.label}>
                <small>{translateText(fact.label)}</small>
                <strong>{translateText(fact.value)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="visual-legend">
        <span>
          <i className="data" />
          {translateText("数据与供给")}
        </span>
        <span>
          <i className="rule" />
          {translateText("规则与约束")}
        </span>
        <span>
          <i className="result" />
          {translateText("决策结果")}
        </span>
        <span>
          <i className="excluded" />
          {translateText("不可执行 / 待关闭")}
        </span>
      </footer>
    </section>
  );
}
