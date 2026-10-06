"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  calculateVesselCoverage,
  vesselOverview,
} from "@/lib/story/vessel-overview";

const COLORS = {
  toyota: "#4b76cf",
  lexus: "#9270c8",
  direct: "#4b76cf",
  authorized: "#239d96",
  directShortage: "#c6d5f3",
  authorizedShortage: "#bfe3df",
};
const REGION_COLORS = ["#4b76cf", "#239d96", "#9270c8", "#d89342", "#c76685"];
const LINE_DASHES = [undefined, "6 3", "2 3", "9 3 2 3", "5 2 2 2"];
const fmt = (value: number, decimals = 0) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: decimals });
const shortMonth = (month: string) =>
  `${month.slice(2, 4)}.${month.slice(5, 7)}`;
const monthLabel = (month: string) =>
  `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;
const shortModel = (model: string) =>
  model
    .replace("Land Cruiser", "LC")
    .replace(/^Lexus /, "")
    .replace("Hybrid", "HEV");
const weeklyRate = (sales: number, month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return (sales * 7) / new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};
const niceMax = (values: number[]) => {
  const maximum = Math.max(1, ...values);
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  return (Math.ceil((maximum / magnitude) * 2) * magnitude) / 2;
};
const axisLabel = (value: number) =>
  value >= 10000
    ? `${fmt(value / 10000, 1)}万`
    : fmt(value, value < 10 ? 1 : 0);

type Series = { label: string; color: string; values: number[]; dash?: string };
type Segment = { label: string; value: number; color: string };
type Bar = {
  id: string;
  label: string;
  fullLabel?: string;
  segments: Segment[];
};
type TooltipValue = { label: string; value: number; color: string };
type TooltipData = {
  title: string;
  values: TooltipValue[];
  unit: string;
  decimals?: number;
};
type LegendItem = { label: string; color: string; dash?: string };

function usePlotWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(380);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      setWidth(
        Math.max(180, Math.round(element.getBoundingClientRect().width)),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function Legend({
  items,
  lines = false,
}: {
  items: LegendItem[];
  lines?: boolean;
}) {
  return (
    <ul
      className={`vo-legend${lines ? " vo-legend--lines" : ""}`}
      aria-label="图例"
    >
      {items.map((item) => (
        <li key={item.label}>
          {lines ? (
            <svg width="20" height="10" aria-hidden="true">
              <line
                x1="1"
                x2="19"
                y1="5"
                y2="5"
                stroke={item.color}
                strokeWidth="2.5"
                strokeDasharray={item.dash}
              />
            </svg>
          ) : (
            <i style={{ backgroundColor: item.color }} aria-hidden="true" />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ data }: { data: TooltipData | null }) {
  if (!data) return null;
  return (
    <div className="vo-tooltip" role="tooltip">
      <strong>{data.title}</strong>
      {data.values.map((item) => (
        <div key={item.label}>
          <span>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
          <b>
            {fmt(item.value, data.decimals)} <small>{data.unit}</small>
          </b>
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  id,
  title,
  subtitle,
  type,
  children,
  footer,
  legend,
}: {
  id: string;
  title: string;
  subtitle: string;
  type: "bar" | "stacked-bar" | "line";
  children: ReactNode;
  footer?: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <article
      className="vo-chart"
      data-testid={`overview-chart-${id}`}
      data-chart={type}
    >
      <header className="vo-chart-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </header>
      {legend}
      {children}
      {footer && <footer className="vo-chart-footer">{footer}</footer>}
    </article>
  );
}

function HorizontalBars({
  title,
  rows,
  unit = "台",
  height = 288,
  labelWidth = 76,
}: {
  title: string;
  rows: Bar[];
  unit?: string;
  height?: number;
  labelWidth?: number;
}) {
  const { ref, width } = usePlotWidth();
  const svgId = useId();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const top = 19,
    bottom = 31,
    right = 43;
  const plotWidth = Math.max(40, width - labelWidth - right);
  const maximum = niceMax(
    rows.map((row) =>
      row.segments.reduce((sum, segment) => sum + segment.value, 0),
    ),
  );
  const stride = (height - top - bottom) / Math.max(1, rows.length);
  const barHeight = Math.min(21, stride * 0.52);
  return (
    <div className="vo-plot" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={svgId}
      >
        <title id={svgId}>
          {title}，单位：{unit}
        </title>
        <text className="vo-unit" x={labelWidth} y="11">
          {unit}
        </text>
        {[0, 1, 2, 3, 4].map((tick) => {
          const x = labelWidth + (plotWidth * tick) / 4;
          return (
            <g key={tick} aria-hidden="true">
              <line
                className="vo-gridline"
                x1={x}
                x2={x}
                y1={top}
                y2={height - bottom}
              />
              <text
                className="vo-axis"
                x={x}
                y={height - 11}
                textAnchor="middle"
              >
                {axisLabel((maximum * tick) / 4)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const center = top + stride * (index + 0.5);
          const total = row.segments.reduce(
            (sum, segment) => sum + segment.value,
            0,
          );
          const detail = {
            title: row.fullLabel ?? row.label,
            values: row.segments,
            unit,
          };
          let cumulative = 0;
          return (
            <g
              key={row.id}
              className="vo-datum"
              tabIndex={0}
              role="img"
              aria-label={`${row.fullLabel ?? row.label}，${row.segments.map((segment) => `${segment.label} ${fmt(segment.value)} ${unit}`).join("，")}，合计 ${fmt(total)} ${unit}`}
              onMouseEnter={() => setTooltip(detail)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(detail)}
              onBlur={() => setTooltip(null)}
            >
              <rect
                className="vo-hit-target"
                x="0"
                y={center - stride / 2 + 1}
                width={width}
                height={stride - 2}
                rx="4"
                fill="transparent"
              />
              <text
                className="vo-bar-label"
                x={labelWidth - 9}
                y={center + 4}
                textAnchor="end"
              >
                {row.label}
              </text>
              {row.segments.map((segment) => {
                const x = labelWidth + (cumulative / maximum) * plotWidth;
                cumulative += segment.value;
                return (
                  <rect
                    key={segment.label}
                    x={x}
                    y={center - barHeight / 2}
                    width={(segment.value / maximum) * plotWidth}
                    height={barHeight}
                    rx="1.5"
                    fill={segment.color}
                  />
                );
              })}
              <text
                className="vo-bar-value"
                x={width - 1}
                y={center + 4}
                textAnchor="end"
              >
                {fmt(total)}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip data={tooltip} />
    </div>
  );
}

function SupplyHistoryChart() {
  const { ref, width } = usePlotWidth();
  const svgId = useId();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const history = vesselOverview.supplyHistory;
  const height = 288,
    left = 43,
    right = 9,
    top = 25,
    bottom = 36;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const maximum = niceMax(history.map((row) => row.toyota + row.lexus));
  const stride = plotWidth / history.length;
  const barWidth = Math.min(23, stride * 0.65);
  const recentIndex = history.findIndex((row) => row.month === "2026-03");
  return (
    <div className="vo-plot" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={svgId}
      >
        <title id={svgId}>
          历史 13
          个月代表船次供给，丰田与雷克萨斯堆叠，单位：台。近期海峡影响为模拟假设。
        </title>
        {recentIndex >= 0 && (
          <rect
            x={left + stride * recentIndex}
            y={top}
            width={stride * (history.length - recentIndex)}
            height={plotHeight}
            fill="#f7f3ec"
            rx="3"
          />
        )}
        <text className="vo-unit" x={left} y="12">
          台
        </text>
        {recentIndex >= 0 && (
          <text
            className="vo-assumption-label"
            x={width - right}
            y="12"
            textAnchor="end"
          >
            霍尔木兹情景假设
          </text>
        )}
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = top + plotHeight - (plotHeight * tick) / 4;
          return (
            <g key={tick} aria-hidden="true">
              <line
                className="vo-gridline"
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
              />
              <text className="vo-axis" x={left - 8} y={y + 4} textAnchor="end">
                {axisLabel((maximum * tick) / 4)}
              </text>
            </g>
          );
        })}
        {history.map((row, index) => {
          const x = left + stride * (index + 0.5);
          const toyotaHeight = (row.toyota / maximum) * plotHeight;
          const lexusHeight = (row.lexus / maximum) * plotHeight;
          const detail = {
            title: monthLabel(row.month),
            values: [
              { label: "丰田", value: row.toyota, color: COLORS.toyota },
              { label: "雷克萨斯", value: row.lexus, color: COLORS.lexus },
              {
                label: "合计",
                value: row.toyota + row.lexus,
                color: "#718094",
              },
            ],
            unit: "台",
          };
          return (
            <g
              key={row.month}
              tabIndex={0}
              className="vo-datum"
              role="img"
              aria-label={`${monthLabel(row.month)}，丰田 ${fmt(row.toyota)} 台，雷克萨斯 ${fmt(row.lexus)} 台，总供给 ${fmt(row.toyota + row.lexus)} 台`}
              onMouseEnter={() => setTooltip(detail)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(detail)}
              onBlur={() => setTooltip(null)}
            >
              <rect
                className="vo-hit-target"
                x={x - stride / 2}
                y={top}
                width={stride}
                height={plotHeight}
                fill="transparent"
                rx="3"
              />
              <rect
                x={x - barWidth / 2}
                y={top + plotHeight - toyotaHeight}
                width={barWidth}
                height={toyotaHeight}
                fill={COLORS.toyota}
                rx="1"
              />
              <rect
                x={x - barWidth / 2}
                y={top + plotHeight - toyotaHeight - lexusHeight}
                width={barWidth}
                height={lexusHeight}
                fill={COLORS.lexus}
                rx="1"
              />
              {(index % 3 === 0 || index === history.length - 1) && (
                <text
                  className="vo-axis"
                  x={x}
                  y={height - 13}
                  textAnchor="middle"
                >
                  {shortMonth(row.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip data={tooltip} />
    </div>
  );
}

function SalesLines({ title, series }: { title: string; series: Series[] }) {
  const { ref, width } = usePlotWidth();
  const svgId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const months = vesselOverview.months;
  const height = 268,
    left = 42,
    right = 10,
    top = 23,
    bottom = 34;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const maximum = niceMax(series.flatMap((item) => item.values));
  const stride = plotWidth / Math.max(1, months.length - 1);
  const xAt = (index: number) => left + stride * index;
  const yAt = (value: number) => top + plotHeight * (1 - value / maximum);
  const tooltip =
    activeIndex === null
      ? null
      : {
          title: monthLabel(months[activeIndex]),
          values: series.map((item) => ({
            label: item.label,
            color: item.color,
            value: item.values[activeIndex],
          })),
          unit: "台 / 周",
          decimals: 1,
        };
  return (
    <div className="vo-plot" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={svgId}
      >
        <title id={svgId}>
          {title}，13 个月历史销量折算周销速，单位：台 / 周
        </title>
        <text className="vo-unit" x={left} y="11">
          台 / 周
        </text>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = yAt((maximum * tick) / 4);
          return (
            <g key={tick} aria-hidden="true">
              <line
                className="vo-gridline"
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
              />
              <text className="vo-axis" x={left - 8} y={y + 4} textAnchor="end">
                {axisLabel((maximum * tick) / 4)}
              </text>
            </g>
          );
        })}
        {series.map((item) => (
          <g key={item.label} aria-hidden="true" pointerEvents="none">
            <path
              d={item.values
                .map(
                  (value, index) =>
                    `${index ? "L" : "M"}${xAt(index)},${yAt(value)}`,
                )
                .join(" ")}
              fill="none"
              stroke={item.color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={item.dash}
            />
            {item.values.map((value, index) => (
              <circle
                key={months[index]}
                cx={xAt(index)}
                cy={yAt(value)}
                r={activeIndex === index ? 4.5 : 2.2}
                fill={item.color}
                stroke="white"
                strokeWidth="1"
              />
            ))}
          </g>
        ))}
        {activeIndex !== null && (
          <line
            className="vo-crosshair"
            x1={xAt(activeIndex)}
            x2={xAt(activeIndex)}
            y1={top}
            y2={top + plotHeight}
            pointerEvents="none"
          />
        )}
        {months.map((month, index) => (
          <g
            key={month}
            tabIndex={0}
            role="img"
            className="vo-line-datum"
            aria-label={`${monthLabel(month)}，${series.map((item) => `${item.label} ${fmt(item.values[index], 1)} 台每周`).join("，")}`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
          >
            <rect
              x={Math.max(left, xAt(index) - stride / 2)}
              y={top}
              width={
                index === 0 || index === months.length - 1 ? stride / 2 : stride
              }
              height={plotHeight}
              fill="transparent"
            />
            {(index % 3 === 0 || index === months.length - 1) && (
              <text
                className="vo-axis"
                x={xAt(index)}
                y={height - 12}
                textAnchor="middle"
              >
                {shortMonth(month)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <Tooltip data={tooltip} />
    </div>
  );
}

function StockBars({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; label: string; value: number; color: string }[];
}) {
  const { ref, width } = usePlotWidth();
  const svgId = useId();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const height = 268,
    left = 43,
    right = 8,
    top = 24,
    bottom = 34;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const maximum = niceMax(rows.map((row) => row.value));
  const stride = plotWidth / rows.length;
  const barWidth = Math.min(46, stride * 0.48);
  return (
    <div className="vo-plot" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-labelledby={svgId}
      >
        <title id={svgId}>{title}，单位：台</title>
        <text className="vo-unit" x={left} y="11">
          台
        </text>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = top + plotHeight * (1 - tick / 4);
          return (
            <g key={tick} aria-hidden="true">
              <line
                className="vo-gridline"
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
              />
              <text className="vo-axis" x={left - 8} y={y + 4} textAnchor="end">
                {axisLabel((maximum * tick) / 4)}
              </text>
            </g>
          );
        })}
        {rows.map((row, index) => {
          const x = left + stride * (index + 0.5),
            barHeight = (row.value / maximum) * plotHeight;
          const detail = {
            title: row.label,
            values: [{ label: "当前库存", value: row.value, color: row.color }],
            unit: "台",
          };
          return (
            <g
              key={row.id}
              tabIndex={0}
              className="vo-datum"
              role="img"
              aria-label={`${row.label}，当前库存 ${fmt(row.value)} 台`}
              onMouseEnter={() => setTooltip(detail)}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip(detail)}
              onBlur={() => setTooltip(null)}
            >
              <rect
                className="vo-hit-target"
                x={x - stride / 2 + 2}
                y={top}
                width={stride - 4}
                height={plotHeight}
                fill="transparent"
                rx="3"
              />
              <rect
                x={x - barWidth / 2}
                y={top + plotHeight - barHeight}
                width={barWidth}
                height={barHeight}
                fill={row.color}
                rx="3"
              />
              <text
                className="vo-bar-value"
                x={x}
                y={top + plotHeight - barHeight - 8}
                textAnchor="middle"
              >
                {fmt(row.value)}
              </text>
              <text
                className="vo-axis"
                x={x}
                y={height - 12}
                textAnchor="middle"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip data={tooltip} />
    </div>
  );
}

function StoreBars({ metric }: { metric: "weeklySales" | "stock" }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const svgId = useId();
  const rows = vesselOverview.stores;
  const unit = metric === "weeklySales" ? "台 / 周" : "台";
  const title =
    metric === "weeklySales" ? "全部门店近 8 周周均销量" : "全部门店当前库存";
  const height = 265,
    left = 43,
    right = 11,
    top = 24,
    bottom = 40;
  const stride = 31;
  const width = left + right + stride * rows.length;
  const plotHeight = height - top - bottom;
  const maximum = niceMax(rows.map((row) => row[metric]));
  return (
    <div className="vo-store-plot">
      <div
        className="vo-chart-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${title}，${rows.length} 家门店，可横向滚动查看全部柱形`}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-labelledby={svgId}
        >
          <title id={svgId}>
            {title}，共 {rows.length} 家门店，按周均销量降序，单位：{unit}
          </title>
          <text className="vo-unit" x={left} y="11">
            {unit}
          </text>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = top + plotHeight * (1 - tick / 4);
            return (
              <g key={tick} aria-hidden="true">
                <line
                  className="vo-gridline"
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                />
                <text
                  className="vo-axis"
                  x={left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {axisLabel((maximum * tick) / 4)}
                </text>
              </g>
            );
          })}
          {rows.map((row, index) => {
            const x = left + stride * (index + 0.5),
              barHeight = (row[metric] / maximum) * plotHeight;
            const color =
              row.channel === "直营" ? COLORS.direct : COLORS.authorized;
            const detail = {
              title: `${index + 1}. ${row.name}`,
              values: [
                {
                  label: `${row.shortName} · ${row.channel} · ${row.region}`,
                  value: row[metric],
                  color,
                },
              ],
              unit,
              decimals: metric === "weeklySales" ? 1 : 0,
            };
            return (
              <g
                key={row.id}
                data-store-id={row.id}
                className="vo-datum"
                tabIndex={0}
                role="img"
                aria-label={`第 ${index + 1} 位，${row.name}，${row.channel}，${metric === "weeklySales" ? "近8周周均销量" : "当前库存"} ${fmt(row[metric], metric === "weeklySales" ? 1 : 0)} ${unit}`}
                onMouseEnter={() => setTooltip(detail)}
                onMouseLeave={() => setTooltip(null)}
                onFocus={() => setTooltip(detail)}
                onBlur={() => setTooltip(null)}
              >
                <rect
                  className="vo-hit-target"
                  x={x - stride / 2}
                  y={top}
                  width={stride}
                  height={plotHeight}
                  fill="transparent"
                  rx="3"
                />
                <rect
                  x={x - 8.5}
                  y={top + plotHeight - barHeight}
                  width="17"
                  height={barHeight}
                  fill={color}
                  rx="2"
                />
                <text
                  className="vo-axis vo-store-label"
                  x={x}
                  y={height - 18}
                  textAnchor="middle"
                >
                  {row.shortName}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Tooltip data={tooltip} />
    </div>
  );
}

function OverviewSection({
  number,
  title,
  note,
  columns = 2,
  children,
}: {
  number: string;
  title: string;
  note: string;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="vo-section" aria-labelledby={headingId}>
      <header className="vo-section-heading">
        <div>
          <span aria-hidden="true">{number}</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <p>{note}</p>
      </header>
      <div className={`vo-grid vo-grid--${columns}`}>{children}</div>
    </section>
  );
}

export default function VesselOverviewDashboard() {
  const data = vesselOverview;
  const summary = data.summary;
  const coverage = calculateVesselCoverage(data);
  const shortageRows = (metric: "order" | "replenishment"): Bar[] =>
    [...data.models]
      .sort((a, b) =>
        metric === "order"
          ? b.directOrderShortage +
            b.authorizedOrderShortage -
            (a.directOrderShortage + a.authorizedOrderShortage)
          : b.directReplenishmentShortage +
            b.authorizedReplenishmentShortage -
            (a.directReplenishmentShortage + a.authorizedReplenishmentShortage),
      )
      .map((model) => ({
        id: model.model,
        label: shortModel(model.model),
        fullLabel: `${model.brand} · ${model.model}`,
        segments: [
          {
            label: "直营",
            value:
              metric === "order"
                ? model.directOrderShortage
                : model.directReplenishmentShortage,
            color: COLORS.direct,
          },
          {
            label: "授权",
            value:
              metric === "order"
                ? model.authorizedOrderShortage
                : model.authorizedReplenishmentShortage,
            color: COLORS.authorized,
          },
        ],
      }));
  const channelLegend = [
    { label: "直营", color: COLORS.direct },
    { label: "授权", color: COLORS.authorized },
  ];
  const vpcSeries = data.vpcs.map((vpc, index) => ({
    label: vpc.id,
    color: REGION_COLORS[index],
    dash: LINE_DASHES[index],
    values: vpc.monthlySales.map((sales, monthIndex) =>
      weeklyRate(sales, data.months[monthIndex]),
    ),
  }));
  const regionSeries = data.regions.map((region, index) => ({
    label: region.name,
    color: REGION_COLORS[index],
    dash: LINE_DASHES[index],
    values: region.monthlySales.map((sales, monthIndex) =>
      weeklyRate(sales, data.months[monthIndex]),
    ),
  }));
  const supplyDelta = `${summary.supplyChangePercent > 0 ? "+" : ""}${fmt(summary.supplyChangePercent, 1)}%`;
  return (
    <div className="vessel-overview" data-testid="vessel-overview">
      <header className="vo-heading">
        <div>
          <small>VESSEL ALLOCATION · OVERVIEW</small>
          <h2>供需与库存总览</h2>
          <p>从当船供给到仓店销速，查看本轮分车依据。</p>
        </div>
        <div className="vo-snapshot">
          <span>情景模拟</span>
          <small>模拟快照 {data.snapshotDate}</small>
        </div>
      </header>
      <div className="vo-kpis" aria-label="总览关键指标">
        <article>
          <span>当船供给</span>
          <strong>
            {fmt(summary.supply)}
            <small>台</small>
          </strong>
          <p>
            <i
              className={
                summary.supplyChangePercent < 0
                  ? "vo-delta-down"
                  : "vo-delta-up"
              }
            >
              {supplyDelta}
            </i>{" "}
            较上月代表船次
          </p>
          <small>
            丰田 {fmt(summary.toyotaSupply)} · 雷克萨斯{" "}
            {fmt(summary.lexusSupply)}
          </small>
        </article>
        <article>
          <span>订单缺货</span>
          <strong>
            {fmt(summary.orderShortage)}
            <small>台</small>
          </strong>
          <p>当前订单 {fmt(summary.orders)} 台</p>
          <small>订单优先匹配 · 按车型计算缺口</small>
        </article>
        <article>
          <span>4 周补库存缺货</span>
          <strong>
            {fmt(summary.replenishmentShortage)}
            <small>台</small>
          </strong>
          <p>4 周需求 {fmt(summary.demand4Weeks)} 台</p>
          <small>4 周销售需求包含当前订单</small>
        </article>
        <article>
          <span>仓店当前库存</span>
          <strong>
            {fmt(summary.storeStock + summary.vpcStock)}
            <small>台</small>
          </strong>
          <p>
            VPC {fmt(summary.vpcStock)} · 门店 {fmt(summary.storeStock)}
          </p>
          <small>
            {data.vpcs.length} 个 VPC · {data.regions.length} 个大区 ·{" "}
            {data.stores.length} 家门店
          </small>
        </article>
        <article className="vo-coverage" data-testid="overview-sellable-weeks">
          <span>整体预计可售卖周数</span>
          <strong>
            {coverage.weeks === null ? "—" : fmt(coverage.weeks, 1)}
            <small>周</small>
          </strong>
          <p>本船＋已有库存 {fmt(coverage.available)} 台</p>
          <small className="vo-coverage-models">
            {coverage.models.slice(0, 3).map((model) => (
              <span key={model.model}>
                <span>{shortModel(model.model)}</span>
                <b>{model.weeks === null ? "—" : fmt(model.weeks, 1)} 周</b>
              </span>
            ))}
          </small>
        </article>
      </div>

      <OverviewSection
        number="01"
        title="供给情况"
        note="品牌口径 · 当船与历史代表船次"
      >
        <ChartCard
          id="supply-models"
          title="当船车型供给"
          subtitle="本船各车型可分配数量"
          type="bar"
          legend={
            <Legend
              items={[
                { label: "丰田", color: COLORS.toyota },
                { label: "雷克萨斯", color: COLORS.lexus },
              ]}
            />
          }
          footer={
            <span>
              本船合计 <b>{fmt(summary.supply)} 台</b>
            </span>
          }
        >
          <HorizontalBars
            title="当船车型供给"
            rows={data.models.map((model) => ({
              id: model.model,
              label: shortModel(model.model),
              fullLabel: `${model.brand} · ${model.model}`,
              segments: [
                {
                  label: "当船供给",
                  value: model.supply,
                  color: model.brand === "丰田" ? COLORS.toyota : COLORS.lexus,
                },
              ],
            }))}
          />
        </ChartCard>
        <ChartCard
          id="supply-history"
          title="历史 13 个月供给"
          subtitle="2025.07—2026.07 · 每月代表船次"
          type="stacked-bar"
          legend={
            <Legend
              items={[
                { label: "丰田", color: COLORS.toyota },
                { label: "雷克萨斯", color: COLORS.lexus },
              ]}
            />
          }
          footer={
            <span>
              2026.03 起丰田下降含霍尔木兹受扰假设；<b>船次为模拟</b>。
            </span>
          }
        >
          <SupplyHistoryChart />
        </ChartCard>
      </OverviewSection>

      <OverviewSection
        number="02"
        title="订单与补库缺货"
        note="直营 / 授权 · 缺货按车型降序"
        columns={3}
      >
        <ChartCard
          id="orders"
          title="订单情况"
          subtitle="当前订单：已匹配与缺货"
          type="stacked-bar"
          legend={
            <Legend
              items={[
                { label: "直营已匹配", color: COLORS.direct },
                { label: "直营缺货", color: COLORS.directShortage },
                { label: "授权已匹配", color: COLORS.authorized },
                { label: "授权缺货", color: COLORS.authorizedShortage },
              ]}
            />
          }
          footer={
            <div className="vo-demand-footer">
              <span>4 周需求</span>
              {data.channels.map((channel) => (
                <span key={channel.channel}>
                  {channel.channel} <b>{fmt(channel.demand4Weeks)}</b> 台
                </span>
              ))}
            </div>
          }
        >
          <HorizontalBars
            title="直营与授权订单情况"
            labelWidth={42}
            rows={data.channels.map((channel) => ({
              id: channel.channel,
              label: channel.channel,
              segments: [
                {
                  label: "已匹配",
                  value: channel.orders - channel.orderShortage,
                  color:
                    channel.channel === "直营"
                      ? COLORS.direct
                      : COLORS.authorized,
                },
                {
                  label: "缺货",
                  value: channel.orderShortage,
                  color:
                    channel.channel === "直营"
                      ? COLORS.directShortage
                      : COLORS.authorizedShortage,
                },
              ],
            }))}
          />
        </ChartCard>
        <ChartCard
          id="order-shortage"
          title="各车型订单缺货"
          subtitle="按订单优先匹配后的缺口"
          type="stacked-bar"
          legend={<Legend items={channelLegend} />}
          footer={
            <span>
              订单缺货合计 <b>{fmt(summary.orderShortage)} 台</b>
            </span>
          }
        >
          <HorizontalBars
            title="各车型订单缺货"
            rows={shortageRows("order")}
            labelWidth={68}
          />
        </ChartCard>
        <ChartCard
          id="replenishment-shortage"
          title="各车型 4 周补库缺货"
          subtitle="未来 4 周销售需求的未覆盖量"
          type="stacked-bar"
          legend={<Legend items={channelLegend} />}
          footer={
            <span>
              补库缺货合计 <b>{fmt(summary.replenishmentShortage)} 台</b>
            </span>
          }
        >
          <HorizontalBars
            title="各车型4周补库存缺货"
            rows={shortageRows("replenishment")}
            labelWidth={68}
          />
        </ChartCard>
      </OverviewSection>

      <OverviewSection
        number="03"
        title="VPC 销速与库存"
        note={`${data.vpcs.length} 个车辆处理中心 · 共用同一配色`}
      >
        <ChartCard
          id="vpc-sales"
          title="VPC 历史周销速"
          subtitle="2025.07—2026.07 · 月销量折算"
          type="line"
          legend={<Legend items={vpcSeries} lines />}
          footer={<span>周销速 = 月销量 × 7 ÷ 当月天数</span>}
        >
          <SalesLines title="三个VPC历史周销速" series={vpcSeries} />
        </ChartCard>
        <ChartCard
          id="vpc-stock"
          title="VPC 当前库存"
          subtitle={`模拟快照 ${data.snapshotDate} · 台`}
          type="bar"
          legend={<Legend items={vpcSeries} />}
          footer={
            <span>
              VPC 库存合计 <b>{fmt(summary.vpcStock)} 台</b>
            </span>
          }
        >
          <StockBars
            title="三个VPC当前库存"
            rows={data.vpcs.map((vpc, index) => ({
              id: vpc.id,
              label: vpc.id,
              value: vpc.stock,
              color: REGION_COLORS[index],
            }))}
          />
        </ChartCard>
      </OverviewSection>

      <OverviewSection
        number="04"
        title="大区销速与库存"
        note={`${data.regions.length} 个大区 · 同色对应同一区域`}
      >
        <ChartCard
          id="region-sales"
          title="大区历史周销速"
          subtitle="2025.07—2026.07 · 月销量折算"
          type="line"
          legend={<Legend items={regionSeries} lines />}
          footer={<span>周销速 = 月销量 × 7 ÷ 当月天数</span>}
        >
          <SalesLines title="五个大区历史周销速" series={regionSeries} />
        </ChartCard>
        <ChartCard
          id="region-stock"
          title="大区当前库存"
          subtitle={`模拟快照 ${data.snapshotDate} · 台`}
          type="bar"
          legend={<Legend items={regionSeries} />}
          footer={<span>大区库存按门店所属区域汇总</span>}
        >
          <StockBars
            title="五个大区当前库存"
            rows={data.regions.map((region, index) => ({
              id: region.id,
              label: region.name,
              value: region.stock,
              color: REGION_COLORS[index],
            }))}
          />
        </ChartCard>
      </OverviewSection>

      <OverviewSection
        number="05"
        title="门店销速与库存"
        note={`全部 ${data.stores.length} 家门店 · 两图按周均销量同序排列`}
      >
        <ChartCard
          id="store-sales"
          title="门店近 8 周周均销量"
          subtitle={`${data.weeklyWindow.start}—${data.weeklyWindow.end} · 销量降序`}
          type="bar"
          legend={<Legend items={channelLegend} />}
          footer={
            <span>
              周均销量 = 窗口销量 ÷ {data.weeklyWindow.weeks} 周 ·{" "}
              <b>横向滚动查看全部门店 →</b>
            </span>
          }
        >
          <StoreBars metric="weeklySales" />
        </ChartCard>
        <ChartCard
          id="store-stock"
          title="门店当前库存"
          subtitle={`模拟快照 ${data.snapshotDate} · 沿用左图门店顺序`}
          type="bar"
          legend={<Legend items={channelLegend} />}
          footer={
            <span>
              门店库存合计 <b>{fmt(summary.storeStock)} 台</b> ·
              悬停或聚焦查看门店全名
            </span>
          }
        >
          <StoreBars metric="stock" />
        </ChartCard>
      </OverviewSection>

      <details className="vo-provenance">
        <summary>
          数据口径与模拟假设 <span>模拟快照 {data.snapshotDate}</span>
        </summary>
        <div>
          <h3>数据来源</h3>
          <ul>
            {data.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
          <h3>模拟口径</h3>
          <ul>
            {data.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
