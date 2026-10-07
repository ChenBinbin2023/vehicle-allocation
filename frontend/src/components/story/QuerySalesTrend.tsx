"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { matchesLocalizedText } from "@/lib/i18n/translate";

import { useState } from "react";
import type { QueryDimension, QueryResult } from "@/lib/story/query-engine";
import QueryLineChart, { type QuerySeries } from "./QueryLineChart";

const colors = [
  "#12836f",
  "#d5913a",
  "#6379bd",
  "#ba678e",
  "#749c45",
  "#478fb0",
  "#a56c48",
  "#8768b2",
];
const groupColors: Record<string, string> = {
  total: colors[0],
  西部: colors[0],
  中部: colors[1],
  东部: colors[2],
  南部: colors[3],
  北部: colors[4],
  JED: colors[0],
  RUH: colors[1],
  DMM: colors[2],
};

export default function QuerySalesTrend({
  dimension,
  rows,
  months,
  chosen,
  onChoose,
}: {
  dimension: QueryDimension;
  rows: QueryResult["rows"];
  months: string[];
  chosen: string[] | null;
  onChoose: (ids: string[] | null) => void;
}) {
  const { t: translateText } = useI18n();

  const [search, setSearch] = useState("");
  const selectedIds = chosen ?? rows.slice(0, 5).map((row) => row.id);
  const displayed =
    dimension === "store"
      ? rows.filter((row) => selectedIds.includes(row.id))
      : rows;
  const series: QuerySeries[] = displayed.flatMap((row, index) => {
    const color = groupColors[row.id] ?? colors[index % colors.length];
    const hasHistory = row.monthly.some((month) => month.actual !== null);
    const hasForecast = row.monthly.some((month) => month.forecast !== null);
    return [
      ...(hasHistory
        ? [
            {
              label: `${row.label}历史`,
              legendLabel: row.label,
              color,
              values: row.monthly.map((month) => month.actual),
            },
          ]
        : []),
      ...(hasForecast
        ? [
            {
              label: `${row.label}预测`,
              legendLabel: row.label,
              hideLegend: hasHistory,
              bridgeIndex: months.indexOf("2026-07"),
              color,
              dashed: true,
              values: row.monthly.map((month) =>
                month.month === "2026-07" ? month.actual : month.forecast,
              ),
            },
          ]
        : []),
    ];
  });
  function toggle(id: string) {
    onChoose(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );
  }
  return (
    <>
      {dimension === "store" && (
        <details className="query-trend-store-picker">
          <summary>
            {translateText("选择趋势门店 · ")}
            {displayed.length}
            {translateText(" 家")}
            {translateText(chosen === null ? "（默认前 5）" : "")}
          </summary>
          <div className="query-trend-store-toolbar">
            <input
              type="search"
              aria-label={translateText("搜索趋势门店")}
              placeholder={translateText("搜索门店名称")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                onChoose(null);
                setSearch("");
              }}
            >
              {translateText("恢复前 5 家")}
            </button>
            <button type="button" onClick={() => onChoose([])}>
              {translateText("清空选择")}
            </button>
          </div>
          <p>
            {translateText(
              "按所选期间历史销量排序；仅有预测时按预测销量排序。勾选只调整趋势图。",
            )}
          </p>
          <fieldset>
            <legend className="sr-only">{translateText("趋势门店多选")}</legend>
            {rows
              .filter((row) => matchesLocalizedText(row.label, search))
              .map((row) => (
                <label key={row.id}>
                  <input
                    type="checkbox"
                    aria-label={translateText(row.label)}
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                  <span>{translateText(row.label)}</span>
                  <small>
                    {translateText(
                      (row.actual || row.forecast).toLocaleString("en-US"),
                    )}
                    {translateText(" 台")}
                  </small>
                </label>
              ))}
          </fieldset>
          {!rows.some((row) => matchesLocalizedText(row.label, search)) && (
            <p>{translateText("没有匹配的门店名称。")}</p>
          )}
        </details>
      )}
      {displayed.length ? (
        <QueryLineChart
          key={months.join(",")}
          testId="query-sales-chart"
          months={months}
          series={series}
          unit="台"
          label="按汇总维度展示的月度销量与模拟预测折线图"
        />
      ) : (
        <div className="query-trend-empty">
          {translateText("请勾选要对比的门店，或恢复销量前 5 家。")}
        </div>
      )}
    </>
  );
}
