"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  Database,
  LoaderCircle,
  RotateCcw,
  Truck,
  TrendingUp,
} from "lucide-react";
import {
  defaultQueryFilters,
  queryAnalytics,
  queryMetadata,
  queryMonths,
  queryRegions,
  queryVpcLabels,
  selectQueryStores,
} from "@/lib/story/query-engine";
import type { QueryFilters, QueryTab } from "@/lib/story/query-engine";
import type { StoryRun } from "@/lib/story/types";
import QuerySalesTrend from "./QuerySalesTrend";
import QueryRouteMap from "./QueryRouteMap";

const tabs: Array<{
  id: QueryTab;
  title: string;
  subtitle: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "sales",
    title: "销量与预测",
    subtitle: "月度趋势 · 区域与网点",
    icon: TrendingUp,
  },
  {
    id: "inventory",
    title: "库存与渠道",
    subtitle: "可用库存 · 直营与授权",
    icon: Boxes,
  },
  {
    id: "transport",
    title: "陆路运输成本",
    subtitle: "路线费用 · 港口情景",
    icon: Truck,
  },
];
const fmt = (value: number, digits = 0) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });
const dimensions = [
  { id: "total", title: "总量（直营 + 授权）" },
  { id: "region", title: "区域" },
  { id: "vpc", title: "服务 VPC" },
  { id: "store", title: "门店" },
] as const;
function Metric({
  label,
  value,
  note,
  testId,
  accent = false,
  range = false,
}: {
  label: string;
  value: string;
  note: string;
  testId?: string;
  accent?: boolean;
  range?: boolean;
}) {
  const unitStart = value.lastIndexOf(" ");
  return (
    <article
      className={`query-metric ${accent ? "accent" : ""} ${range ? "range" : ""}`}
      data-testid={testId}
    >
      <small>{label}</small>
      <strong>
        {unitStart < 0 ? (
          value
        ) : (
          <>
            {value.slice(0, unitStart)}
            <em className="query-metric-unit">{value.slice(unitStart + 1)}</em>
          </>
        )}
      </strong>
      <span>{note}</span>
    </article>
  );
}
function Panel({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="query-panel">
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export default function SmartQueryWorkspace({
  run,
  focusedStep,
  focusRevision,
}: {
  run: StoryRun;
  focusedStep: number | null;
  focusRevision: number;
}) {
  const [tab, setTab] = useState<QueryTab>("sales");
  const [filters, setFilters] = useState<QueryFilters>(
    run.query?.filters ?? defaultQueryFilters,
  );
  const [scenario, setScenario] = useState<"dual" | "west">("dual");
  const [trendStores, setTrendStores] = useState<string[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const result = useMemo(() => queryAnalytics(filters), [filters]);
  const scopeStores = useMemo(
    () => selectQueryStores({ ...filters, store: "all" }),
    [filters],
  );
  useEffect(() => {
    const nextTab =
      focusedStep === null ? undefined : run.events[focusedStep]?.canvasTab;
    if (nextTab) setTab(nextTab);
  }, [focusedStep, focusRevision, run.events]);
  const ready =
    run.blocks.find((block) => block.type === `query-${tab}`)?.status ===
    "ready";
  const progress = Math.min(
    100,
    Math.round((run.elapsed / run.duration) * 100),
  );
  const activeTransport = result.transport[scenario];
  const months = result.monthly.map((row) => row.month);
  const dimensionLabel = dimensions.find(
    (item) => item.id === filters.dimension,
  )!.title;
  const historyCount = result.monthly.filter(
    (row) => row.actual !== null,
  ).length;
  const forecastCount = result.monthly.filter(
    (row) => row.forecast !== null,
  ).length;

  function change<K extends keyof QueryFilters>(
    key: K,
    value: QueryFilters[K],
  ) {
    if (["region", "vpc", "store", "channel", "brand"].includes(key))
      setTrendStores(null);
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (["region", "vpc", "channel", "brand"].includes(key))
        next.store = "all";
      if (key === "from" && value > current.to) next.to = String(value);
      if (key === "to" && value < current.from) next.from = String(value);
      return next;
    });
  }
  function drill(id: string) {
    if (filters.dimension !== "total") change(filters.dimension, id);
  }
  function resetFilters() {
    setFilters({ ...defaultQueryFilters });
    setTrendStores(null);
  }
  function exportRows() {
    const data: Array<Array<string | number | null>> =
      tab === "sales"
        ? [
            [
              "月份",
              "历史销量(台)",
              "直营历史销量(台)",
              "授权历史销量(台)",
              "模拟预测(台)",
            ],
            ...result.monthly.map((row) => [
              row.month,
              row.actual,
              row.direct,
              row.authorized,
              row.forecast,
            ]),
          ]
        : tab === "inventory"
          ? [
              [
                dimensionLabel,
                "库存日期",
                "实物库存(台)",
                "可用(台)",
                "锁定(台)",
                "冻结(台)",
                "在途(台)",
                "可用覆盖(周)",
              ],
              ...result.rows.map((row) => [
                row.label,
                queryMetadata.stockDate,
                row.physical,
                row.free,
                row.locked,
                row.frozen,
                row.transit,
                row.coverage.toFixed(2),
              ]),
            ]
          : [
              [
                "路线",
                "场景",
                "整趟费(SAR)",
                "满载单台费(SAR)",
                "共用路线周容量(台)",
              ],
              ...activeTransport.routes.map((row) => [
                row.id,
                scenario,
                row.cost,
                row.unitCost,
                row.capacity,
              ]),
            ];
    const csv = data
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `智能问数-${tab}-${filters.from}-${filters.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="smart-query-workspace" data-testid="smart-query-workspace">
      <section className="query-context">
        <h2>从销量到库存，再到每一趟运输</h2>
        <span className={`query-run-status story-run-state ${run.status}`}>
          <i />
          {run.status === "complete"
            ? "已完成"
            : run.status === "paused"
              ? "已暂停"
              : "分析中"}
        </span>
      </section>
      <section className="query-filter-panel" aria-label="分析筛选">
        <button
          type="button"
          className="query-filter-toggle"
          aria-label={filtersOpen ? "收起分析筛选" : "展开分析筛选"}
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <strong>分析筛选</strong>
          <span>
            {filters.region === "all"
              ? "全部区域"
              : filters.region.split(",").join(" + ")}
            {" · "}
            {filters.channel === "all"
              ? "全部渠道"
              : filters.channel === "二级展厅"
                ? "授权店"
                : filters.channel}
            {" · "}
            {filters.brand === "all" ? "全部品牌" : filters.brand}
            {filters.vpc !== "all" &&
              ` · ${filters.vpc
                .split(",")
                .map((id) => queryVpcLabels[id] ?? id)
                .join(" + ")}`}
            {filters.store !== "all" &&
              ` · ${filters.store
                .split(",")
                .map(
                  (id) =>
                    scopeStores
                      .find((store) => store.id === id)
                      ?.name.replace("模拟", "") ?? id,
                )
                .join(" + ")}`}
            {filters.dimension !== "total" && ` · 按${dimensionLabel}汇总`}
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="query-filters" hidden={!filtersOpen}>
          <label>
            起始月份
            <select
              aria-label="起始月份"
              value={filters.from}
              onChange={(event) => change("from", event.target.value)}
            >
              {!queryMonths.includes(filters.from) && (
                <option value={filters.from}>
                  {filters.from}（无月度数据）
                </option>
              )}
              {queryMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            截止月份
            <select
              aria-label="截止月份"
              value={filters.to}
              onChange={(event) => change("to", event.target.value)}
            >
              {!queryMonths.includes(filters.to) && (
                <option value={filters.to}>{filters.to}（无月度数据）</option>
              )}
              {queryMonths.map((month) => (
                <option key={month}>{month}</option>
              ))}
            </select>
          </label>
          <label>
            区域
            <select
              aria-label="区域"
              value={filters.region}
              onChange={(event) => change("region", event.target.value)}
            >
              <option value="all">全部区域</option>
              {filters.region.includes(",") && (
                <option value={filters.region}>
                  {filters.region.split(",").join(" + ")}
                </option>
              )}
              {queryRegions.map((region) => (
                <option key={region}>{region}</option>
              ))}
            </select>
          </label>
          <label>
            服务 VPC
            <select
              aria-label="服务 VPC"
              value={filters.vpc}
              onChange={(event) => change("vpc", event.target.value)}
            >
              <option value="all">全部 VPC</option>
              {filters.vpc.includes(",") && (
                <option value={filters.vpc}>
                  {filters.vpc
                    .split(",")
                    .map((id) => queryVpcLabels[id])
                    .join(" + ")}
                </option>
              )}
              {Object.entries(queryVpcLabels).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            渠道
            <select
              aria-label="渠道"
              value={filters.channel}
              onChange={(event) => change("channel", event.target.value)}
            >
              <option value="all">直营 + 授权</option>
              <option value="直营">直营店</option>
              <option value="二级展厅">授权店（L2）</option>
            </select>
          </label>
          <label>
            品牌
            <select
              aria-label="品牌"
              value={filters.brand}
              onChange={(event) => change("brand", event.target.value)}
            >
              <option value="all">全部品牌</option>
              <option>丰田</option>
              <option>雷克萨斯</option>
            </select>
          </label>
          <label className="query-store-filter">
            门店
            <select
              aria-label="门店"
              value={filters.store}
              onChange={(event) => change("store", event.target.value)}
            >
              <option value="all">
                全部匹配门店 · {scopeStores.length} 家
              </option>
              {filters.store !== "all" &&
                !scopeStores.some((store) => store.id === filters.store) && (
                  <option value={filters.store}>
                    已指定门店 · {filters.store.split(",").join(" + ")}
                  </option>
                )}
              {scopeStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name.replace("模拟", "")}
                </option>
              ))}
            </select>
          </label>
          <label>
            汇总维度
            <select
              aria-label="汇总维度"
              value={filters.dimension}
              onChange={(event) =>
                change(
                  "dimension",
                  event.target.value as QueryFilters["dimension"],
                )
              }
            >
              {dimensions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer>
          <span data-testid="query-scope">
            <i />
            {result.storeCount} 家门店 · {filters.from} — {filters.to}
          </span>
          <span>库存快照 {queryMetadata.stockDate}</span>
          <div className="query-filter-actions">
            <button
              type="button"
              className="query-reset"
              aria-label="重置筛选"
              onClick={resetFilters}
            >
              <RotateCcw size={13} />
              重置
            </button>
            <button
              type="button"
              onClick={exportRows}
              disabled={
                !ready ||
                !result.storeCount ||
                (tab === "sales" && !result.monthly.length)
              }
            >
              <ArrowDownToLine size={13} />
              导出明细
            </button>
          </div>
        </footer>
      </section>
      <nav className="query-tabs" role="tablist" aria-label="智能问数分析视图">
        {tabs.map((item, index) => {
          const Icon = item.icon;
          const done =
            run.blocks.find((block) => block.type === `query-${item.id}`)
              ?.status === "ready";
          return (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={`query-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`query-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % 3
                    : event.key === "ArrowLeft"
                      ? (index + 2) % 3
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setTab(tabs[next].id);
                  document
                    .getElementById(`query-tab-${tabs[next].id}`)
                    ?.focus();
                }
              }}
            >
              <Icon size={19} />
              <div>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </div>
              <span>{done ? <Check size={13} /> : `0${index + 1}`}</span>
            </button>
          );
        })}
      </nav>
      <div
        role="tabpanel"
        id={`query-panel-${tab}`}
        aria-labelledby={`query-tab-${tab}`}
      >
        {!ready ? (
          <section className="query-generating" aria-live="polite">
            <LoaderCircle size={28} className="decision-spinner" />
            <h3>
              {run.status === "paused"
                ? "分析已暂停"
                : `正在生成${tabs.find((item) => item.id === tab)!.title}`}
            </h3>
            <p>数据读取、口径校验与计算记录正在同步到 CUI。</p>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
            <span>
              {progress}% ·{" "}
              {run.status === "paused"
                ? "在 CUI 点击继续"
                : "完成后可筛选与下钻"}
            </span>
          </section>
        ) : result.storeCount === 0 ||
          (tab === "sales" && !result.monthly.length) ? (
          <section className="query-empty" data-testid="query-empty">
            <Database size={25} />
            <h3>
              {result.storeCount === 0
                ? "当前筛选没有匹配门店"
                : "所选期间没有可用月度数据"}
            </h3>
            <p>
              {result.storeCount === 0
                ? "调整区域、服务 VPC、渠道或品牌后重新查看。"
                : "可用月度范围为 2025-01 至 2026-10；可切换库存 Tab 查看固定快照。"}
            </p>
            <button type="button" onClick={resetFilters}>
              重置筛选
            </button>
          </section>
        ) : (
          <>
            {tab === "sales" && (
              <>
                <div className="query-metrics">
                  <Metric
                    label="期间历史销量"
                    value={`${fmt(result.actualTotal)} 台`}
                    note={`${historyCount} 个有效月 · 门店模拟销量`}
                    accent
                  />
                  <Metric
                    label="模拟预测销量"
                    value={`${fmt(result.forecastTotal)} 台`}
                    note={`${forecastCount} 个预测月 · 最近三月日均基准`}
                  />
                  <Metric
                    label="直营销售占比"
                    value={`${result.actualTotal ? fmt((result.monthly.reduce((sum, row) => sum + (row.direct ?? 0), 0) / result.actualTotal) * 100, 1) : "—"}%`}
                    note="按所选期间历史销量计算"
                  />
                  <Metric
                    label="覆盖网点"
                    value={`${result.storeCount} 家`}
                    note={`${result.channels[0].storeCount} 直营 · ${result.channels[1].storeCount} 授权`}
                  />
                </div>
                <Panel
                  title="月度销量趋势与预测"
                  subtitle="实线为历史模拟销量，虚线为 8—10 月模拟预测；缺失月份不作为零销量。"
                  aside={<span className="query-tag">台 / 月</span>}
                >
                  <QuerySalesTrend
                    key={`${filters.region}-${filters.vpc}-${filters.store}-${filters.channel}-${filters.brand}`}
                    dimension={filters.dimension}
                    rows={result.rows}
                    months={months}
                    chosen={trendStores}
                    onChoose={setTrendStores}
                  />
                  <div className="query-insight">
                    <TrendingUp size={15} />
                    <p>
                      <b>预测依据</b>
                      {queryMetadata.forecastRule}
                      用于演示趋势，不包含促销、节假日或供给变化。
                    </p>
                  </div>
                </Panel>
                <Panel
                  title={`${dimensionLabel}销量汇总`}
                  subtitle="历史与预测分列；库存使用固定快照。"
                >
                  <div className="query-table-wrap">
                    <table data-testid="query-sales-table">
                      <thead>
                        <tr>
                          <th>{dimensionLabel}</th>
                          <th>门店</th>
                          <th>历史销量 / 台</th>
                          <th>模拟预测 / 台</th>
                          <th>当前实物 / 台</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <button
                                className="query-drill"
                                onClick={() => drill(row.id)}
                                disabled={filters.dimension === "total"}
                              >
                                {row.label}
                                <ArrowUpRight size={12} />
                              </button>
                            </td>
                            <td>{row.storeCount}</td>
                            <td>{fmt(row.actual)}</td>
                            <td className="query-forecast-value">
                              {forecastCount ? fmt(row.forecast) : "—"}
                            </td>
                            <td>{fmt(row.physical)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <details className="query-monthly-detail">
                  <summary>查看逐月渠道明细 · {months.length} 个月</summary>
                  <div className="query-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>月份</th>
                          <th>直营历史 / 台</th>
                          <th>授权历史 / 台</th>
                          <th>历史合计 / 台</th>
                          <th>预测合计 / 台</th>
                          <th>数据状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.monthly.map((row) => (
                          <tr key={row.month}>
                            <td>{row.month}</td>
                            <td>
                              {row.direct === null ? "—" : fmt(row.direct)}
                            </td>
                            <td>
                              {row.authorized === null
                                ? "—"
                                : fmt(row.authorized)}
                            </td>
                            <td>
                              {row.actual === null ? "—" : fmt(row.actual)}
                            </td>
                            <td className="query-forecast-value">
                              {row.forecast === null ? "—" : fmt(row.forecast)}
                            </td>
                            <td>
                              {row.actual !== null
                                ? "历史模拟"
                                : "历史缺失 / 模拟预测"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
            {tab === "inventory" && (
              <>
                <div className="query-metrics">
                  <Metric
                    label="当前实物库存"
                    value={`${fmt(result.stock.physical)} 台`}
                    note="可用 + 锁定 + 质检冻结"
                    testId="query-physical-stock"
                    accent
                  />
                  <Metric
                    label="可自由分配"
                    value={`${fmt(result.stock.free)} 台`}
                    note={`可用覆盖 ${fmt(result.stock.coverage, 1)} 周 · 历史销速基准`}
                  />
                  <Metric
                    label="在途库存"
                    value={`${fmt(result.stock.transit)} 台`}
                    note="单独列示，不计入实物库存"
                  />
                  <Metric
                    label="参考补库缺口"
                    value={`${fmt(result.stock.gap)} 台`}
                    note="逐门店算缺口后相加"
                  />
                </div>
                <div className="query-channel-grid">
                  {result.channels.map((channel) => (
                    <article key={channel.channel}>
                      <header>
                        <span
                          className={
                            channel.channel === "直营" ? "direct" : "authorized"
                          }
                        />
                        <h3>{channel.label}</h3>
                        <small>{channel.storeCount} 家</small>
                      </header>
                      <strong>
                        {fmt(channel.physical)} <small>台实物</small>
                      </strong>
                      <div>
                        <span>
                          可用<b>{fmt(channel.free)}</b>
                        </span>
                        <span>
                          在途<b>{fmt(channel.transit)}</b>
                        </span>
                        <span>
                          可用覆盖<b>{fmt(channel.coverage, 1)} 周</b>
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
                <Panel
                  title={`${dimensionLabel}库存结构`}
                  subtitle="单日快照 · 不构造月度历史库存。91 天以上库龄为实物库存的子集。"
                  aside={
                    <span className="query-tag">{queryMetadata.stockDate}</span>
                  }
                >
                  <div className="query-chart-legend">
                    <span>
                      <i style={{ background: "#12836f" }} />
                      可用
                    </span>
                    <span>
                      <i style={{ background: "#d5913a" }} />
                      已锁定
                    </span>
                    <span>
                      <i style={{ background: "#acb8bc" }} />
                      质检冻结
                    </span>
                  </div>
                  <div className="query-stock-bars">
                    {result.rows.slice(0, 10).map((row) => (
                      <div key={row.id}>
                        <button type="button" onClick={() => drill(row.id)}>
                          {row.label}
                        </button>
                        <div
                          className="query-stock-track"
                          title={`可用 ${row.free} / 锁定 ${row.locked} / 冻结 ${row.frozen}`}
                          style={{
                            width: `${Math.max(1, (row.physical / Math.max(...result.rows.map((item) => item.physical), 1)) * 100)}%`,
                          }}
                        >
                          <i
                            style={{
                              width: `${row.physical ? (row.free / row.physical) * 100 : 0}%`,
                              background: "#12836f",
                            }}
                          />
                          <i
                            style={{
                              width: `${row.physical ? (row.locked / row.physical) * 100 : 0}%`,
                              background: "#d5913a",
                            }}
                          />
                          <i
                            style={{
                              width: `${row.physical ? (row.frozen / row.physical) * 100 : 0}%`,
                              background: "#acb8bc",
                            }}
                          />
                        </div>
                        <strong>{fmt(row.physical)}</strong>
                      </div>
                    ))}
                  </div>
                  {result.rows.length > 10 && (
                    <p className="query-footnote">
                      图中展示前 10 家；下表保留全部 {result.rows.length}{" "}
                      家门店。
                    </p>
                  )}
                </Panel>
                <Panel
                  title={`${dimensionLabel}库存明细`}
                  subtitle="库存与销速按品牌匹配；授权店库存不代表已获回购或调拨授权。"
                >
                  <div className="query-table-wrap">
                    <table data-testid="query-inventory-table">
                      <thead>
                        <tr>
                          <th>{dimensionLabel}</th>
                          <th>实物</th>
                          <th>可用</th>
                          <th>锁定</th>
                          <th>冻结</th>
                          <th>在途</th>
                          <th>91天+</th>
                          <th>可用覆盖 / 周</th>
                          <th>补库缺口</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <button
                                className="query-drill"
                                onClick={() => drill(row.id)}
                                disabled={filters.dimension === "total"}
                              >
                                {row.label}
                                <ArrowUpRight size={12} />
                              </button>
                            </td>
                            <td>{fmt(row.physical)}</td>
                            <td>{fmt(row.free)}</td>
                            <td>{fmt(row.locked)}</td>
                            <td>{fmt(row.frozen)}</td>
                            <td>{fmt(row.transit)}</td>
                            <td>{fmt(row.aged)}</td>
                            <td>
                              <span
                                className={
                                  row.coverage < 2 ? "query-low-stock" : ""
                                }
                              >
                                {fmt(row.coverage, 1)}
                              </span>
                            </td>
                            <td>{fmt(row.gap)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
            {tab === "transport" && (
              <>
                <div className="query-transport-controls">
                  <label>
                    运输场景
                    <select
                      aria-label="运输场景"
                      value={scenario}
                      onChange={(event) =>
                        setScenario(event.target.value as "dual" | "west")
                      }
                    >
                      <option value="dual">双港口常态</option>
                      <option value="west">仅吉达西部单港口</option>
                    </select>
                  </label>
                  <span>8 台 / 车次 · 不满载仍按整趟计费</span>
                </div>
                <div className="query-metrics">
                  <Metric
                    label="城市运输路线"
                    value={`${activeTransport.routes.length} 条`}
                    note="所选门店共用路线去重"
                    accent
                  />
                  <Metric
                    label="路线整趟报价"
                    value={`${fmt(Math.min(...activeTransport.routes.map((route) => route.cost)))} — ${fmt(Math.max(...activeTransport.routes.map((route) => route.cost)))} SAR`}
                    note="当前场景源数据报价范围"
                    range
                  />
                  <Metric
                    label="涉及路线有效周运力"
                    value={`${fmt(activeTransport.capacity)} 台`}
                    note={`去重城市路线 · ${queryMetadata.capacityWeek}`}
                    testId="query-capacity"
                  />
                  <Metric
                    label="涉及路线局部缺口"
                    value={`${fmt(activeTransport.routeGap)} 台`}
                    note="固定周情景 · 路线缺口求和"
                  />
                </div>
                <Panel
                  title="陆路物流路线地图"
                  subtitle="港口至城市网络 · 点击线路查看距离、报价与运力。"
                  aside={
                    <span className="query-tag">
                      {activeTransport.routes.length} 条路线
                    </span>
                  }
                >
                  <QueryRouteMap routes={activeTransport.routes} />
                </Panel>
                <Panel
                  title="城市路线费用与运力"
                  subtitle="固定场景路线报价与周运力；满载单台费 = 整趟报价 ÷ 8。"
                >
                  <div className="query-table-wrap">
                    <table data-testid="query-route-table">
                      <thead>
                        <tr>
                          <th>始发 → 城市</th>
                          <th>km</th>
                          <th>整趟 / SAR</th>
                          <th>满载单台 / SAR</th>
                          <th>每周可用车次</th>
                          <th>周运力 / 台</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTransport.routes.map((route) => (
                          <tr key={route.id}>
                            <td>
                              <strong>
                                {route.originId === "P-W" ? "吉达" : "达曼"} →{" "}
                                {route.city}
                              </strong>
                              <small>{route.id}</small>
                            </td>
                            <td>{fmt(route.km)}</td>
                            <td>{fmt(route.cost)}</td>
                            <td>{fmt(route.unitCost, 1)}</td>
                            <td>{fmt(route.trucks)}</td>
                            <td>{fmt(route.capacity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
          </>
        )}
      </div>
      <footer className="query-version">
        <span>
          <Database size={12} />
          {queryMetadata.snapshot}
        </span>
        <span>本地模拟数据 · 所有费用 SAR</span>
      </footer>
    </div>
  );
}
