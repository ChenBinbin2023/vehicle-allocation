"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { Truck } from "lucide-react";
import {
  arabianCountries,
  projectArabianPoint,
} from "@/lib/story/arabian-base-map";
import {
  orderPorts,
  vesselOrders,
  type OrderPortMode,
  type OrderStore,
  type OrderTrip,
  type VesselOrder,
} from "@/lib/story/vessel-orders";
const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const sum = (orders: VesselOrder[]) =>
  orders.reduce((total, order) => total + order.quantity, 0);

// City-centre positions are spread so neighbouring-city stores remain clickable.
const orderCounts = new Map(
  vesselOrders.stores.map((store) => [
    store.id,
    vesselOrders.orders.filter((order) => order.storeId === store.id).length,
  ]),
);
const maxCount = Math.max(1, ...orderCounts.values());
const points = new Map<string, { x: number; y: number; radius: number }>();
for (const store of vesselOrders.stores) {
  const [cx, cy] = projectArabianPoint(
    store.coordinates[0],
    store.coordinates[1],
  );
  const radius = 12 * Math.sqrt((orderCounts.get(store.id) ?? 0) / maxCount);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const angle = attempt * Math.PI * (3 - Math.sqrt(5));
    const offset = 9 * Math.sqrt(attempt);
    const x = cx + Math.cos(angle) * offset,
      y = cy + Math.sin(angle) * offset;
    if (
      [...points.values()].every(
        (p) => Math.hypot(x - p.x, y - p.y) > p.radius + radius + 4,
      )
    ) {
      points.set(store.id, { x, y, radius });
      break;
    }
  }
}

