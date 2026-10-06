"use client";

import { useState } from "react";
import type { OrderPortMode } from "@/lib/story/vessel-orders";
import type {
  OrderLogisticsSummary,
  OrderStoreCosts,
} from "@/lib/story/vessel-order-costs";

const fmt = (value: number, digits = 0) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });
const price = (value: number | null) => (value === null ? "—" : fmt(value, 1));
const colors = { single: "#7395bd", dual: "#62a999" };

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
      aria-label={title}
    >
      <header>
        <small>
          <i style={{ background: colors[mode] }} />
          {mode === "single" ? "单港 · 吉达" : "双港 · 吉达 + 达曼"}
        </small>
        <h4>{total ? "门店物流总费用" : "门店单车物流费用"}</h4>
      </header>
      <div className="voa-cost-chart-metric">
        <strong>
          {total ? fmt(summary[mode].totalCost) : price(summary[mode].unitCost)}
        </strong>
        <span>
          {unit}
          {!total && " · 加权平均"}
        </span>
      </div>
      {rows.length ? (
        <>
          <div className="voa-store-cost-plot">
            <div className="voa-store-cost-axis" aria-hidden="true">
              {[max, max / 2, 0].map((value) => (
                <span key={value}>{fmt(value)}</span>
              ))}
            </div>
            <div
              className="voa-cost-scroll"
              tabIndex={0}
              role="region"
              aria-label={`${title}，可横向滚动查看全部门店`}
            >
              <svg width={width} height={198} role="group" aria-label={title}>
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
                        aria-label={`${store.name}：${price(value)} ${unit}，运送 ${store[mode].quantity} 台`}
                        onFocus={() => onStore(store.id)}
                      >
                        <title>
                          {store.name}：{price(value)} {unit} · 运送{" "}
                          {store[mode].quantity} 台
                        </title>
                      </rect>
                      <text
                        x={x + 14}
                        y={179}
                        textAnchor="middle"
                        className="voa-cost-store-label"
                      >
                        {store.shortName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <p className="voa-cost-store-detail">
            <span>
              {activeStore?.shortName} · {activeStore?.name}
            </span>
            <b>
              {price(activeStore?.[mode][metric] ?? null)} {unit}
            </b>
          </p>
        </>
      ) : (
        <p className="voa-cost-chart-empty">当前筛选没有已分配的运输订单</p>
      )}
    </section>
  );
}

function RegionCosts({ summary }: { summary: OrderLogisticsSummary }) {
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
        <h4>大区费用与平均单车成本</h4>
        <div className="voa-cost-table-scroll" tabIndex={0}>
          <table aria-label="各业务大区物流费用对比">
            <thead>
              <tr>
                <th rowSpan={2}>业务大区</th>
                <th rowSpan={2}>运送台数</th>
                <th colSpan={2} className="single">
                  单港 · 吉达
                </th>
                <th colSpan={2} className="dual">
                  双港 · 吉达 + 达曼
                </th>
              </tr>
              <tr>
                <th>总费用</th>
                <th>平均 / 台</th>
                <th>总费用</th>
                <th>平均 / 台</th>
              </tr>
            </thead>
            <tbody>
              {summary.regions.map((row) => (
                <tr key={row.name} data-cost-region={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{fmt(row.single.quantity)}</td>
                  <td>{fmt(row.single.totalCost)}</td>
                  <td>{price(row.single.unitCost)}</td>
                  <td>{fmt(row.dual.totalCost)}</td>
                  <td>{price(row.dual.unitCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">合计 / 加权平均</th>
                <td>{fmt(summary.single.quantity)}</td>
                <td>{fmt(summary.single.totalCost)}</td>
                <td>{price(summary.single.unitCost)}</td>
                <td>{fmt(summary.dual.totalCost)}</td>
                <td>{price(summary.dual.unitCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p>总费用单位 SAR；平均单车成本单位 SAR / 台。</p>
      </div>
      <section
        className="voa-region-cost-chart"
        aria-label="各业务大区单车物流成本对比"
      >
        <header>
          <h4>大区单车物流成本对比</h4>
          <div className="voa-cost-legend">
            <span>
              <i style={{ background: colors.single }} />
              单港
            </span>
            <span>
              <i style={{ background: colors.dual }} />
              双港
            </span>
          </div>
        </header>
        <small>SAR / 台 · 按运送车辆数加权</small>
        {summary.single.quantity || summary.dual.quantity ? (
          <div className="voa-region-cost-scroll" tabIndex={0}>
            <svg
              viewBox={`0 0 ${width} 242`}
              role="group"
              aria-label="横轴为业务大区，蓝色为单港，绿色为双港"
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
                      {fmt(value)}
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
                            aria-label={`${row.name} ${mode === "single" ? "单港" : "双港"}：${price(value)} SAR / 台`}
                          >
                            <title>
                              {row.name} · {mode === "single" ? "单港" : "双港"}
                              ：{price(value)} SAR / 台
                            </title>
                          </rect>
                          <text
                            x={x + 10}
                            y={180 - height}
                            textAnchor="middle"
                            className="voa-cost-bar-value"
                          >
                            {price(value)}
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
                      {row.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="voa-cost-chart-empty">当前筛选没有已分配的运输订单</p>
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
      className="voa-logistics-costs"
      data-testid="order-logistics-costs"
      aria-label="当前订单物流费用统计"
    >
      <header className="voa-cost-heading">
        <div>
          <h3>当前订单物流费用</h3>
          <p>
            {summary.stores.length} 家门店 · 运送 {fmt(summary.single.quantity)}{" "}
            台 · 单港、双港对比
          </p>
        </div>
        <span>跟随门店、渠道与品牌筛选</span>
      </header>
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
        四图使用相同门店顺序，按单港总费用降序排列；横向滚动查看全部门店，悬停柱子查看费用。
      </p>
      <RegionCosts summary={summary} />
      <p className="voa-cost-change" data-testid="order-cost-change">
        {changeText}
      </p>
      <p className="voa-cost-basis">
        仅统计当前订单已分配的运输车辆；单车指订单车辆，平均成本 = 物流总费用 ÷
        运送台数。合车费用沿用车次卸货点分摊，品牌筛选再按订单台数归集，不重新计算整车报价。费用包含整趟运输、额外卸货、港口处理与整备。
      </p>
    </section>
  );
}
