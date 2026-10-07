"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useMemo, useState } from "react";
import geography from "@/lib/query-map-data.json";
import {
  commercialHubs,
  type CommercialResult,
  type CommercialTrip,
} from "@/lib/story/vessel-commercial";
import { vesselOrders } from "@/lib/story/vessel-orders";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
const money = (n: number) => fmt(n, 2);
const rate = (n: number | null) => (n === null ? "—" : fmt(n * 100, 2) + "%");
const stageNames = {
  direct: "直送门店",
  transfer: "港口 → 暂存中心",
  "last-mile": "中心 → 门店 · 订单触发",
};
const colors = {
  direct: "#557b66",
  transfer: "#809c92",
  "last-mile": "#c79343",
};
function dispatchLabel(trip: CommercialTrip) {
  return trip.dispatchStatus === "awaiting-load"
    ? `待拼车 / 待满载 · 还差 ${trip.missingToFull} 台`
    : trip.dispatchStatus === "awaiting-order"
      ? "已满载 · 待订单触发"
      : "已满载 · 可发运";
}
function project(coordinates: number[]) {
  return {
    x: 55 + ((coordinates[0] - 33) / 24) * 865,
    y: 550 - ((coordinates[1] - 15) / 18) * 500,
  };
}
function position(id: string) {
  if (id === "P-W") return project([39.05, 21.45]);
  const hub = commercialHubs.find((h) => h.id === id);
  return project(
    hub?.coordinates ??
      vesselOrders.stores.find((s) => s.city === id)?.coordinates ?? [
        39.05, 21.45,
      ],
  );
}
export function CommercialLogisticsView({
  result,
  selected,
  onStore,
  view = "map",
}: {
  result: CommercialResult;
  selected: string;
  view?: "map" | "trips" | "costs";
  onStore: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  const [stage, setStage] = useState("all"),
    [tripId, setTripId] = useState("");
  const shown = result.logistics.trips.filter(
    (t) => stage === "all" || t.stage === stage,
  );
  const trip =
    shown.find((t) => t.id === tripId) ??
    shown.find((t) => t.parts.some((p) => p.storeId === selected)) ??
    shown[0];
  const routes = useMemo(
    () => [
      ...new Map(
        shown.map((t) => [t.stage + t.originId + t.destinationId, t]),
      ).values(),
    ],
    [shown],
  );
  const store = result.logistics.stores.find((s) => s.storeId === selected)!;
  function chooseTrip(t: CommercialTrip) {
    setTripId(t.id);
    if (t.parts.length) onStore(t.parts[0].storeId);
  }
  return (
    <section className="vr-panel vc-results">
      <header className="vr-panel-heading">
        <div>
          <small>LOGISTICS SIMULATION</small>
          <h3>{translateText("吉达单港 · 补库运输方案")}</h3>
        </div>
        <span>
          {translateText("直送 ")}
          {result.logistics.direct}
          {translateText(" / 暂存 ")}
          {result.logistics.viaHub}
          {translateText(" 台")}
        </span>
      </header>
      {view !== "costs" && (
        <div
          className="vc-dispatch-policy"
          data-testid="logistics-dispatch-policy"
        >
          <strong>{translateText("满载才发运")}</strong>
          <span>
            {translateText(
              "同起点、同终点的门店和车型合并配载；不足整车继续等待拼车。",
            )}
          </span>
          <small>
            {translateText(
              `当前阶段：满载可发运 ${shown.filter((t) => t.dispatchStatus === "ready").length} 班 · 满载待订单 ${shown.filter((t) => t.dispatchStatus === "awaiting-order").length} 班 · 待拼车 ${shown.filter((t) => t.dispatchStatus === "awaiting-load").length} 批`,
            )}
          </small>
        </div>
      )}
      {view !== "costs" && (
        <div
          className="vc-mini-tabs"
          role="tablist"
          aria-label={translateText("补库物流阶段")}
        >
          {[["all", "全部路线"], ...Object.entries(stageNames)].map(
            ([id, name]) => (
              <button
                type="button"
                role="tab"
                aria-selected={stage === id}
                key={id}
                onClick={() => {
                  setStage(id);
                  setTripId("");
                }}
              >
                {translateText(name)}
              </button>
            ),
          )}
        </div>
      )}
      {view === "map" && (
        <>
          <svg
            className="vc-map"
            viewBox="0 0 970 595"
            role="img"
            aria-label={translateText("单港补库及订单触发调拨路线图")}
            data-testid="replenishment-logistics-map"
          >
            <rect width="970" height="595" rx="9" fill="#f1f6fa" />
            {geography.countries.map((country) => (
              <path
                key={country.name}
                d={
                  country.coordinates
                    .map((c, i) => {
                      const p = project(c);
                      return (i ? "L" : "M") + p.x + "," + p.y;
                    })
                    .join(" ") + "Z"
                }
                fill={country.name === "Saudi Arabia" ? "#fcfcfa" : "#e7ecef"}
                stroke="#d4dce3"
                strokeWidth="1.2"
              />
            ))}
            <text
              x="340"
              y="230"
              fill="#c1ccd6"
              fontSize="22"
              letterSpacing="12"
            >
              {translateText("沙特阿拉伯")}
            </text>
            {routes.map((r) => {
              const a = position(r.originId),
                b = position(r.destinationId);
              return (
                <path
                  key={r.stage + r.originId + r.destinationId}
                  d={
                    "M" +
                    a.x +
                    "," +
                    a.y +
                    " Q" +
                    (a.x + b.x) / 2 +
                    "," +
                    ((a.y + b.y) / 2 - 22) +
                    " " +
                    b.x +
                    "," +
                    b.y
                  }
                  fill="none"
                  stroke={colors[r.stage]}
                  strokeWidth="1.4"
                  opacity=".35"
                  strokeDasharray={
                    r.dispatchStatus !== "ready" ? "5 4" : undefined
                  }
                />
              );
            })}
            {trip &&
              (() => {
                const a = position(trip.originId),
                  b = position(trip.destinationId);
                return (
                  <path
                    d={
                      "M" +
                      a.x +
                      "," +
                      a.y +
                      " Q" +
                      (a.x + b.x) / 2 +
                      "," +
                      ((a.y + b.y) / 2 - 22) +
                      " " +
                      b.x +
                      "," +
                      b.y
                    }
                    fill="none"
                    stroke={colors[trip.stage]}
                    strokeWidth="4"
                    strokeDasharray={
                      trip.dispatchStatus !== "ready" ? "7 4" : undefined
                    }
                  />
                );
              })()}
            {vesselOrders.stores.map((s) => {
              const p = project(s.coordinates),
                peers = vesselOrders.stores.filter((o) => o.city === s.city),
                index = peers.findIndex((o) => o.id === s.id);
              const a = (index / peers.length) * Math.PI * 2,
                x = p.x + Math.cos(a) * 10,
                y = p.y + Math.sin(a) * 10;
              return (
                <g
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={translateText(s.name + " 物流路线")}
                  onClick={() => {
                    onStore(s.id);
                    setTripId("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onStore(s.id);
                      setTripId("");
                    }
                  }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={selected === s.id ? 6 : 3}
                    fill={s.channel === "直营" ? "#47899c" : "#97b1bf"}
                    stroke={selected === s.id ? "#254c70" : "white"}
                    strokeWidth="1.4"
                  />
                  <title>{translateText(s.name)}</title>
                  {selected === s.id && (
                    <text x={x + 10} y={y + 22} fontSize="11" fill="#3b5c79">
                      {translateText(s.shortName)}
                    </text>
                  )}
                </g>
              );
            })}
            {commercialHubs.map((h) => {
              const p = position(h.id);
              return (
                <g key={h.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="16"
                    fill="#e9e8f8"
                    fillOpacity=".7"
                    stroke="#8486ba"
                    strokeWidth="2"
                  />
                  <circle cx={p.x} cy={p.y} r="6" fill="#8486ba" />
                  <text x={p.x + 20} y={p.y - 14} fill="#64679a" fontSize="12">
                    {translateText(h.name.replace("（模拟）", ""))}
                  </text>
                  <title>{translateText(h.name)}</title>
                </g>
              );
            })}
            {(() => {
              const p = position("P-W");
              return (
                <g>
                  <rect
                    x={p.x - 7}
                    y={p.y - 7}
                    width="14"
                    height="14"
                    rx="2"
                    fill="#355e85"
                  />
                  <text
                    x={p.x - 12}
                    y={p.y + 32}
                    textAnchor="end"
                    fill="#355e85"
                    fontSize="13"
                  >
                    {translateText("吉达港")}
                  </text>
                </g>
              );
            })()}
          </svg>
          <div className="vc-map-legend">
            {Object.entries(stageNames).map(([key, name]) => (
              <span key={key}>
                <i style={{ background: colors[key as keyof typeof colors] }} />
                {translateText(name)}
              </span>
            ))}
            <span>{translateText("◎ VPC / 区域中转中心")}</span>
          </div>
        </>
      )}
      {view === "trips" && (
        <div
          className="vr-table-scroll vs-trip-table"
          data-testid="logistics-trips-table"
        >
          <table>
            <thead>
              <tr>
                <th>{translateText("班次")}</th>
                <th>{translateText("起点 → 终点")}</th>
                <th>{translateText("发运条件")}</th>
                <th>{translateText("配载状态")}</th>
                <th>{translateText("装载 / 容量")}</th>
                <th>{translateText("本段预算 SAR")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr
                  key={t.id}
                  aria-selected={trip?.id === t.id}
                  data-dispatch-status={t.dispatchStatus}
                >
                  <td>
                    <button type="button" onClick={() => chooseTrip(t)}>
                      {translateText(t.id)}
                    </button>
                  </td>
                  <td>
                    {translateText(t.origin)} → {translateText(t.destination)}
                  </td>
                  <td>{translateText(t.trigger)}</td>
                  <td>
                    <strong
                      className="vc-dispatch-status"
                      data-status={t.dispatchStatus}
                    >
                      {translateText(dispatchLabel(t))}
                    </strong>
                    {new Set(t.parts.map((p) => p.storeId)).size > 1 && (
                      <small className="vc-pool-label">
                        {translateText("多店拼车")}
                      </small>
                    )}
                  </td>
                  <td>
                    {t.quantity} / {t.capacity}
                  </td>
                  <td>{translateText(money(t.cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p>{translateText("本版本暂无运输班次。")}</p>}
        </div>
      )}
      {view !== "costs" && (
        <div className="vc-trip-inspector">
          <label>
            {translateText("查看班次")}
            <select
              aria-label={translateText("补库物流班次")}
              value={trip?.id ?? ""}
              onChange={(e) =>
                chooseTrip(shown.find((t) => t.id === e.target.value)!)
              }
            >
              {shown.map((t) => (
                <option key={t.id} value={t.id}>
                  {translateText(t.id)} · {translateText(t.origin)} →{" "}
                  {translateText(t.destination)} · {t.quantity}
                  {translateText(" 台")}
                  {" · "}
                  {translateText(dispatchLabel(t))}
                </option>
              ))}
            </select>
          </label>
          {trip ? (
            <>
              <div className="vc-trip-heading">
                <strong>
                  {translateText(trip.origin)} →{" "}
                  {translateText(trip.destination)}
                </strong>
                <span>
                  {translateText(trip.trigger)} · {trip.quantity} /{" "}
                  {trip.capacity}
                  {translateText(" 台 ·")}
                  {translateText(" ")}
                  {translateText(money(trip.cost))} SAR
                </span>
              </div>
              <p
                className="vc-dispatch-status vc-dispatch-note"
                data-status={trip.dispatchStatus}
                data-testid="trip-dispatch-status"
              >
                <strong>{translateText(dispatchLabel(trip))}</strong>
                {trip.dispatchStatus === "awaiting-load" && (
                  <span>
                    {translateText(
                      "等待后续同线路车辆拼车，装满后再发运；末端调拨还需订单触发。",
                    )}
                  </span>
                )}
              </p>
              <div
                className="vr-table-scroll"
                data-testid="commercial-trip-list"
              >
                <table>
                  <thead>
                    <tr>
                      <th>{translateText("门店")}</th>
                      <th>{translateText("车型")}</th>
                      <th>{translateText("数量")}</th>
                      <th>{translateText("本段预算 SAR")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.parts.map((p, i) => (
                      <tr key={i}>
                        <td>
                          <button
                            type="button"
                            onClick={() => onStore(p.storeId)}
                          >
                            {translateText(p.storeId)}
                          </button>
                        </td>
                        <td>{translateText(p.model)}</td>
                        <td>{p.quantity}</td>
                        <td>{translateText(money(p.cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="vr-footnote">
                  {translateText("到港首程计划配载 ")}
                  {result.logistics.quantity}
                  {translateText(" 台；另有")}
                  {translateText(" ")}
                  {result.logistics.viaHub}
                  {translateText(
                    " 台末端调拨方案，满载且订单触发后执行。待拼车批次保留车辆与预算，不计为可发运班次。",
                  )}
                </p>
              </div>
            </>
          ) : (
            <p>{translateText("本版本没有补库车辆，暂无运输班次。")}</p>
          )}
        </div>
      )}
      <div className="vc-store-cost">
        <span>
          {translateText(store.name)} · {translateText(store.channel)}
        </span>
        <strong>
          {translateText("单车 ")}
          {translateText(money(store.unitCost))} SAR
        </strong>
        <small>
          {translateText("8 台基准 ")}
          {translateText(money(store.baseUnitCost))} × {store.factor} × 8 ÷
          {translateText(" ")}
          {result.logistics.truckCapacity}
          {translateText(" · 本店 ")}
          {store.quantity}
          {translateText(" 台 · 共")}
          {translateText(" ")}
          {translateText(money(store.cost))} SAR
        </small>
      </div>
      {view === "costs" && (
        <div className="vc-cost-details" data-testid="logistics-costs-table">
          <h4>
            {translateText("全部门店单车物流成本 · ")}
            {result.logistics.stores.length}
            {translateText(" 家")}
          </h4>
          <div className="vr-table-scroll vc-editor-scroll">
            <table>
              <thead>
                <tr>
                  <th>{translateText("门店")}</th>
                  <th>{translateText("单车 SAR")}</th>
                  <th>{translateText("补库台数")}</th>
                  <th>{translateText("物流总成本 SAR")}</th>
                </tr>
              </thead>
              <tbody>
                {result.logistics.stores.map((s) => (
                  <tr key={s.storeId}>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          onStore(s.storeId);
                          setTripId("");
                        }}
                      >
                        {translateText(s.name)}
                      </button>
                    </td>
                    <td>{translateText(money(s.unitCost))}</td>
                    <td>{s.quantity}</td>
                    <td>{translateText(money(s.cost))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="vr-footnote">
        {translateText(
          "路线为城市间示意。每班次装载不超过设定的 8–10 台；单车预算按 8 台满载基准 × 系数 × 8 ÷ 板车容量摊销，尾班仍按单车预算计费。中转路线暂按单车预算的 70% / 30% 分摊首程与末端，非承运商整车报价；末端没有实际订单和发车日期。北部、南部中心为模拟地点。",
        )}
      </p>
    </section>
  );
}

export function CommercialProfitView({
  result,
  selected,
  model,
  onStore,
  onModel,
  view,
}: {
  result: CommercialResult;
  selected: string;
  model: string;
  onStore: (id: string) => void;
  onModel: (id: string) => void;
  view: "unit" | "models" | "stores";
}) {
  const { t: translateText } = useI18n();

  const store = result.profit.stores.find((s) => s.id === selected)!;
  const rows = result.profit.rows.filter((r) => r.storeId === selected);
  const unit = rows.find((r) => r.model === model) ?? rows[0];
  const totals = result.profit.summary;
  const bars =
    view === "stores"
      ? result.profit.stores
          .filter((s) => s.quantity)
          .map((s) => ({
            id: s.id,
            label: s.id.replace("MOCK-", ""),
            name: s.name,
            a: s.revenue,
            b: s.net,
          }))
      : rows.map((r) => ({
          id: r.model,
          label: r.model,
          name: r.model,
          a: view === "unit" ? r.unitGross : r.revenue,
          b: view === "unit" ? r.unitNet : r.net,
        }));
  const width = Math.max(660, bars.length * (view === "stores" ? 60 : 85)),
    left = 65,
    right = width - 20,
    top = 25,
    bottom = 245;
  const maximum = Math.max(1, ...bars.flatMap((r) => [r.a, r.b])),
    minimum = Math.min(0, ...bars.flatMap((r) => [r.a, r.b]));
  const y = (n: number) =>
      bottom - ((n - minimum) / (maximum - minimum)) * (bottom - top),
    zero = y(0);
  return (
    <section className="vr-panel vc-results">
      <header className="vr-panel-heading">
        <div>
          <small>PRICING & PROFIT</small>
          <h3>
            {translateText(
              view === "unit"
                ? "单车毛利 / 净利"
                : view === "models"
                  ? "本店车型总利润"
                  : "门店营业额 / 净利",
            )}
          </h3>
        </div>
        <span>{translateText("单位 SAR · 补库全部售出假设")}</span>
      </header>
      <div
        className="vc-profit-summary"
        data-testid="commercial-profit-summary"
      >
        {[
          ["预计营业额", money(totals.revenue)],
          ["预计净利", money(totals.net)],
          ["全网净利率", rate(totals.margin)],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{translateText(label)}</small>
            <strong>{translateText(value)}</strong>
          </article>
        ))}
      </div>
      <div className="vc-store-profit">
        <strong>
          {translateText(store.name)}
          {translateText(" ")}
          <span>
            {translateText(
              store.channel === "直营" ? "直营 · 零售口径" : "授权 · 批发口径",
            )}
          </span>
        </strong>
        <dl>
          {[
            ["本店补库", store.quantity + " 台"],
            ["营业额", money(store.revenue)],
            ["净利", money(store.net)],
            ["净利率", rate(store.margin)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{translateText(label)}</dt>
              <dd>{translateText(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="vc-chart-caption">
        <span>
          <i className="vc-dot blue" />
          {translateText(view === "unit" ? "单车毛利" : "营业额")}
          {translateText(" ")}
          <i className="vc-dot teal" />
          {translateText(view === "unit" ? "单车净利" : "净利")}
        </span>
        <small>{translateText("SAR · 横向滚动查看")}</small>
      </div>
      <div className="vc-chart-scroll">
        <svg
          viewBox={"0 0 " + width + " 320"}
          style={{ minWidth: width }}
          role="img"
          aria-label={translateText("利润比较柱状图")}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const value = minimum + ((maximum - minimum) * i) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#e7edf3"
                />
                <text x={left - 8} y={y(value) + 4} textAnchor="end">
                  {translateText(fmt(value))}
                </text>
              </g>
            );
          })}
          <line x1={left} x2={right} y1={zero} y2={zero} stroke="#9eafbf" />
          {bars.map((r, i) => {
            const x =
              left + ((i + 0.5) * (right - left)) / Math.max(1, bars.length);
            return (
              <g
                key={r.id}
                role="button"
                tabIndex={0}
                aria-label={translateText(r.name + " 利润")}
                onClick={() =>
                  view === "stores" ? onStore(r.id) : onModel(r.id)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    view === "stores" ? onStore(r.id) : onModel(r.id);
                  }
                }}
              >
                {[r.a, r.b].map((v, k) => (
                  <rect
                    key={k}
                    x={x - 19 + k * 20}
                    y={Math.min(zero, y(v))}
                    width="17"
                    height={Math.max(1, Math.abs(y(v) - zero))}
                    rx="2"
                    fill={v < 0 ? "#c27178" : k ? "#557b66" : "#9bb2a5"}
                    opacity={
                      r.id === (view === "stores" ? selected : model) ? 1 : 0.75
                    }
                  />
                ))}
                <text
                  transform={"translate(" + x + " 264) rotate(30)"}
                  fontSize="10"
                >
                  {translateText(r.label)}
                </text>
                <title>
                  {translateText(
                    r.name + "：" + money(r.a) + " / " + money(r.b) + " SAR",
                  )}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
      {view === "unit" && (
        <div className="vc-unit-profit">
          <strong>
            {translateText(unit.model)} ·{" "}
            {translateText(store.channel === "直营" ? "零售" : "批发")}
            {translateText("系数 ×")}
            {unit.priceFactor}
            {translateText(" · 补库 ")}
            {unit.quantity}
            {translateText(" 台")}
          </strong>
          <dl>
            {[
              ["成交价格", unit.unitPrice],
              ["采购价", unit.purchasePrice],
              ["单车毛利", unit.unitGross],
              ["单车物流", unit.unitLogistics],
              ["单车固定费用", unit.unitFixed],
              ["单车净利", unit.unitNet],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{translateText(label)}</dt>
                <dd className={(value as number) < 0 ? "vc-negative" : ""}>
                  {translateText(money(value as number))}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            {translateText("单车毛利率 ")}
            {translateText(rate(unit.unitGross / unit.unitPrice))}
            {translateText(" · 单车净利率")}
            {translateText(" ")}
            {translateText(rate(unit.unitNet / unit.unitPrice))}
            {translateText(" · 本车型净利 ")}
            {translateText(money(unit.net))}
            {translateText(" ")}
            SAR
          </p>
        </div>
      )}
      {view !== "stores" && (
        <div className="vr-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{translateText("本店车型")}</th>
                <th>{translateText("数量")}</th>
                {view === "unit" ? (
                  <>
                    <th>{translateText("成交价格")}</th>
                    <th>{translateText("单车毛利")}</th>
                    <th>{translateText("单车净利")}</th>
                  </>
                ) : (
                  <>
                    <th>{translateText("营业额")}</th>
                    <th>{translateText("毛利")}</th>
                    <th>{translateText("物流成本")}</th>
                    <th>{translateText("固定费用")}</th>
                    <th>{translateText("净利")}</th>
                  </>
                )}
                <th>{translateText("净利率")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model} data-selected={model === r.model}>
                  <td>
                    <button type="button" onClick={() => onModel(r.model)}>
                      {translateText(r.model)}
                    </button>
                  </td>
                  <td>{r.quantity}</td>
                  {view === "unit" ? (
                    <>
                      <td>{translateText(money(r.unitPrice))}</td>
                      <td>{translateText(money(r.unitGross))}</td>
                    </>
                  ) : (
                    <>
                      <td>{translateText(money(r.revenue))}</td>
                      <td>{translateText(money(r.gross))}</td>
                      <td>{translateText(money(r.logistics))}</td>
                      <td>{translateText(money(r.fixed))}</td>
                    </>
                  )}
                  <td
                    className={
                      (view === "unit" ? r.unitNet : r.net) < 0
                        ? "vc-negative"
                        : ""
                    }
                  >
                    {translateText(money(view === "unit" ? r.unitNet : r.net))}
                  </td>
                  <td>
                    {translateText(
                      rate(
                        view === "unit" ? r.unitNet / r.unitPrice : r.margin,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view === "stores" && (
        <div className="vc-cost-details">
          <h4>{translateText("全部门店经营汇总")}</h4>
          <div className="vr-table-scroll vc-editor-scroll">
            <table>
              <thead>
                <tr>
                  <th>{translateText("门店")}</th>
                  <th>{translateText("数量")}</th>
                  <th>{translateText("营业额")}</th>
                  <th>{translateText("毛利")}</th>
                  <th>{translateText("净利")}</th>
                  <th>{translateText("净利率")}</th>
                </tr>
              </thead>
              <tbody>
                {result.profit.stores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <button type="button" onClick={() => onStore(s.id)}>
                        {translateText(s.name)} · {translateText(s.channel)}
                      </button>
                    </td>
                    <td>{s.quantity}</td>
                    <td>{translateText(money(s.revenue))}</td>
                    <td>{translateText(money(s.gross))}</td>
                    <td className={s.net < 0 ? "vc-negative" : ""}>
                      {translateText(money(s.net))}
                    </td>
                    <td>{translateText(rate(s.margin))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="vr-footnote">
        {translateText(
          "授权店按批发收入测算供货方利润；直营店按零售收入并扣固定费用，授权店不扣固定费用。同车型计入各店实际物流后，直营单车净利高于授权。门店净利率 = 全车型净利合计 ÷ 营业额合计，不取车型利率的平均。0 台车型仅展示单车测算，不计门店总收入。此处只测算补库车辆，订单车和预留车另计。",
        )}
      </p>
    </section>
  );
}