export default function VesselOrderMap({
  stores,
  orders,
  layer,
  storeId,
  trip,
  trips,
  mode,
  onStore,
}: {
  stores: OrderStore[];
  orders: VesselOrder[];
  layer: "orders" | "logistics";
  storeId: string;
  trip?: OrderTrip;
  trips: OrderTrip[];
  mode: OrderPortMode;
  onStore: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  const routePoints = (t: OrderTrip) => {
    const port = orderPorts[t.portId];
    const [x, y] = projectArabianPoint(
      port.coordinates[0],
      port.coordinates[1],
    );
    return [{ x, y }, ...t.stops.map((s) => points.get(s.storeId)!)];
  };
  const stopPoints = trip?.stops.map((stop) => points.get(stop.storeId)!) ?? [];
  const annotationX = stopPoints.length
    ? Math.min(560, Math.max(4, Math.max(...stopPoints.map((p) => p.x)) + 15))
    : 0;
  const annotationTop = stopPoints.length
    ? Math.min(
        542 - stopPoints.length * 54,
        Math.max(8, Math.min(...stopPoints.map((p) => p.y)) - 24),
      )
    : 0;
  return (
    <>
      <svg
        className="voa-map"
        viewBox="0 0 760 550"
        role="group"
        aria-label={translateText(
          layer === "orders"
            ? "沙特门店订单分布地图"
            : "港口到门店的物流路线地图",
        )}
      >
        <defs>
          <pattern
            id="voa-map-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M40 0H0V40"
              fill="none"
              stroke="#dce6df"
              strokeWidth=".6"
            />
          </pattern>
          <marker
            id="voa-map-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10Z" fill="#577c66" />
          </marker>
        </defs>
        <rect width="760" height="550" fill="#f0f5f1" />
        <rect width="760" height="550" fill="url(#voa-map-grid)" />
        {arabianCountries.map((c) => (
          <path
            key={c.id}
            d={c.path}
            fill={c.id === "SAU" ? "#fcfcf8" : "#e6ebe7"}
            stroke="#ccd8cf"
            strokeWidth="1"
          />
        ))}
        <text x="370" y="340" className="voa-country">
          {translateText("沙特阿拉伯")}
        </text>
        <text x="82" y="335" className="voa-sea">
          {translateText("红海")}
        </text>
        <text x="601" y="174" className="voa-sea">
          {translateText("波斯湾")}
        </text>
        {layer === "logistics" &&
          trips
            .filter((t) => t.id !== trip?.id)
            .map((t) => (
              <polyline
                key={t.id}
                points={routePoints(t)
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke={t.portId === "P-W" ? "#8ba997" : "#bba06e"}
                strokeWidth="1.2"
                opacity=".13"
              />
            ))}
        {layer === "orders" &&
          stores.map((store) => {
            const ordersAtStore = orders.filter((o) => o.storeId === store.id);
            const p = points.get(store.id)!;
            const active = storeId === store.id;
            // Circle area, rather than radius, represents the number of order IDs.
            const radius = Math.max(
              2,
              12 * Math.sqrt(ordersAtStore.length / maxCount),
            );
            return (
              <g
                key={store.id}
                role="button"
                tabIndex={0}
                aria-label={translateText(
                  `${store.name}，${ordersAtStore.length} 笔订单，${sum(ordersAtStore)} 台`,
                )}
                aria-pressed={active}
                data-store-bubble={store.id}
                onClick={() => onStore(store.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStore(store.id);
                  }
                }}
                className="voa-bubble"
              >
                <title>
                  {translateText(store.name)} · {ordersAtStore.length}
                  {translateText(" 笔 /")}
                  {translateText(" ")}
                  {sum(ordersAtStore)}
                  {translateText(" 台")}
                </title>
                {active && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius + 5}
                    fill="none"
                    stroke="#355744"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={radius}
                  fill={store.channel === "直营" ? "#577c66" : "#a3bdad"}
                  fillOpacity={active ? 1 : 0.65}
                  stroke="white"
                  strokeWidth="1.6"
                />
                {active && (
                  <text
                    x={p.x}
                    y={p.y + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {ordersAtStore.length}
                  </text>
                )}
              </g>
            );
          })}
        {layer === "logistics" && (
          <>
            {stores.map((store) => {
              const p = points.get(store.id)!;
              return (
                <circle key={store.id} cx={p.x} cy={p.y} r="3" fill="#aebeb3" />
              );
            })}
            {trip && (
              <g data-selected-trip={trip.id}>
                <polyline
                  points={routePoints(trip)
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="#577c66"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  markerMid="url(#voa-map-arrow)"
                  markerEnd="url(#voa-map-arrow)"
                />
                {trip.stops.map((stop, i) => {
                  const p = points.get(stop.storeId)!;
                  const labelX = annotationX;
                  const labelY = annotationTop + i * 54;
                  return (
                    <g key={stop.storeId} data-map-stop={stop.storeId}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="9"
                        fill="#577c66"
                        stroke="#fff"
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y + 3.5}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="10"
                      >
                        {i + 1}
                      </text>
                      <path
                        d={`M${p.x + 7} ${p.y}L${labelX} ${labelY + 24}`}
                        stroke="#a9bfb1"
                        fill="none"
                      />
                      <rect
                        x={labelX}
                        y={labelY}
                        width="190"
                        height="48"
                        rx="6"
                        fill="white"
                        stroke="#dce6df"
                      />
                      <text
                        x={labelX + 8}
                        y={labelY + 18}
                        className="voa-stop-label"
                      >
                        {i + 1} · {translateText(stop.city)} ·
                        {translateText(" ")}
                        {translateText(
                          vesselOrders.stores.find((s) => s.id === stop.storeId)
                            ?.shortName,
                        )}
                      </text>
                      <text
                        x={labelX + 8}
                        y={labelY + 37}
                        className="voa-stop-value"
                      >
                        {translateText("卸 ")}
                        {stop.quantity}
                        {translateText(" 台 · ")}
                        {translateText(fmt(stop.cost))} SAR
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
            {(
              [
                "P-W",
                ...(mode === "dual" ? ["P-E"] : []),
              ] as (keyof typeof orderPorts)[]
            ).map((id) => {
              const port = orderPorts[id];
              const [x, y] = projectArabianPoint(
                port.coordinates[0],
                port.coordinates[1],
              );
              return (
                <g key={id} data-port={id}>
                  <rect
                    x={x - 8}
                    y={y - 8}
                    width="16"
                    height="16"
                    rx="3"
                    fill={id === "P-W" ? "#355744" : "#947a49"}
                    stroke="white"
                    strokeWidth="2"
                  />
                  <text
                    x={x - 10}
                    y={y + 26}
                    textAnchor="end"
                    className="voa-port-label"
                  >
                    {translateText(port.name)}
                  </text>
                </g>
              );
            })}
          </>
        )}
        {[...new Set(stores.map((s) => s.city))].map((city) => {
          const s = stores.find((s) => s.city === city)!;
          const [x, y] = projectArabianPoint(
            s.coordinates[0],
            s.coordinates[1],
          );
          return (
            <text
              key={city}
              x={x}
              y={y - 49}
              textAnchor="middle"
              className="voa-city-label"
              pointerEvents="none"
            >
              {translateText(city)}
            </text>
          );
        })}
        {layer === "logistics" && !trip && (
          <text x="380" y="290" textAnchor="middle" className="voa-city-label">
            {translateText("没有符合条件的物流车次")}
          </text>
        )}
      </svg>
      <div className="voa-map-legend">
        {layer === "orders" ? (
          <>
            <span>
              <i />
              {translateText("直营门店")}
            </span>
            <span>
              <i className="authorized" />
              {translateText("授权门店")}
            </span>
            <span>{translateText("圆圈面积 ∝ 订单笔数")}</span>
          </>
        ) : (
          <>
            <span>
              <i />
              {translateText("吉达发运")}
            </span>
            {mode === "dual" && (
              <span>
                <i className="authorized" />
                {translateText("达曼发运")}
              </span>
            )}
            <span>{translateText("高亮：当前车次 / 数字：卸货顺序")}</span>
          </>
        )}
      </div>
      {layer === "logistics" && trip && (
        <div className="voa-map-trip-summary">
          <Truck size={15} />
          <b>{translateText(trip.id)}</b>
          <span>
            {trip.quantity}
            {translateText(" 台 · ")}
            {trip.stops.length}
            {translateText(" 个卸货点")}
          </span>
          <strong>
            {translateText(fmt(trip.totalCost))} <small>SAR</small>
          </strong>
        </div>
      )}
      <p className="voa-map-note">
        {translateText("门店按城市中心展开，路线为示意连接。底图：")}
        <a
          href="https://www.naturalearthdata.com/"
          target="_blank"
          rel="noreferrer"
        >
          Natural Earth
        </a>
        {translateText(" ")}
        {translateText("· 城市：")}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames
        </a>
        。
      </p>
    </>
  );
}
