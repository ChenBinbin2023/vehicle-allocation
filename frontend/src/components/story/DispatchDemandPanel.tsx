"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import VesselSectionHeading from "./VesselSectionHeading";
import { useMemo, useState } from "react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import {
  arabianCountries,
  projectArabianPoint,
} from "@/lib/story/arabian-base-map";
import {
  dispatchDemand,
  type DispatchFilter,
  type DispatchSnapshot,
} from "@/lib/story/daily-dispatch";

export default function DispatchDemandPanel({
  data,
}: {
  data: DispatchSnapshot;
}) {
  const { t: translateText } = useI18n();

  const [filter, setFilter] = useState<DispatchFilter>("all");
  const [storeId, setStoreId] = useState(data.stores[0].id);
  const [hoverStore, setHoverStore] = useState<string | null>(null);
  const [hoverModel, setHoverModel] = useState<string | null>(null);
  const orders = dispatchDemand(data, filter);
  const quantity = (id: string) =>
    orders.filter((o) => o.storeId === id).reduce((n, o) => n + o.quantity, 0);
  const store = data.stores.find((s) => s.id === storeId)!;
  const selected = orders.filter((o) => o.storeId === storeId);
  const models = [...new Set(selected.map((o) => o.model))]
    .map((model) => ({
      model,
      quantity: selected
        .filter((o) => o.model === model)
        .reduce((n, o) => n + o.quantity, 0),
    }))
    .sort((a, b) => b.quantity - a.quantity);
  const max = Math.max(1, ...data.stores.map((s) => quantity(s.id)));
  const maxBar = Math.max(1, ...models.map((m) => m.quantity));
  const points = useMemo(() => {
    const placed: { id: string; x: number; y: number }[] = [];
    for (const s of data.stores) {
      const [cx, cy] = projectArabianPoint(s.coordinates[0], s.coordinates[1]);
      for (let attempt = 0; attempt < 200; attempt++) {
        const angle = attempt * 2.4,
          offset = 10 * Math.sqrt(attempt);
        const x = cx + Math.cos(angle) * offset,
          y = cy + Math.sin(angle) * offset;
        if (placed.every((p) => Math.hypot(x - p.x, y - p.y) > 43)) {
          placed.push({ id: s.id, x, y });
          break;
        }
      }
    }
    return placed;
  }, [data.stores]);
  const tooltipOrders = selected.filter((o) => o.model === hoverModel);
  const configs = [
    ...new Set(tooltipOrders.map((o) => `${o.trim} · ${o.color}`)),
  ].map((config) => ({
    config,
    quantity: tooltipOrders
      .filter((o) => `${o.trim} · ${o.color}` === config)
      .reduce((n, o) => n + o.quantity, 0),
  }));
  function changeFilter(next: DispatchFilter) {
    setFilter(next);
    setHoverModel(null);
    setHoverStore(null);
    if (!dispatchDemand(data, next, storeId).length)
      setStoreId(dispatchDemand(data, next)[0]?.storeId ?? data.stores[0].id);
  }
  return (
    <section className="dd-section" data-testid="dispatch-demand">
      <div className="dd-section-heading">
        <VesselSectionHeading
          number="01"
          english="DEMAND"
          title={translateText("门店需求分布")}
          note="先看需求在哪里，再定位到具体车型与配置。"
        />
        <span>
          {orders.length}
          {translateText(" 笔订单 ")}
          <i />
          {translateText(" ")}
          {orders.reduce((n, o) => n + o.quantity, 0)}
          {translateText(" 台车")}
        </span>
      </div>
      <div className="dd-filters">
        <span>
          <SlidersHorizontal size={14} />
          {translateText("订单状态")}
        </span>
        <div className="dd-segment">
          {(
            [
              ["all", "全部"],
              ["new", "新增"],
              ["waiting", "待拼车"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => changeFilter(value)}
            >
              {translateText(label)}
            </button>
          ))}
        </div>
        <label>
          <MapPin size={14} />
          <select
            aria-label={translateText("需求门店")}
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setHoverModel(null);
            }}
          >
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {translateText(s.name)} · {quantity(s.id)}
                {translateText(" 台")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="dd-demand-grid">
        <div className="dd-map-panel">
          <div className="dd-map-kicker">
            <span>SAUDI ARABIA</span>
            <small>{translateText("门店订单需求 · 台")}</small>
          </div>
          <svg
            viewBox="70 35 650 450"
            className="dd-map"
            data-testid="dispatch-map"
            aria-label={translateText("沙特门店需求地图")}
          >
            <defs>
              <pattern
                id="dd-map-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M40 0H0V40"
                  fill="none"
                  stroke="#e7ece7"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect
              x="70"
              y="35"
              width="650"
              height="450"
              fill="url(#dd-map-grid)"
            />
            {arabianCountries.map((country) => (
              <path
                key={country.id}
                d={country.path}
                fill={country.id === "SAU" ? "#edf1e9" : "#f6f7f2"}
                stroke="#d6dfd1"
                strokeWidth="1.1"
              />
            ))}
            <text
              x="375"
              y="306"
              className="dd-map-country"
              textAnchor="middle"
            >
              {translateText("沙 特 阿 拉 伯")}
            </text>
            <text
              x="125"
              y="295"
              className="dd-map-sea"
              transform="rotate(45 125 295)"
            >
              {translateText("红 海")}
            </text>
            {points.map((point) => {
              const s = data.stores.find((s) => s.id === point.id)!;
              const qty = quantity(s.id),
                radius = 21 * Math.sqrt(qty / max);
              const active = s.id === storeId;
              return (
                <g
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  aria-label={translateText(`${s.name}，${qty} 台需求`)}
                  aria-pressed={active}
                  data-dispatch-store={s.id}
                  className={`dd-map-store ${active ? "selected" : ""}`}
                  onClick={() => {
                    setStoreId(s.id);
                    setHoverModel(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStoreId(s.id);
                      setHoverModel(null);
                    }
                  }}
                  onMouseEnter={() => setHoverStore(s.id)}
                  onMouseLeave={() => setHoverStore(null)}
                  onFocus={() => setHoverStore(s.id)}
                  onBlur={() => setHoverStore(null)}
                >
                  <title>
                    {translateText(s.name)} · {qty}
                    {translateText(" 台 /")}
                    {translateText(" ")}
                    {orders.filter((o) => o.storeId === s.id).length}
                    {translateText(" 笔订单")}
                  </title>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(23, radius + 5)}
                    fill="transparent"
                  />
                  {active && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius + 5}
                      fill="none"
                      stroke="#54715b"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={qty ? radius : 3}
                    fill={active ? "#43644d" : "#769977"}
                    fillOpacity={active ? 0.95 : 0.67}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {qty > 0 && (
                    <text
                      x={point.x}
                      y={point.y + 4}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize="11"
                      fontWeight="650"
                      pointerEvents="none"
                    >
                      {qty}
                    </text>
                  )}
                </g>
              );
            })}
            {["利雅得", "吉达", "达曼", "塔布克", "艾卜哈"].map((city) => {
              const s = data.stores.find((s) => s.city === city)!;
              const [x, y] = projectArabianPoint(
                s.coordinates[0],
                s.coordinates[1],
              );
              return (
                <text
                  key={city}
                  x={x}
                  y={y - 30}
                  className="dd-map-city"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {translateText(city)}
                </text>
              );
            })}
          </svg>
          {translateText(
            hoverStore && (
              <div className="dd-map-tooltip">
                <strong>
                  {translateText(
                    data.stores.find((s) => s.id === hoverStore)!.name,
                  )}
                </strong>
                <span>
                  {quantity(hoverStore)}
                  {translateText(" 台需求 ·")}
                  {translateText(" ")}
                  {orders.filter((o) => o.storeId === hoverStore).length}
                  {translateText(" 笔订单")}
                </span>
              </div>
            ),
          )}
          <div className="dd-map-legend">
            <span>
              <i />
              <i />
              <i />
              {translateText("圆圈面积代表需求台数")}
            </span>
            <small>{translateText("点击圆圈查看门店")}</small>
          </div>
        </div>
        <div className="dd-model-panel">
          <header>
            <small>
              {translateText(store.region)} · {translateText(store.city)}
            </small>
            <h3>
              <MapPin size={16} />
              {translateText(store.name)}
            </h3>
            <span data-testid="dispatch-store-total">
              {selected.reduce((n, o) => n + o.quantity, 0)}
              {translateText(" 台 /")}
              {translateText(" ")}
              {selected.length}
              {translateText(" 笔订单")}
            </span>
          </header>
          <div className="dd-bar-heading">
            <strong>{translateText("车型需求")}</strong>
            <span>{translateText("单位：台")}</span>
          </div>
          <div className="dd-bar-chart">
            <div className="dd-chart-grid">
              <span>{maxBar}</span>
              <span>{Math.round(maxBar / 2)}</span>
              <span>0</span>
            </div>
            <div className="dd-model-columns">
              {models.map((m) => (
                <button
                  type="button"
                  key={m.model}
                  data-testid="dispatch-model-bar"
                  aria-label={translateText(
                    `${m.model}，${m.quantity} 台，查看配置需求`,
                  )}
                  className="dd-model-column"
                  onMouseEnter={() => setHoverModel(m.model)}
                  onMouseLeave={() => setHoverModel(null)}
                  onFocus={() => setHoverModel(m.model)}
                  onBlur={() => setHoverModel(null)}
                >
                  <span className="dd-bar-slot">
                    <i style={{ height: `${(m.quantity / maxBar) * 100}%` }}>
                      <strong>{m.quantity}</strong>
                    </i>
                  </span>
                  <span className="dd-model-name">
                    {translateText(m.model)}
                  </span>
                </button>
              ))}
            </div>
            {!models.length && (
              <p className="dd-empty">{translateText("该门店暂无此类订单")}</p>
            )}
            {translateText(
              hoverModel && (
                <div className="dd-config-tooltip" role="tooltip">
                  <strong>
                    {translateText(hoverModel)}
                    {translateText(" · 配置需求")}
                  </strong>
                  {configs.map((c) => (
                    <div key={c.config}>
                      <span>{translateText(c.config)}</span>
                      <b>
                        {c.quantity}
                        {translateText(" 台")}
                      </b>
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
          <p className="dd-chart-hint">
            {translateText("悬停或聚焦柱状图，查看配置与颜色需求。")}
          </p>
          <div className="dd-store-gap">
            <span>{translateText("区域缺货")}</span>
            <strong>
              {
                data.shortages.filter((s) => {
                  const v = data.vehicles.find((v) => v.id === s.vehicleId)!;
                  return selected.some((o) => o.id === v.orderId);
                }).length
              }
              {translateText(" ")}
              {translateText("台")}
            </strong>
            <small>{translateText("在下方逐车比较补齐方案")}</small>
          </div>
        </div>
      </div>
      <p className="dd-section-note">
        {translateText(
          "筛选联动需求地图与车型分布，下方调度建议保留今日全部有效订单。门店按城市中心展开；底图",
        )}
        {translateText(" ")}
        <a
          href="https://www.naturalearthdata.com/"
          target="_blank"
          rel="noreferrer"
        >
          Natural Earth
        </a>
        {translateText("，城市")}
        {translateText(" ")}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>
        。
      </p>
    </section>
  );
}
