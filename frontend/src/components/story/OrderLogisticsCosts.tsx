"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useState } from "react";
import VesselSectionHeading from "./VesselSectionHeading";
import type { OrderPortMode } from "@/lib/story/vessel-orders";
import type {
  OrderLogisticsSummary,
  OrderStoreCosts,
} from "@/lib/story/vessel-order-costs";

const fmt = (value: number, digits = 0) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });
const price = (value: number | null) => (value === null ? "—" : fmt(value, 1));
const colors = { single: "#577c66", dual: "#a3bdad" };

function chartMax(value: number) {
  if (!value) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / power / 2) * power * 2;
}

function StoreCostChart({
  summary,
  mode,
  metric,
  activeStore,
  onStore,
}: {
  summary: OrderLogisticsSummary;
  mode: OrderPortMode;
  metric: "totalCost" | "unitCost";
  activeStore?: OrderStoreCosts;
  onStore: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  const rows =
    summary.single.quantity || summary.dual.quantity ? summary.stores : [];
  const total = metric === "totalCost";
  const title = `${mode === "single" ? "单港" : "双港"}门店${total ? "物流总费用" : "单车物流费用"}`;
  const unit = total ? "SAR" : "SAR / 台";
  // Corresponding single/dual charts use the same store order and vertical scale.
  const max = chartMax(
    Math.max(
      0,
      ...rows.flatMap((row) => [
        row.single[metric] ?? 0,
        row.dual[metric] ?? 0,
      ]),
    ),
  );
  const width = Math.max(250, rows.length * 32 + 16);
  return (
    <section
      className="voa-store-cost-chart"
      data-store-cost-chart={`${mode}-${metric}`}
      aria-label={translateText(title)}
    >
      <header>
        <small>
          <i style={{ background: colors[mode] }} />
          {translateText(
            mode === "single" ? "单港 · 吉达" : "双港 · 吉达 + 达曼",
          )}
        </small>
        <h4>{translateText(total ? "门店物流总费用" : "门店单车物流费用")}</h4>
      </header>
      <div className="voa-cost-chart-metric">
        <strong>
          {translateText(
            total
              ? fmt(summary[mode].totalCost)
              : price(summary[mode].unitCost),
          )}
        </strong>
        <span>
          {translateText(unit)}
          {translateText(!total && " · 加权平均")}
        </span>
      </div>
      {rows.length ? (
        <>
          <div className="voa-store-cost-plot">
            <div className="voa-store-cost-axis" aria-hidden="true">
              {[max, max / 2, 0].map((value) => (
                <span key={value}>{translateText(fmt(value))}</span>
              ))}
            </div>
            <div
              className="voa-cost-scroll"
              tabIndex={0}
              role="region"
              aria-label={translateText(`${title}，可横向滚动查看全部门店`)}
            >
              <svg
                width={width}
                height={198}
                role="group"
                aria-label={translateText(title)}
              >
                {[16, 88, 160].map((y) => (
                  <line
                    key={y}
                    x1={0}
                    x2={width}
                    y1={y}
                    y2={y}
                    className="voa-cost-gridline"
                  />
                ))}
                {rows.map((store, index) => {
                  const value = store[mode][metric];
                  const height = ((value ?? 0) / max) * 144;
                  const x = 8 + index * 32;
                  return (
                    <g key={store.id} onMouseEnter={() => onStore(store.id)}>
                      {activeStore?.id === store.id && (
                        <rect
                          x={x}
                          y={12}
                          width={28}
                          height={151}
                          rx={4}
                          fill={colors[mode]}
                          opacity={0.1}
                        />
                      )}
                      <rect
                        data-store-cost={store.id}
                        data-cost={value ?? ""}
                        x={x + 5}
                        y={160 - height}
                        width={18}
                        height={height}
                        rx={3}
                        fill={colors[mode]}
                        role="img"
                        tabIndex={0}
                        aria-label={translateText(
                          `${store.name}：${price(value)} ${unit}，运送 ${store[mode].quantity} 台`,
                        )}
                        onFocus={() => onStore(store.id)}
                      >
                        <title>
                          {translateText(store.name)}：
                          {translateText(price(value))} {translateText(unit)}
                          {translateText(" · 运送")}
                          {translateText(" ")}
                          {store[mode].quantity}
                          {translateText(" 台")}
                        </title>
                      </rect>
                      <text
                        x={x + 14}
                        y={179}
                        textAnchor="middle"
                        className="voa-cost-store-label"
                      >
                        {translateText(store.shortName)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <p className="voa-cost-store-detail">
            <span>
              {translateText(activeStore?.shortName)} ·{" "}
              {translateText(activeStore?.name)}
            </span>
            <b>
              {translateText(price(activeStore?.[mode][metric] ?? null))}{" "}
              {translateText(unit)}
            </b>
          </p>
        </>
      ) : (
        <p className="voa-cost-chart-empty">
          {translateText("当前筛选没有已分配的运输订单")}
        </p>
      )}
    </section>
  );
}

function RegionCosts({ summary }: { summary: OrderLogisticsSummary }) {
  const { t: translateText } = useI18n();

  const max = chartMax(
    Math.max(
      0,
      ...summary.regions.flatMap((row) => [
        row.single.unitCost ?? 0,
        row.dual.unitCost ?? 0,
      ]),
    ),
  );
  const width = Math.max(420, summary.regions.length * 90 + 65);
  const step = (width - 65) / Math.max(1, summary.regions.length);
  return (
    <div className="voa-region-cost-layout">
      <div className="voa-region-cost-table">
        <h4>{translateText("大区费用与平均单车成本")}</h4>
        <div className="voa-cost-table-scroll" tabIndex={0}>
          <table aria-label={translateText("各业务大区物流费用对比")}>
            <thead>
              <tr>
                <th rowSpan={2}>{translateText("业务大区")}</th>
                <th rowSpan={2}>{translateText("运送台数")}</th>
                <th colSpan={2} className="single">
                  {translateText("单港 · 吉达")}
                </th>
                <th colSpan={2} className="dual">
                  {translateText("双港 · 吉达 + 达曼")}
                </th>
              </tr>
              <tr>
                <th>{translateText("总费用")}</th>
                <th>{translateText("平均 / 台")}</th>
                <th>{translateText("总费用")}</th>
                <th>{translateText("平均 / 台")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.regions.map((row) => (
                <tr key={row.name} data-cost-region={row.name}>
                  <th scope="row">{translateText(row.name)}</th>
                  <td>{translateText(fmt(row.single.quantity))}</td>
                  <td>{translateText(fmt(row.single.totalCost))}</td>
                  <td>{translateText(price(row.single.unitCost))}</td>
                  <td>{translateText(fmt(row.dual.totalCost))}</td>
                  <td>{translateText(price(row.dual.unitCost))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{translateText("合计 / 加权平均")}</th>
                <td>{translateText(fmt(summary.single.quantity))}</td>
                <td>{translateText(fmt(summary.single.totalCost))}</td>
                <td>{translateText(price(summary.single.unitCost))}</td>
                <td>{translateText(fmt(summary.dual.totalCost))}</td>
                <td>{translateText(price(summary.dual.unitCost))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p>{translateText("总费用单位 SAR；平均单车成本单位 SAR / 台。")}</p>
      </div>
      <section
        className="voa-region-cost-chart"
        aria-label={translateText("各业务大区单车物流成本对比")}
      >
        <header>
          <h4>{translateText("大区单车物流成本对比")}</h4>
          <div className="voa-cost-legend">
            <span>
              <i style={{ background: colors.single }} />
              {translateText("单港")}
            </span>
            <span>
              <i style={{ background: colors.dual }} />
              {translateText("双港")}
            </span>
          </div>
        </header>
        <small>{translateText("SAR / 台 · 按运送车辆数加权")}</small>
        {summary.single.quantity || summary.dual.quantity ? (
          <div className="voa-region-cost-scroll" tabIndex={0}>
            <svg
              viewBox={`0 0 ${width} 242`}
              role="group"
              aria-label={translateText(
                "横轴为业务大区，蓝色为单港，绿色为双港",
              )}
            >
              {[0, max / 2, max].map((value) => {
                const y = 188 - (value / max) * 158;
                return (
                  <g key={value}>
                    <line
                      x1={48}
                      x2={width - 10}
                      y1={y}
                      y2={y}
                      className="voa-cost-gridline"
                    />
                    <text
                      x={40}
                      y={y + 4}
                      textAnchor="end"
                      className="voa-cost-tick"
                    >
                      {translateText(fmt(value))}
                    </text>
                  </g>
                );
              })}
              {summary.regions.map((row, index) => {
                const center = 48 + (index + 0.5) * step;
                return (
                  <g key={row.name}>
                    {(["single", "dual"] as const).map((mode, j) => {
                      const value = row[mode].unitCost;
                      const height = ((value ?? 0) / max) * 158;
                      const x = center - 29 + j * 34;
                      return (
                        <g key={mode}>
                          <rect
                            data-region-bar={row.name}
                            data-mode={mode}
                            x={x}
                            y={188 - height}
                            width={20}
                            height={height}
                            rx={3}
                            fill={colors[mode]}
                            role="img"
                            tabIndex={0}
                            aria-label={translateText(
                              `${row.name} ${mode === "single" ? "单港" : "双港"}：${price(value)} SAR / 台`,
                            )}
                          >
                            <title>
                              {translateText(row.name)} ·{" "}
                              {translateText(
                                mode === "single" ? "单港" : "双港",
                              )}
                              ：{translateText(price(value))}
                              {translateText(" SAR / 台")}
                            </title>
                          </rect>
                          <text
                            x={x + 10}
                            y={180 - height}
                            textAnchor="middle"
                            className="voa-cost-bar-value"
                          >
                            {translateText(price(value))}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={center}
                      y={212}
                      textAnchor="middle"
                      className="voa-cost-region-label"
                    >
                      {translateText(row.name)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="voa-cost-chart-empty">
            {translateText("当前筛选没有已分配的运输订单")}
          </p>
        )}
      </section>
    </div>
  );
}

export default function OrderLogisticsCosts({
  summary,
}: {
  summary: OrderLogisticsSummary;
}) {
  const { t: translateText } = useI18n();

  const [activeStoreId, setActiveStoreId] = useState("");
  const activeStore =
    summary.stores.find((store) => store.id === activeStoreId) ??
    summary.stores[0];
  const { amount, percent } = summary.change;
  const changeText =
    !summary.single.quantity && !summary.dual.quantity
      ? "当前筛选没有已分配的运输订单，暂无法比较单港与双港的物流成本。"
      : `双港改为单港后，物流总成本由 ${fmt(summary.dual.totalCost)} SAR 变为 ${fmt(summary.single.totalCost)} SAR，${amount > 0 ? "增加" : amount < 0 ? "减少" : "变化"} ${fmt(Math.abs(amount))} SAR${percent === null ? "（双港费用为 0，无法计算变化比例）" : `（${amount > 0 ? "增加" : amount < 0 ? "减少" : "变化"} ${fmt(Math.abs(percent), 2)}%，以双港为基准）`}。`;
  return (
    <section
      className="voa-section voa-logistics-costs"
      data-testid="order-logistics-costs"
      aria-label={translateText("当前订单物流费用统计")}
    >
      <VesselSectionHeading
        number="03"
        english="LOGISTICS COST COMPARISON"
        title={translateText("物流费用对比")}
        note={`${summary.stores.length} 家门店 · 运送 ${fmt(summary.single.quantity)} 台 · 跟随门店、渠道与品牌筛选`}
      />
      <div className="voa-section-body">
        <div className="voa-store-cost-row-scroll">
          <div className="voa-store-cost-row">
            {(["single", "dual"] as const).flatMap((mode) =>
              (["totalCost", "unitCost"] as const).map((metric) => (
                <StoreCostChart
                  key={`${mode}-${metric}`}
                  summary={summary}
                  mode={mode}
                  metric={metric}
                  activeStore={activeStore}
                  onStore={setActiveStoreId}
                />
              )),
            )}
          </div>
        </div>
        <p className="voa-cost-chart-guide">
          {translateText(
            "四图使用相同门店顺序，按单港总费用降序排列；横向滚动查看全部门店，悬停柱子查看费用。",
          )}
        </p>
        <RegionCosts summary={summary} />
        <p className="voa-cost-change" data-testid="order-cost-change">
          {translateText(changeText)}
        </p>
        <p className="voa-cost-basis">
          {translateText(
            "仅统计当前订单已分配的运输车辆；单车指订单车辆，平均成本 = 物流总费用 ÷ 运送台数。合车费用沿用车次卸货点分摊，品牌筛选再按订单台数归集，不重新计算整车报价。费用包含整趟运输、额外卸货、港口处理与整备。",
          )}
        </p>
      </div>
    </section>
  );
}
