"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useState } from "react";
import { ArrowRight, MapPin, Truck } from "lucide-react";
import geography from "@/lib/query-map-data.json";
import { queryMetadata, type QueryResult } from "@/lib/story/query-engine";

type Route = QueryResult["transport"]["dual"]["routes"][number];
const cities: Record<string, { coordinates: number[] }> = geography.cities;
const origins: Record<string, { city: string; label: string; color: string }> =
  {
    "P-W": { city: "吉达", label: "吉达", color: "#12836f" },
    "P-E": { city: "达曼", label: "达曼", color: "#597eb5" },
  };
const offsets: Record<string, [number, number]> = {
  利雅得: [13, 21],
  吉达: [-16, 30],
  达曼: [30, -7],
  胡拜尔: [49, 26],
  朱拜勒: [33, -21],
  哈萨: [35, 21],
  布赖代: [-14, -22],
  欧奈宰: [19, 25],
  哈伊勒: [-13, -19],
  塔布克: [-13, -19],
  麦地那: [-18, -12],
  延布: [-13, 23],
  麦加: [36, -13],
  塔伊夫: [36, 21],
  艾卜哈: [-12, -13],
  海米斯穆谢特: [31, -18],
  吉赞: [-12, 22],
  奈季兰: [17, 24],
};
const project = ([longitude, latitude]: number[]) => ({
  x: 32 + (longitude - 33.5) * 30,
  y: 22 + (33 - latitude) * 29,
});
const countries = geography.countries.map((country) => ({
  ...country,
  path:
    country.coordinates
      .map((coordinates, index) => {
        const p = project(coordinates);
        return `${index ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ") + " Z",
}));
const fmt = (value: number, digits = 0) =>
  value.toLocaleString("en-US", { maximumFractionDigits: digits });

function locate(route: Route) {
  const origin = origins[route.originId];
  if (!origin || !cities[route.city]) return null;
  const start = project(cities[origin.city].coordinates);
  const end = project(cities[route.city].coordinates);
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const span = Math.hypot(dx, dy);
  // Lift short intercity routes clear of the hub and destination markers.
  const bend =
    Math.max(span * 0.12, 48 - span) * (span < 40 && dy > 0 ? -1 : 1);
  const local = route.city === origin.city;
  const path = local
    ? `M${start.x},${start.y} C${start.x - 58},${start.y - 45} ${start.x - 58},${start.y + 30} ${start.x},${start.y}`
    : `M${start.x},${start.y} Q${(start.x + end.x) / 2 - (dy / span) * bend},${(start.y + end.y) / 2 + (dx / span) * bend} ${end.x},${end.y}`;
  return { ...route, origin, start, end, path, local };
}

export default function QueryRouteMap({ routes }: { routes: Route[] }) {
  const { t: translateText } = useI18n();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const located = routes.map(locate).filter((route) => route !== null);
  const selected =
    located.find((route) => route.id === selectedId) ??
    [...located].sort((a, b) => b.gap - a.gap || b.capacity - a.capacity)[0];
  const hubs = Object.entries(origins).filter(([id]) =>
    located.some((route) => route.originId === id),
  );
  const destinations = [
    ...new Map(located.map((route) => [route.city, route.end])).entries(),
  ];
  const maximum = Math.max(1, ...located.map((route) => route.capacity));
  const ordered = [...located].sort(
    (a, b) => Number(a.id === selected?.id) - Number(b.id === selected?.id),
  );
  return (
    <div className="query-route-map" data-testid="query-route-map">
      <div className="query-map-legend">
        {hubs.map(([id, hub]) => (
          <span key={id}>
            <i style={{ backgroundColor: hub.color }} />
            {translateText(hub.label)}
            {translateText("始发")}
          </span>
        ))}
        <span>
          <i className="gap" />
          {translateText("虚线：运力缺口")}
        </span>
        <small>{translateText("线越粗，周运力越大")}</small>
      </div>
      <div className="query-route-map-layout">
        <div className="query-route-map-stage">
          <svg
            viewBox="0 0 760 550"
            role="group"
            aria-label={translateText("沙特陆路运输路线地图")}
          >
            <rect width="760" height="550" className="query-map-sea" />
            {countries.map((country) => (
              <path
                key={country.name}
                d={country.path}
                className={
                  country.name === "Saudi Arabia"
                    ? "query-map-country saudi"
                    : "query-map-country"
                }
                aria-hidden="true"
              />
            ))}
            <g className="query-map-grid" aria-hidden="true">
              {[36, 40, 44, 48, 52].map((longitude) => (
                <line
                  key={longitude}
                  x1={project([longitude, 33]).x}
                  x2={project([longitude, 15]).x}
                  y1="0"
                  y2="550"
                />
              ))}
              {[18, 22, 26, 30].map((latitude) => (
                <line
                  key={latitude}
                  x1="0"
                  x2="760"
                  y1={project([33.5, latitude]).y}
                  y2={project([56, latitude]).y}
                />
              ))}
            </g>
            <g className="query-map-geography-labels" aria-hidden="true">
              <text x="480" y="385" className="query-map-country-title">
                {translateText("沙特阿拉伯")}
              </text>
              <text x="480" y="405">
                SAUDI ARABIA
              </text>
              <text x="340" y="67">
                {translateText("伊拉克")}
              </text>
              <text x="105" y="62">
                {translateText("约旦")}
              </text>
              <text x="590" y="142">
                {translateText("科威特")}
              </text>
              <text x="666" y="285">
                {translateText("阿联酋")}
              </text>
              <text x="692" y="398">
                {translateText("阿曼")}
              </text>
              <text x="344" y="531">
                {translateText("也门")}
              </text>
              <text
                x="77"
                y="348"
                transform="rotate(-58 77 348)"
                className="query-map-water-label"
              >
                {translateText("红 海")}
              </text>
              <text x="625" y="189" className="query-map-water-label">
                {translateText("波斯湾")}
              </text>
              <path d="M710 83V47m-6 9 6-9 6 9" />
              <text x="710" y="38">
                N
              </text>
            </g>
            {ordered.map((route) => (
              <g
                key={route.id}
                data-route-id={route.id}
                role="button"
                tabIndex={0}
                aria-label={translateText(
                  `路线 ${route.id}：${route.origin.label} → ${route.city}`,
                )}
                aria-pressed={selected?.id === route.id}
                className={`query-map-route ${selected?.id === route.id ? "selected" : ""}`}
                onClick={() => setSelectedId(route.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(route.id);
                  }
                }}
              >
                <title>
                  {translateText(route.origin.label)} →{" "}
                  {translateText(route.city)} · {translateText(fmt(route.km))}{" "}
                  km ·{translateText(" ")}
                  {translateText(fmt(route.cost))}
                  {translateText(" SAR · 周运力 ")}
                  {translateText(fmt(route.capacity))}
                  {translateText(" 台")}
                  {translateText(
                    route.gap ? ` · 缺口 ${fmt(route.gap)} 台` : "",
                  )}
                </title>
                <path
                  d={route.path}
                  className="query-map-route-halo"
                  fill="none"
                  stroke={route.origin.color}
                  strokeWidth="8"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={route.path}
                  className="query-map-route-line"
                  fill="none"
                  stroke={route.origin.color}
                  strokeWidth={1.1 + (route.capacity / maximum) * 2.8}
                  strokeDasharray={route.gap > 0 ? "5 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={route.path}
                  className="query-map-route-hit"
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
            {destinations.map(([city, point]) => {
              if (hubs.some(([, hub]) => hub.city === city)) return null;
              const offset = offsets[city] ?? [12, -12];
              const active = selected?.city === city;
              return (
                <g
                  key={city}
                  className={`query-map-city ${active ? "selected" : ""}`}
                  aria-hidden="true"
                >
                  <circle cx={point.x} cy={point.y} r={active ? 7 : 4} />
                  <line
                    x1={point.x}
                    y1={point.y}
                    x2={point.x + offset[0] * 0.8}
                    y2={point.y + offset[1] * 0.8}
                  />
                  <text
                    x={point.x + offset[0]}
                    y={point.y + offset[1]}
                    textAnchor={offset[0] < 0 ? "end" : "start"}
                  >
                    {translateText(city)}
                  </text>
                </g>
              );
            })}
            {hubs.map(([id, hub]) => {
              const p = project(cities[hub.city].coordinates);
              const offset = offsets[hub.city];
              return (
                <g
                  key={id}
                  data-origin-id={id}
                  className="query-map-hub"
                  aria-hidden="true"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="15"
                    fill={hub.color}
                    opacity="0.12"
                  />
                  <rect
                    x={p.x - 7}
                    y={p.y - 7}
                    width="14"
                    height="14"
                    rx="4"
                    fill={hub.color}
                  />
                  <path
                    d={`M${p.x - 3},${p.y} H${p.x + 3} M${p.x},${p.y - 3} V${p.y + 3}`}
                  />
                  <text
                    x={p.x + offset[0]}
                    y={p.y + offset[1]}
                    textAnchor={offset[0] < 0 ? "end" : "start"}
                    fill={hub.color}
                  >
                    {translateText(hub.label)}
                    {translateText("港 / VPC")}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {selected && (
          <aside
            className="query-map-detail"
            data-testid="query-route-detail"
            aria-live="polite"
          >
            <label>
              {translateText("地图路线")}
              <select
                aria-label={translateText("地图路线")}
                value={selected.id}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {located.map((route) => (
                  <option key={route.id} value={route.id}>
                    {translateText(route.origin.label)} →{" "}
                    {translateText(route.city)}
                  </option>
                ))}
              </select>
            </label>
            <div className="query-map-detail-heading">
              <span>
                <MapPin size={12} />
                {translateText(selected.local ? "同城接驳" : "城市运输路线")}
              </span>
              <h3>
                {translateText(selected.origin.label)}
                <ArrowRight size={15} />
                {translateText(selected.city)}
              </h3>
              <small>{translateText(selected.id)}</small>
            </div>
            <strong className="query-map-quote">
              {translateText(fmt(selected.cost))}
              <small>{translateText("SAR / 整趟")}</small>
            </strong>
            <dl>
              <div>
                <dt>{translateText("陆路距离")}</dt>
                <dd>{translateText(fmt(selected.km))} km</dd>
              </div>
              <div>
                <dt>{translateText("参考时长")}</dt>
                <dd>
                  {translateText(fmt(selected.hours, 1))}
                  {translateText(" 小时")}
                </dd>
              </div>
              <div>
                <dt>{translateText("满载单台费")}</dt>
                <dd>{translateText(fmt(selected.unitCost, 1))} SAR</dd>
              </div>
              <div>
                <dt>{translateText("周可用车次")}</dt>
                <dd>
                  {translateText(fmt(selected.trucks))}
                  {translateText(" 次")}
                </dd>
              </div>
              <div>
                <dt>{translateText("有效周运力")}</dt>
                <dd>
                  {translateText(fmt(selected.capacity))}
                  {translateText(" 台")}
                </dd>
              </div>
              <div>
                <dt>{translateText("参考周需求")}</dt>
                <dd>
                  {translateText(fmt(selected.demand, 1))}
                  {translateText(" 台")}
                </dd>
              </div>
            </dl>
            <div
              className={`query-map-gap ${selected.gap ? "shortage" : ""}`}
              data-testid="query-map-gap"
            >
              <Truck size={14} />
              {translateText(
                selected.gap
                  ? `运力缺口 ${fmt(selected.gap)} 台 / 周`
                  : "当前路线无运力缺口",
              )}
            </div>
          </aside>
        )}
      </div>
      {located.length !== routes.length && (
        <p className="query-map-unlocated">
          {routes.length - located.length}
          {translateText(" ")}
          {translateText("条路线缺少城市定位，可在下方明细中查看。")}
        </p>
      )}
      <footer className="query-map-footer">
        <span>
          {translateText("城市中心连线示意 · 同城接驳以环线表示 · 运力快照")}
          {translateText(" ")}
          {translateText(queryMetadata.capacityWeek)}
        </span>
        <span>
          {translateText("底图")}
          {translateText(" ")}
          <a
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
          </a>
          {translateText(" ")}
          {translateText("· 城市")}
          {translateText(" ")}
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            GeoNames
          </a>
        </span>
      </footer>
    </div>
  );
}
