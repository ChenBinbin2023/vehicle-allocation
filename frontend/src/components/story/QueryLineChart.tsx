"use client";

import { useEffect, useRef, useState } from "react";

export type QuerySeries = {
  label: string;
  legendLabel?: string;
  hideLegend?: boolean;
  bridgeIndex?: number;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
};

export default function QueryLineChart({
  months,
  series,
  unit,
  label,
  testId,
}: {
  months: string[];
  series: QuerySeries[];
  unit: string;
  label: string;
  testId: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const resize = () => setWidth(Math.max(220, chart.clientWidth - 18));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const height = 280,
    left = 58,
    right = 22,
    top = 22,
    bottom = 40;
  const labelStride = Math.max(
    1,
    Math.ceil(
      (months.length - 1) /
        Math.max(1, Math.floor((width - left - right) / 64)),
    ),
  );
  const maximum = Math.max(
    1,
    ...series.flatMap((item) =>
      item.values.filter((value): value is number => value !== null),
    ),
  );
  const step = Math.pow(10, Math.floor(Math.log10(maximum)));
  const ceiling = Math.ceil((maximum * 1.12) / step) * step;
  const x = (index: number) =>
    left + (index * (width - left - right)) / Math.max(1, months.length - 1);
  const y = (value: number) =>
    height - bottom - (value / ceiling) * (height - top - bottom);
  const compact = (value: number) =>
    value >= 10000
      ? `${Number((value / 10000).toFixed(1))}万`
      : Math.round(value).toLocaleString("en-US");
  const index =
    selected !== null && selected < months.length
      ? selected
      : Math.max(0, months.length - 1);
  return (
    <div className="query-line-chart" data-testid={testId} ref={chartRef}>
      <div className="query-chart-legend">
        {series
          .filter((item) => !item.hideLegend)
          .map((item) => (
            <span key={item.label}>
              <i
                style={{ backgroundColor: item.color }}
                className={item.dashed ? "dashed" : ""}
              />
              {item.legendLabel ?? item.label}
            </span>
          ))}
        {series.some((item) => item.dashed && item.hideLegend) && (
          <span>
            <i className="dashed" style={{ backgroundColor: "#839087" }} />
            模拟预测
          </span>
        )}
        <small>{unit}</small>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = (ceiling * tick) / 4;
          return (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                className="query-chart-grid"
              />
              <text x={left - 10} y={y(value) + 4} textAnchor="end">
                {compact(value)}
              </text>
            </g>
          );
        })}
        {months.map((month, i) => (
          <g key={month}>
            {((i % labelStride === 0 &&
              (i === 0 || months.length - 1 - i >= labelStride)) ||
              i === months.length - 1) && (
              <text x={x(i)} y={height - 13} textAnchor="middle">
                {width < 400 ? `${month.slice(5)}月` : month.slice(2)}
              </text>
            )}
            <rect
              x={x(i) - 10}
              y={top}
              width={20}
              height={height - top - bottom}
              fill="transparent"
              onMouseEnter={() => setSelected(i)}
            />
          </g>
        ))}
        <line
          x1={x(index)}
          x2={x(index)}
          y1={top}
          y2={height - bottom}
          className="query-chart-cursor"
        />
        {series.map((item) => {
          let previous = false;
          const path = item.values
            .map((value, i) => {
              if (value === null) {
                previous = false;
                return "";
              }
              const command = previous ? "L" : "M";
              previous = true;
              return `${command}${x(i)},${y(value)}`;
            })
            .join(" ");
          return (
            <g key={item.label}>
              <path
                d={path}
                fill="none"
                stroke={item.color}
                strokeWidth={2.5}
                strokeDasharray={item.dashed ? "6 5" : undefined}
              />
              {item.values.map((value, i) =>
                value === null || i === item.bridgeIndex ? null : (
                  <circle
                    key={months[i]}
                    cx={x(i)}
                    cy={y(value)}
                    r={index === i ? 5 : 3}
                    fill="white"
                    stroke={item.color}
                    strokeWidth={2}
                    tabIndex={0}
                    role="button"
                    aria-label={`${months[i]} ${item.label} ${value.toLocaleString("en-US")} ${unit}`}
                    onFocus={() => setSelected(i)}
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => setSelected(i)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(i);
                      }
                    }}
                  >
                    <title>
                      {months[i]} · {item.label} ·{" "}
                      {value.toLocaleString("en-US")} {unit}
                    </title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <div className="query-chart-readout" aria-live="polite">
        <strong>{months[index] ?? "无数据"}</strong>
        {series
          .filter(
            (item) =>
              item.values[index] !== null &&
              item.values[index] !== undefined &&
              index !== item.bridgeIndex,
          )
          .map((item) => (
            <span key={item.label}>
              <i style={{ backgroundColor: item.color }} />
              {item.label}
              <b>{item.values[index]?.toLocaleString("en-US")}</b>
              <small>{unit}</small>
            </span>
          ))}
      </div>
    </div>
  );
}
