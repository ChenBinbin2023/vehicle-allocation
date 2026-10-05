"use client";

import { useId, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  Layers3,
  MapPin,
  Route,
  TriangleAlert,
} from "lucide-react";
import {
  arabianCountries,
  projectArabianPoint,
} from "@/lib/story/arabian-base-map";
import type { DeliveryPlan, RouteId } from "@/lib/story/types";

const locations = {
  jeddah: { name: "吉达港 / VPC", code: "JEDDAH", lon: 39.19, lat: 21.485 },
  riyadh: { name: "利雅得 VPC", code: "RIYADH", lon: 46.675, lat: 24.714 },
  dammam: { name: "达曼 VPC", code: "DAMMAM", lon: 50.1, lat: 26.42 },
  east: { name: "东部交付区域", code: "EASTERN REGION", lon: 49.25, lat: 25.2 },
  transition: {
    name: "中东部过渡带",
    code: "REGIONAL DELIVERY",
    lon: 46.9,
    lat: 26.45,
  },
  west: { name: "西部交付区域", code: "WESTERN REGION", lon: 40.35, lat: 23.4 },
} as const;
type LocationId = keyof typeof locations;
const routes: Array<{
  id: RouteId;
  label: string;
  points: LocationId[];
  color: string;
  why: string;
}> = [
  {
    id: "west",
    label: "西部短链",
    points: ["jeddah", "west"],
    color: "#58a693",
    why: "同区域短链交付。优先利用吉达本地班次，不进入跨区干线。",
  },
  {
    id: "riyadh",
    label: "利雅得中轴",
    points: ["jeddah", "riyadh"],
    color: "#327a68",
    why: "规模化入库与全国响应库存留在中轴，减少后续跨区调拨距离。",
  },
  {
    id: "eastDirect",
    label: "东部订单直达",
    points: ["jeddah", "east"],
    color: "#558ac0",
    why: "最终地址已知，直接穿透到东部交付区域，避免达曼 VPC 二次装卸。",
  },
  {
    id: "riyadhIntercept",
    label: "利雅得截流",
    points: ["jeddah", "riyadh", "transition"],
    color: "#927eb0",
    why: "在利雅得接区域短驳，不先运到达曼再向西折返。",
  },
  {
    id: "dammamSafety",
    label: "达曼安全库存",
    points: ["jeddah", "dammam"],
    color: "#c39a58",
    why: "仅补齐东部自由安全量，不让所有东部订单都经旧母库中转。",
  },
];
function connection(points: LocationId[], offset = 0) {
  return points
    .slice(1)
    .map((point, index) => {
      const from = locations[points[index]],
        to = locations[point];
      const [sx, sy] = projectArabianPoint(from.lon, from.lat),
        [tx, ty] = projectArabianPoint(to.lon, to.lat);
      return `M${sx},${sy} Q${(sx + tx) / 2},${Math.min(sy, ty) - 40 - offset} ${tx},${ty}`;
    })
    .join(" ");
}

