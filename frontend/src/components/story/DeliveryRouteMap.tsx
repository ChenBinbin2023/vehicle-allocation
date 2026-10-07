"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useState } from "react";
import geography from "@/lib/query-map-data.json";
import { deliveryNetwork } from "@/lib/story/delivery-network";
import type {
  StoreAllocation,
  StoreDelivery,
} from "@/lib/story/store-planning";
const cities: Record<string, { coordinates: number[] }> = geography.cities;
const project = ([lon, lat]: number[]) => ({
  x: 32 + (lon - 33.5) * 30,
  y: 22 + (33 - lat) * 29,
});
const countries = geography.countries.map((c) => ({
  ...c,
  path:
    c.coordinates
      .map((p, i) => {
        const v = project(p);
        return `${i ? "L" : "M"}${v.x},${v.y}`;
      })
      .join(" ") + " Z",
}));
const origins: Record<string, string> = { "P-W": "吉达", "P-E": "达曼" };
const vpcs: Record<string, string> = {
  JED: "吉达",
  RUH: "利雅得",
  DMM: "达曼",
};
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
export default function DeliveryRouteMap({
  allocation,
  delivery,
}: {
  allocation: StoreAllocation;
  delivery: StoreDelivery;
}) {
  const { t: translateText } = useI18n();

  const routes = deliveryNetwork(allocation, delivery, delivery.input.mode);
  const [selected, setSelected] = useState(
    routes.find((r) => r.unrouted > 0)?.id ?? routes[0]?.id ?? "",
  );
  const [layer, setLayer] = useState<"routes" | "batches">("routes");
  const [store, setStore] = useState("all");
  const [batchId, setBatchId] = useState("");
  const route = routes.find((r) => r.id === selected) ?? routes[0];
  if (!route)
    return <p>{translateText("当前快照没有 data 城市路线，无法绘制地图。")}</p>;
  const batches = route.batches.filter(
    (b) => store === "all" || b.storeId === store,
  );
  const batch = batches.find((b) => b.id === batchId) ?? batches[0];
  const destination = project(cities[route.city].coordinates);
  const source = project(cities[origins[route.originId]].coordinates);
  const via = batch?.viaVpc
    ? project(cities[vpcs[batch.viaVpc]].coordinates)
    : null;
  function select(id: string) {
    setSelected(id);
    setStore("all");
    setBatchId("");
  }
  return (
    <section className="delivery-map-panel" data-testid="delivery-route-map">
      <header className="profit-section-header">
        <div>
          <small>LOGISTICS NETWORK</small>
          <h2>{translateText("城市路线与到店批次")}</h2>
          <p>
            {translateText(
              delivery.input.mode === "single" ? "吉达单港" : "吉达 + 达曼双港",
            )}
            {translateText(" ")}· {routes.length}
            {translateText(" 条共享城市路线 · 运力为源数据周额度")}
          </p>
        </div>
        <div className="map-layer-toggle">
          <button
            type="button"
            aria-pressed={layer === "routes"}
            onClick={() => setLayer("routes")}
          >
            {translateText("路线总览")}
          </button>
          <button
            type="button"
            aria-pressed={layer === "batches"}
            onClick={() => setLayer("batches")}
          >
            {translateText("计划批次")}
          </button>
        </div>
      </header>
      {!delivery[delivery.input.mode].network && (
        <p className="planning-footnote">
          {translateText(
            "旧画布的城市路线基础信息来自当前 data；分车数量、到店批次和干线摊分费来自原快照。",
          )}
        </p>
      )}
      <div className="delivery-map-controls">
        <label>
          {translateText("选择城市路线")}
          <select
            aria-label={translateText("地图路线")}
            value={route.id}
            onChange={(e) => select(e.target.value)}
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {translateText(origins[r.originId])} → {translateText(r.city)} ·{" "}
                {translateText(fmt(r.total))}
                {translateText(" 台")}
                {translateText(r.unrouted ? " / 缺 " + r.unrouted : "")}
              </option>
            ))}
          </select>
        </label>
        {layer === "batches" && (
          <label>
            {translateText("筛选门店")}
            <select
              aria-label={translateText("地图门店")}
              value={store}
              onChange={(e) => {
                setStore(e.target.value);
                setBatchId("");
              }}
            >
              <option value="all">{translateText("路线内全部门店")}</option>
              {route.rows.map((r) => (
                <option key={r.storeId} value={r.storeId}>
                  {translateText(r.storeName)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="delivery-map-layout">
        <div className="delivery-map-art">
          <svg
            viewBox="0 0 760 550"
            aria-label={translateText("沙特城市物流路线地图")}
            role="group"
          >
            <rect width="760" height="550" fill="#eef4f5" />
            {countries.map((c) => (
              <path
                key={c.name}
                d={c.path}
                fill={c.name === "Saudi Arabia" ? "#f9f8f1" : "#e0e8e7"}
                stroke="#c2d0cb"
                strokeWidth="1"
              />
            ))}
            <text x="255" y="220" className="map-country-label">
              {translateText("沙特阿拉伯")}
            </text>
            <text x="35" y="330" className="map-sea-label">
              {translateText("红海")}
            </text>
            <text x="650" y="115" className="map-sea-label">
              {translateText("波斯湾")}
            </text>
            {[...routes.filter((r) => r.id !== route.id), route].map((r) => {
              const a = project(cities[origins[r.originId]].coordinates),
                b = project(cities[r.city].coordinates);
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={translateText(
                    `路线 ${origins[r.originId]}到${r.city}`,
                  )}
                  onClick={() => select(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(r.id);
                    }
                  }}
                  className="map-route-hit"
                >
                  <title>
                    {translateText(origins[r.originId])} →{" "}
                    {translateText(r.city)}
                    {translateText("：已路由 ")}
                    {r.routed}
                    {translateText(" ")}
                    {translateText("台，未落实 ")}
                    {r.unrouted}
                    {translateText(" 台")}
                  </title>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth="18"
                  />
                  {a.x === b.x && a.y === b.y ? (
                    <ellipse
                      cx={a.x}
                      cy={a.y}
                      rx="13"
                      ry="9"
                      fill="none"
                      stroke={r.id === route.id ? "#0e7666" : "#97b3aa"}
                      strokeWidth="3"
                    />
                  ) : (
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={
                        r.id === route.id
                          ? "#0e7666"
                          : r.originId === "P-E"
                            ? "#879dbe"
                            : "#92b6a8"
                      }
                      strokeWidth={
                        r.id === route.id
                          ? 5
                          : Math.max(1, Math.min(3, r.routed / 90))
                      }
                      opacity={r.id === route.id ? 1 : 0.45}
                      strokeDasharray={r.unrouted ? "7 4" : undefined}
                    />
                  )}
                </g>
              );
            })}
            {layer === "batches" && via && (
              <polyline
                points={`${source.x},${source.y} ${via.x},${via.y} ${destination.x},${destination.y}`}
                fill="none"
                stroke="#b87947"
                strokeWidth="4"
                strokeDasharray="5 5"
              />
            )}
            {routes.map((r) => {
              const p = project(cities[r.city].coordinates);
              const active = r.id === route.id;
              return (
                <g key={"city" + r.id} pointerEvents="none">
                  <ellipse
                    cx={p.x}
                    cy={p.y}
                    rx={active ? 7 : 4}
                    ry={active ? 6 : 4}
                    fill={active ? "#0e7666" : "#667f79"}
                    stroke="#fff"
                  />
                  <text
                    x={p.x + 9}
                    y={
                      p.y +
                      (r.city === "胡拜尔"
                        ? 23
                        : r.city === "朱拜勒"
                          ? -12
                          : -7)
                    }
                    className={
                      active ? "map-city-label selected" : "map-city-label"
                    }
                  >
                    {translateText(r.city)}
                  </text>
                </g>
              );
            })}
            {["P-W", ...(delivery.input.mode === "dual" ? ["P-E"] : [])].map(
              (id) => {
                const p = project(cities[origins[id]].coordinates);
                return (
                  <g key={id}>
                    <rect
                      x={p.x - 7}
                      y={p.y - 7}
                      width="14"
                      height="14"
                      rx="3"
                      fill="#243e3a"
                      stroke="white"
                    />
                    <text
                      x={p.x - 10}
                      y={p.y + 23}
                      textAnchor="end"
                      className="map-origin-label"
                    >
                      {translateText(origins[id])}
                      {translateText("港")}
                    </text>
                  </g>
                );
              },
            )}
          </svg>
          <div className="delivery-map-legend">
            <span>
              <i />
              {translateText("城市干线路线")}
            </span>
            <span>
              <i className="via" />
              {translateText("VPC 示意连接")}
            </span>
            <span>{translateText("虚线干线：含未落实数量")}</span>
          </div>
          <p>
            {translateText(
              "城市坐标示意，非实际道路；门店归属到目的城市。地理数据：",
            )}
            <a
              href={geography.attribution.boundaries}
              target="_blank"
              rel="noreferrer"
            >
              Natural Earth
            </a>
            {translateText(" ")}/{translateText(" ")}
            <a
              href={geography.attribution.places}
              target="_blank"
              rel="noreferrer"
            >
              GeoNames
            </a>
            （CC BY 4.0）
          </p>
        </div>
        <aside
          className="delivery-map-inspector"
          data-testid="delivery-map-inspector"
        >
          <small>{translateText(route.id)}</small>
          <h3>
            {translateText(origins[route.originId])} →{" "}
            {translateText(route.city)}
          </h3>
          <dl>
            <dt>{translateText("门店计划 / 已路由")}</dt>
            <dd>
              {translateText(fmt(route.total))} /{" "}
              {translateText(fmt(route.routed))}
              {translateText(" 台")}
            </dd>
            <dt>{translateText("直送 / 经 VPC")}</dt>
            <dd>
              {translateText(fmt(route.direct))} /{" "}
              {translateText(fmt(route.via))}
              {translateText(" 台")}
            </dd>
            <dt>{translateText("未落实 / 待排时段")}</dt>
            <dd>
              {translateText(fmt(route.unrouted))} /{" "}
              {translateText(fmt(route.pending))}
              {translateText(" 台")}
            </dd>
            <dt>{translateText("共享周运力")}</dt>
            <dd>
              {translateText(fmt(route.capacity))}
              {translateText(" 台")}
            </dd>
            <dt>{translateText("运输距离 / 时长")}</dt>
            <dd>
              {translateText(fmt(route.km ?? 0))} km / {route.hours} h
            </dd>
            <dt>{translateText("整趟报价 / 装载")}</dt>
            <dd>
              {translateText(fmt(route.quote))} SAR / {route.load}
              {translateText(" 台")}
            </dd>
            <dt>{translateText("本轮干线运费")}</dt>
            <dd>{translateText(fmt(route.linehaul))} SAR</dd>
          </dl>
          <p>
            {translateText(
              "按路线已路由量向上取整计车次，再按车辆分摊。此费用为城市干线报价，VPC/整备/末端另计。",
            )}
          </p>
          {layer === "routes" ? (
            <button type="button" onClick={() => setLayer("batches")}>
              {translateText("查看此路线的 ")}
              {route.batches.length}
              {translateText(" 个计划批次 →")}
            </button>
          ) : (
            batch && (
              <div className="map-selected-batch">
                <small>
                  {translateText("选中计划批次 · ")}
                  {translateText(batch.id)}
                </small>
                <strong>{translateText(batch.storeName)}</strong>
                <p>
                  {batch.qty}
                  {translateText(" 台 ·")}
                  {translateText(" ")}
                  {translateText(
                    batch.viaVpc ? "经 " + batch.viaVpc + " VPC" : "首批直送",
                  )}{" "}
                  ·{translateText(" ")}
                  {translateText(
                    batch.arrivalDay === null
                      ? "到店时段待确认"
                      : "D+" + batch.arrivalDay + " 到店",
                  )}
                </p>
                <p>
                  {translateText("分摊干线费 ")}
                  {translateText(fmt(batch.cost))}
                  {translateText(" SAR；无真实承运班次号。")}
                </p>
              </div>
            )
          )}
        </aside>
      </div>
      {layer === "batches" && (
        <div className="planning-table-scroll">
          <table data-testid="map-batch-table">
            <thead>
              <tr>
                <th>{translateText("计划批次")}</th>
                <th>{translateText("门店")}</th>
                <th>{translateText("去向")}</th>
                <th>{translateText("数量")}</th>
                <th>{translateText("到店日")}</th>
                <th>{translateText("干线摊分费")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className={b.id === batch?.id ? "selected" : ""}>
                  <td>
                    <button type="button" onClick={() => setBatchId(b.id)}>
                      {translateText(b.id)}
                    </button>
                  </td>
                  <td>{translateText(b.storeName)}</td>
                  <td>
                    {translateText(
                      b.viaVpc ? b.viaVpc + " VPC → 店" : "港口 → 店",
                    )}
                  </td>
                  <td>{b.qty}</td>
                  <td>
                    {translateText(
                      b.arrivalDay === null ? "待确认" : "D+" + b.arrivalDay,
                    )}
                  </td>
                  <td>{translateText(fmt(b.cost))} SAR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
