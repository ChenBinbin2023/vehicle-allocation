"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ChartNoAxesCombined,
  Coins,
  Play,
  Store,
  Truck,
} from "lucide-react";
import {
  calculateProfit,
  type ProfitOrder,
  type ProfitScenario,
  type ProfitMoney,
} from "@/lib/story/profit-analysis";
import type { StoryRun } from "@/lib/story/types";
import CostRateEditor from "./CostRateEditor";
const money = (n: number | null) =>
  n === null
    ? "待确认"
    : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const margin = (n: number | null) =>
  n === null ? "待确认" : (n * 100).toFixed(1) + "%";
const fields = [
  ["qty", "数量"],
  ["unitPrice", "未税单价"],
  ["discount", "单台折扣"],
  ["purchase", "采购单价"],
  ["commissionPct", "佣金率 %"],
  ["other", "其他单台费用"],
] as const;
function Bridge({ value, label }: { value: ProfitMoney; label: string }) {
  const bars = [
    ["净销售收入", value.revenue, "income"],
    ["采购成本", value.purchase, "purchase"],
    ["物流成本", value.logistics, "logistics"],
    ["销售佣金", value.commission, "commission"],
    ["其他归属费用", value.other, "other"],
    [
      "贡献利润",
      value.profit,
      value.profit !== null && value.profit < 0 ? "negative" : "profit",
    ],
  ] as const;
  const max = Math.max(1, ...bars.map(([, v]) => Math.abs(v ?? 0)));
  return (
    <section className="profit-bridge" data-testid="profit-bridge">
      <header>
        <h2>收入如何转为利润</h2>
        <p>{label} · SAR · 净收入减各项成本</p>
      </header>
      {bars.map(([name, v, color]) => (
        <div className="profit-bridge-row" key={name}>
          <span>{name}</span>
          <div className="profit-bridge-track">
            <i
              className={color}
              style={{
                width: (v === null ? 0 : (Math.abs(v) / max) * 100) + "%",
              }}
            />
          </div>
          <strong className={color === "negative" ? "profit-negative" : ""}>
            {money(v)}
          </strong>
        </div>
      ))}
    </section>
  );
}
export default function ProfitWorkspace({
  run,
  focusedStep,
  focusRevision,
  busy,
  onRunProfit,
}: {
  run: StoryRun;
  focusedStep: number | null;
  focusRevision: number;
  busy: boolean;
  onRunProfit: (
    input: ProfitScenario | undefined,
    deliveryRunId: string,
  ) => void;
}) {
  const snapshot = run.profit!,
    result = snapshot.result;
  const [input, setInput] = useState(() => structuredClone(result.input));
  const [tab, setTab] = useState<"orders" | "models" | "stores">("orders");
  const [model, setModel] = useState("all"),
    [store, setStore] = useState("all"),
    [search, setSearch] = useState("");
  const [orderId, setOrderId] = useState(""),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const event = focusedStep === null ? null : run.events[focusedStep];
    if (event?.profitTab) {
      setTab(event.profitTab);
      setModel("all");
      setStore("all");
      setSearch("");
      const frame = requestAnimationFrame(() =>
        ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [focusedStep, focusRevision, run.events]);
  const ready =
    run.blocks.find((b) => b.type === "profit-" + tab)?.status === "ready";
  const orders = result.orders.filter(
    (o) =>
      (model === "all" || o.brand + "/" + o.model === model) &&
      (store === "all" || o.storeId === store) &&
      (!search ||
        [o.id, o.model, o.storeName, o.storeId]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const order = orders.find((o) => o.id === orderId) ?? orders[0];
  const edited = JSON.stringify(input) !== JSON.stringify(result.input);
  function updateOrder(
    id: string,
    key: (typeof fields)[number][0],
    value: string,
  ) {
    setInput({
      ...input,
      orders: input.orders.map((o) =>
        o.id === id
          ? {
              ...o,
              [key]: value === "" && key !== "qty" ? null : Number(value),
            }
          : o,
      ),
    });
  }
  function rerun() {
    try {
      calculateProfit(snapshot.allocation, snapshot.delivery, input);
      setError("");
      onRunProfit(input, snapshot.deliveryRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请检查情景参数");
    }
  }
  function exportSnapshot() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = run.id + "-profit.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <div
      className="planning-workspace profit-workspace"
      data-testid="profit-workspace"
    >
      <header className="planning-hero">
        <div className="planning-hero-icon">
          <Coins size={23} />
        </div>
        <div>
          <small>PROFIT ANALYSIS · /profit-analysis</small>
          <h1>销售贡献利润</h1>
          <p>从销售情景到物流成本，逐笔说明利润，再汇总到车型与门店。</p>
        </div>
        <span className="planning-status">
          {run.status === "complete"
            ? "模拟已完成"
            : run.status === "paused"
              ? "已暂停"
              : "计算中"}
        </span>
      </header>
      <div className="planning-context">
        <span>
          <Truck size={14} />
          绑定物流 {snapshot.deliveryRunId.split("-").at(-1)}
        </span>
        <span>
          {snapshot.allocation.input.brand} ·{" "}
          {result.input.mode === "single" ? "吉达单港" : "双港"}
        </span>
        <span>新增模拟销售订单 · SAR · 未税 · 非实际财务账</span>
        <button
          type="button"
          disabled={run.status !== "complete"}
          onClick={exportSnapshot}
        >
          <ArrowDownToLine size={14} />
          导出利润快照
        </button>
      </div>
      <nav className="planning-tabs" role="tablist" aria-label="利润分析视图">
        {(
          [
            ["orders", "订单利润", Coins],
            ["models", "车型利润", ChartNoAxesCombined],
            ["stores", "门店利润", Store],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            type="button"
            role="tab"
            key={id}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      {ready && (
        <>
          <div className="planning-conclusion" data-testid="profit-conclusion">
            <small>本轮结论 · 贡献利润口径</small>
            <p>{result.summaryText}</p>
          </div>
          <div className="planning-metrics profit-metrics">
            {[
              [
                "净销售收入",
                money(result.summary.revenue) + " SAR",
                `${result.summary.orderCount} 笔销售情景 · ${result.summary.qty} 台`,
              ],
              [
                "贡献利润",
                money(result.summary.profit) +
                  (result.summary.profit === null ? "" : " SAR"),
                "全部销售情景订单",
              ],
              [
                "贡献利润率",
                margin(result.summary.margin),
                "按总利润 / 总净收入计算",
              ],
              [
                "亏损 / 待确认",
                `${result.summary.negativeOrders} / ${result.summary.unknownOrders} 笔`,
                "缺项不会按零成本计算",
              ],
            ].map(([label, value, note]) => (
              <article className="planning-metric" key={label}>
                <small>{label}</small>
                <strong
                  className={
                    label === "贡献利润" &&
                    result.summary.profit !== null &&
                    result.summary.profit < 0
                      ? "profit-negative"
                      : ""
                  }
                >
                  {value}
                </strong>
                <span>{note}</span>
              </article>
            ))}
          </div>
        </>
      )}
      <details className="profit-parameters">
        <summary>
          调整销售价格、采购成本和物流费率{edited ? " · 参数已修改" : ""}
        </summary>
        <p>
          销售情景数量不得超过绑定门店分车量；售价、采购及车型为 data/05_利润
          的新增模拟假设。空值表示待确认。更改后点击重跑保存新画布。
        </p>
        <div className="planning-controls">
          <label>
            利润运输情景
            <select
              aria-label="利润运输情景"
              value={input.mode}
              onChange={(e) =>
                setInput({
                  ...input,
                  mode: e.target.value as ProfitScenario["mode"],
                })
              }
            >
              <option value="single">吉达单港</option>
              <option value="dual">吉达 + 达曼双港</option>
            </select>
          </label>
        </div>
        <div className="planning-table-scroll">
          <table className="profit-edit-table">
            <thead>
              <tr>
                <th>销售情景订单 / 车型 / 门店</th>
                {fields.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {input.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.id}</strong>
                    <br />
                    {o.model} · {o.storeId}
                  </td>
                  {fields.map(([key]) => (
                    <td key={key}>
                      <input
                        type="number"
                        min="0"
                        step={key === "qty" ? 1 : "any"}
                        aria-label={o.id + " " + key}
                        value={o[key] ?? ""}
                        placeholder="待确认"
                        onChange={(e) => updateOrder(o.id, key, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>物流补充费用</h3>
        <CostRateEditor
          value={input.costRates}
          onChange={(costRates) => setInput({ ...input, costRates })}
        />
        <div className="planning-action-row">
          <button
            type="button"
            className="planning-primary"
            disabled={busy}
            onClick={rerun}
          >
            <Play size={14} />
            重算利润情景
          </button>
          <span>
            {edited ? "下方仍展示已保存结果" : "每次重跑保留独立快照"}
          </span>
        </div>
        {error && (
          <p role="alert" className="planning-error">
            {error}
          </p>
        )}
      </details>
      {!ready ? (
        <div className="planning-loading">
          <i />
          正在读取物流与财务情景，生成利润分析…
        </div>
      ) : (
        <div ref={ref}>
          {tab === "orders" ? (
            <>
              <div className="profit-filters">
                <label>
                  车型
                  <select
                    aria-label="利润车型筛选"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="all">全部车型</option>
                    {result.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  门店
                  <select
                    aria-label="利润门店筛选"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                  >
                    <option value="all">全部门店</option>
                    {result.stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  查找订单
                  <input
                    aria-label="查找利润订单"
                    placeholder="订单号、车型或门店"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setModel("all");
                    setStore("all");
                    setSearch("");
                  }}
                >
                  清除筛选
                </button>
              </div>
              <section className="planning-panel">
                <header>
                  <h2>订单级别利润</h2>
                  <p>
                    当前显示 {orders.length} / {result.orders.length}{" "}
                    笔；物流按门店已路由车辆平均摊分，无订单 VIN 精确成本绑定。
                  </p>
                </header>
                <div className="planning-table-scroll">
                  <table data-testid="profit-order-table">
                    <thead>
                      <tr>
                        <th>销售情景订单</th>
                        <th>车型 / 门店</th>
                        <th>数量</th>
                        <th>净收入</th>
                        <th>采购</th>
                        <th>物流</th>
                        <th>贡献利润</th>
                        <th>利润率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr
                          key={o.id}
                          className={order?.id === o.id ? "selected" : ""}
                        >
                          <td>
                            <button
                              type="button"
                              onClick={() => setOrderId(o.id)}
                            >
                              {o.id}
                            </button>
                          </td>
                          <td>
                            {o.model}
                            <br />
                            <small>{o.storeName}</small>
                          </td>
                          <td>{o.qty}</td>
                          <td>{money(o.revenue)}</td>
                          <td>{money(o.purchase)}</td>
                          <td>{money(o.logistics)}</td>
                          <td
                            className={
                              o.profit !== null && o.profit < 0
                                ? "profit-negative"
                                : ""
                            }
                          >
                            {money(o.profit)}
                          </td>
                          <td>{margin(o.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!orders.length && <p>没有符合筛选条件的销售情景订单。</p>}
              </section>
              {order && (
                <div className="profit-detail-grid">
                  <Bridge value={order} label={order.id} />
                  <section
                    className="profit-order-detail"
                    data-testid="profit-order-detail"
                  >
                    <small>订单成本依据</small>
                    <h2>{order.id}</h2>
                    <p>
                      {order.model} · {order.storeName} · {order.qty} 台
                    </p>
                    <dl>
                      <dt>干线摊分</dt>
                      <dd>{money(order.linehaul)} SAR</dd>
                      <dt>物流合计</dt>
                      <dd>{money(order.logistics)} SAR</dd>
                      <dt>门店经 VPC 比例</dt>
                      <dd>{(order.vpcShare * 100).toFixed(1)}%</dd>
                      <dt>佣金 / 其他费用</dt>
                      <dd>
                        {money(order.commission)} / {money(order.other)} SAR
                      </dd>
                    </dl>
                    {order.missing.length ? (
                      <p className="profit-missing">
                        待确认：{order.missing.join("、")}
                      </p>
                    ) : (
                      <p
                        className={
                          order.profit! < 0
                            ? "profit-negative"
                            : "profit-positive"
                        }
                      >
                        {order.profit! < 0
                          ? "亏损原因：净销售收入不足以覆盖采购、物流及销售费用。"
                          : "本销售情景覆盖可归属成本，贡献利润为正。"}
                      </p>
                    )}
                    <p>
                      整趟干线报价来自原
                      data；补充物流、采购与售价来自可编辑情景。贡献利润未扣固定经营费用和税费。
                    </p>
                  </section>
                </div>
              )}
            </>
          ) : (
            <>
              <section className="planning-panel">
                <header>
                  <h2>{tab === "models" ? "车型级别利润" : "门店级别利润"}</h2>
                  <p>
                    汇总同一销售情景订单集合；点击名称下钻订单，检查毛利被哪些成本消耗。
                  </p>
                </header>
                <div className="planning-table-scroll">
                  <table data-testid={"profit-" + tab + "-table"}>
                    <thead>
                      <tr>
                        <th>{tab === "models" ? "车型" : "门店"}</th>
                        <th>订单数 / 台数</th>
                        <th>净收入</th>
                        <th>采购</th>
                        <th>物流</th>
                        <th>贡献利润</th>
                        <th>利润率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tab === "models" ? result.models : result.stores).map(
                        (g) => (
                          <tr key={g.id}>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setModel(tab === "models" ? g.id : "all");
                                  setStore(tab === "stores" ? g.id : "all");
                                  setSearch("");
                                  setOrderId(g.orderIds[0]);
                                  setTab("orders");
                                }}
                              >
                                {g.name} ↗
                              </button>
                            </td>
                            <td>
                              {g.orderIds.length} 笔 / {g.qty} 台
                            </td>
                            <td>{money(g.revenue)}</td>
                            <td>{money(g.purchase)}</td>
                            <td>{money(g.logistics)}</td>
                            <td
                              className={
                                g.profit !== null && g.profit < 0
                                  ? "profit-negative"
                                  : ""
                              }
                            >
                              {money(g.profit)}
                            </td>
                            <td>{margin(g.margin)}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <Bridge value={result.summary} label="全部销售情景订单" />
            </>
          )}
          <section className="profit-comparison">
            <header>
              <h2>同一销售情景：单港与双港</h2>
              <p>
                价格、采购及订单集合保持一致，按各港口方案的路线和 VPC
                比例摊分物流。无运力覆盖的销售数量保持待确认。
              </p>
            </header>
            <div className="planning-port-compare">
              {(["single", "dual"] as const).map((mode) => {
                const s = calculateProfit(
                  snapshot.allocation,
                  snapshot.delivery,
                  { ...result.input, mode },
                ).summary;
                return (
                  <article key={mode}>
                    <small>{mode === "single" ? "吉达单港" : "双港"}</small>
                    <strong>
                      {money(s.profit)}
                      {s.profit === null ? "" : " SAR"}
                    </strong>
                    <p>
                      物流 {money(s.logistics)} SAR · 利润率 {margin(s.margin)}
                    </p>
                    <span>
                      {s.negativeOrders} 笔亏损 · {s.unknownOrders} 笔待确认
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
          <p className="planning-footnote">
            三层级均为贡献利润，非净利润财报。销售情景不证明实际成交或库存已售出；物流
            ETA 仍是计划，真实履约和财务账需另行接入。
          </p>
        </div>
      )}
    </div>
  );
}