export default function LogisticsMap({
  plan,
  affectedQuantity,
}: {
  plan: DeliveryPlan;
  affectedQuantity: number;
}) {
  const id = useId().replace(/:/g, "");
  const [selected, setSelected] = useState<RouteId>("eastDirect");
  const [showRejected, setShowRejected] = useState(false);
  const active = routes.find((route) => route.id === selected)!;
  const assignments = plan.assignments.filter(
    (item) => item.route === selected,
  );
  const batches = plan.batches.filter((batch) => batch.route === selected);
  const quantity = assignments.length;
  const totalCost = batches.reduce((sum, batch) => sum + batch.cost, 0);
  const arrival = Math.max(0, ...assignments.map((item) => item.arrivalDay));
  const handling = Math.max(
    0,
    ...assignments.map((item) => item.handlingCount),
  );
  const activeLocations = new Set(active.points);
  return (
    <section className="logistics-map-board" data-testid="logistics-map">
      <header className="visual-board-heading">
        <div>
          <span className="visual-eyebrow">
            <Compass size={12} /> SINGLE-PORT NETWORK
          </span>
          <h3>从一个入口，重新组织全国配送</h3>
          <p>吉达是唯一入境港；按最终需求选择路径，不再套用旧母库归属。</p>
        </div>
        <button
          type="button"
          className={`map-layer-button ${showRejected ? "active" : ""}`}
          aria-pressed={showRejected}
          aria-label="显示淘汰路径"
          onClick={() => setShowRejected((value) => !value)}
        >
          <Layers3 size={14} />
          {showRejected ? "隐藏旧路径" : "对比旧路径"}
        </button>
      </header>
      <div className="logistics-map-surface">
        <svg
          viewBox="0 0 840 500"
          className="logistics-geography"
          aria-label="沙特单港物流地理示意图"
        >
          <defs>
            <linearGradient id={`${id}-land`} x1="0" x2=".9" y1="0" y2="1">
              <stop stopColor="#f7f6ef" />
              <stop offset="1" stopColor="#e8edde" />
            </linearGradient>
            <pattern
              id={`${id}-ocean`}
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 0 H36 V36"
                fill="none"
                stroke="#dfeae7"
                strokeWidth=".6"
              />
            </pattern>
            {routes.map((route) => (
              <marker
                key={route.id}
                id={`${id}-${route.id}`}
                viewBox="0 0 10 10"
                refX="8.5"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10 Z" fill={route.color} />
              </marker>
            ))}
            <marker
              id={`${id}-reject`}
              viewBox="0 0 10 10"
              refX="8.5"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 Z" fill="#bc9981" />
            </marker>
          </defs>
          <rect width="840" height="500" fill="#edf5f2" />
          <rect width="840" height="500" fill={`url(#${id}-ocean)`} />
          {arabianCountries.map((country) => (
            <path
              key={country.id}
              d={country.path}
              className={
                country.id === "SAU" ? "map-saudi-land" : "map-neighbor-land"
              }
              fill={country.id === "SAU" ? `url(#${id}-land)` : "#f4f5ef"}
              stroke={country.id === "SAU" ? "#c6d0bc" : "#dfe3d8"}
              strokeWidth={country.id === "SAU" ? 1.6 : 1}
            />
          ))}
          <text x="333" y="379" className="map-country-label">
            SAUDI ARABIA
          </text>
          <text x="367" y="403" className="map-country-local">
            沙特阿拉伯
          </text>
          <text
            x="59"
            y="260"
            className="map-sea-label"
            transform="rotate(50 59 260)"
          >
            RED SEA
          </text>
          <text
            x="588"
            y="171"
            className="map-sea-label"
            transform="rotate(35 588 171)"
          >
            ARABIAN GULF
          </text>
          <text x="233" y="40" className="map-neighbor-label">
            JORDAN
          </text>
          <text x="398" y="68" className="map-neighbor-label">
            IRAQ
          </text>
          <text x="655" y="100" className="map-neighbor-label">
            IRAN
          </text>
          <text x="330" y="483" className="map-neighbor-label">
            YEMEN
          </text>
          <text x="753" y="382" className="map-neighbor-label">
            OMAN
          </text>
          {showRejected && (
            <g data-route-status="rejected" className="map-rejected-route">
              <path
                d={connection(["jeddah", "dammam", "east"], 90)}
                fill="none"
                stroke="#bc9981"
                strokeWidth="2.3"
                strokeDasharray="7 6"
                markerEnd={`url(#${id}-reject)`}
              />
              <rect
                x="260"
                y="94"
                width="220"
                height="35"
                rx="8"
                fill="#fff7ef"
                stroke="#ddc5ae"
              />
              <text x="276" y="116">
                东部旧母库路径 · D+4 超承诺
              </text>
            </g>
          )}
          {routes.map((route, index) => (
            <g
              key={route.id}
              className={`map-route ${selected === route.id ? "selected" : "muted"}`}
              role="button"
              tabIndex={0}
              aria-label={`地图路线 ${route.label}`}
              aria-pressed={selected === route.id}
              onClick={() => setSelected(route.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(route.id);
                }
              }}
            >
              <path
                className="map-route-halo"
                d={connection(route.points, index * 13)}
                fill="none"
                stroke="#fff"
                strokeWidth={selected === route.id ? 8 : 4}
              />
              <path
                d={connection(route.points, index * 13)}
                fill="none"
                stroke={route.color}
                strokeWidth={selected === route.id ? 3.5 : 1.7}
                markerEnd={`url(#${id}-${route.id})`}
              />
              <path
                className="map-route-hit"
                d={connection(route.points, index * 13)}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
              />
            </g>
          ))}
          {(
            Object.entries(locations) as Array<
              [LocationId, (typeof locations)[LocationId]]
            >
          ).map(([key, location]) => {
            const [x, y] = projectArabianPoint(location.lon, location.lat);
            const isVpc = ["jeddah", "riyadh", "dammam"].includes(key);
            const labelPositions: Record<LocationId, [number, number]> = {
              jeddah: [-113, 17],
              riyadh: [-100, 42],
              dammam: [20, -14],
              east: [30, 18],
              transition: [-115, -48],
              west: [-94, -20],
            };
            const [lx, ly] = labelPositions[key];
            return (
              <g
                key={key}
                transform={`translate(${x},${y})`}
                className={`map-location ${activeLocations.has(key) ? "active" : ""}`}
              >
                <circle
                  className="map-city-ring"
                  r={key === "jeddah" ? 15 : 10}
                />
                <circle
                  r={key === "jeddah" ? 6 : 4.5}
                  fill={
                    key === "jeddah" ? "#246e56" : isVpc ? "#657864" : "#719cb2"
                  }
                  stroke="white"
                  strokeWidth="2"
                />
                <g transform={`translate(${lx},${ly})`}>
                  <text className="map-location-name">{location.name}</text>
                  <text className="map-location-code" y="16">
                    {location.code}
                  </text>
                </g>
              </g>
            );
          })}
          <g className="map-north" transform="translate(790 39)">
            <text x="0" y="-11" textAnchor="middle">
              N
            </text>
            <path d="M0 0 L-5 17 L0 12 L5 17 Z" fill="#78998b" />
          </g>
          <g transform="translate(27 446)">
            <rect
              width="201"
              height="31"
              rx="7"
              fill="white"
              fillOpacity=".92"
              stroke="#dae6df"
            />
            <circle cx="15" cy="15" r="4" fill="#248168" />
            <text x="27" y="19" className="map-entry-label">
              唯一入境节点 · JEDDAH PORT
            </text>
          </g>
        </svg>
        {affectedQuantity > 0 && (
          <div className="map-capacity-alert" data-testid="map-capacity-alert">
            <TriangleAlert size={14} />
            <span>{affectedQuantity} 台库存待运力调整</span>
            <small>订单优先保护</small>
          </div>
        )}
      </div>
      <nav className="map-route-selector" aria-label="物流路线选择">
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            className={selected === route.id ? "active" : ""}
            aria-pressed={selected === route.id}
            aria-label={`查看 ${route.label}`}
            onClick={() => setSelected(route.id)}
            style={{ "--route-color": route.color } as CSSProperties}
          >
            <i />
            <span>{route.label}</span>
            <strong>
              {
                plan.assignments.filter((item) => item.route === route.id)
                  .length
              }
              <small>台</small>
            </strong>
          </button>
        ))}
      </nav>
      <div className="map-route-detail" data-testid="map-route-detail">
        <div className="map-route-explanation">
          <span className="visual-eyebrow">
            <Route size={12} /> ROUTE DECISION
          </span>
          <h4>
            {active.label}
            <ArrowRight size={14} />
            <span>{quantity} 台</span>
          </h4>
          <p>{active.why}</p>
        </div>
        <div className="map-route-metrics">
          <div>
            <small>每板运价</small>
            <strong>
              {(batches[0]?.cost ?? 0).toLocaleString()}
              <em>SAR</em>
            </strong>
          </div>
          <div>
            <small>计划到达 / 装卸</small>
            <strong>
              D+{arrival}
              <em> / {handling} 次</em>
            </strong>
          </div>
          <div>
            <small>{batches.length} 板 · 路线预算</small>
            <strong>
              {totalCost.toLocaleString()}
              <em>SAR</em>
            </strong>
          </div>
        </div>
      </div>
      <footer className="map-attribution">
        <span>
          <MapPin size={11} />
          底图：
          <a
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
          </a>{" "}
          · 地理轮廓 / 非导航路径
        </span>
        <span>
          <Check size={11} />
          数量与预算来自本轮运输计划
        </span>
      </footer>
    </section>
  );
}
