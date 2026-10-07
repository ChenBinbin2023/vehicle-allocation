"use client";

import { useState } from "react";
import VesselOrderMap from "./VesselOrderMap";
import OrderStoreSearch from "./OrderStoreSearch";
import OrderLogisticsCosts from "./OrderLogisticsCosts";
import VesselSectionHeading from "./VesselSectionHeading";
import { Anchor, ArrowRight, MapPin, Package, Truck } from "lucide-react";

import {
  vesselOrders as defaultVesselOrders,
  type OrderPortMode,
  type OrderTrip,
  type VesselOrder,
} from "@/lib/story/vessel-orders";
import { matchesOrderStore } from "@/lib/story/vessel-store-search";
import { summarizeOrderLogistics } from "@/lib/story/vessel-order-costs";

const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });
const sum = (
  orders: VesselOrder[],
  field: "quantity" | "allocated" = "quantity",
) => orders.reduce((s, o) => s + o[field], 0);

function Bars({
  orders,
  dimension,
  title,
  testId,
}: {
  orders: VesselOrder[];
  dimension: "model" | "type";
  title: string;
  testId: string;
}) {
  const groups = new Map<string, { quantity: number; allocated: number }>();
  for (const order of orders) {
    const group = groups.get(order[dimension]) ?? { quantity: 0, allocated: 0 };
    group.quantity += order.quantity;
    group.allocated += order.allocated;
    groups.set(order[dimension], group);
  }
  const rows = [...groups].sort(
    (a, b) => b[1].quantity - a[1].quantity || a[0].localeCompare(b[0]),
  );
  const max = Math.max(1, ...rows.map(([, value]) => value.quantity));
  return (
    <section className="voa-chart" data-testid={testId} aria-label={title}>
      <header>
        <h3>{title}</h3>
        <span>订单车辆 · 台 / 数量降序</span>
      </header>
      <div className="voa-bars">
        {rows.map(([label, value]) => (
          <div
            className="voa-bar-row"
            key={label}
            data-quantity={value.quantity}
          >
            <span title={label}>{label}</span>
            <div
              className="voa-bar-track"
              role="img"
              aria-label={`${label}：${value.quantity} 台，已分配 ${value.allocated} 台`}
            >
              <i style={{ width: `${(value.quantity / max) * 100}%` }}>
                <b
                  style={{
                    width: `${(value.allocated / value.quantity) * 100}%`,
                  }}
                />
              </i>
            </div>
            <strong>{fmt(value.quantity)}</strong>
          </div>
        ))}
        {!rows.length && (
          <p className="voa-empty">当前门店没有符合筛选条件的订单。</p>
        )}
      </div>
      <footer>
        <i /> 本船已分配 <i className="gap" /> 待补供给
      </footer>
    </section>
  );
}

function TripDetail({ trip }: { trip: OrderTrip }) {
  return (
    <section className="voa-trip-detail" data-testid="order-trip-detail">
      <header>
        <span>
          <Truck size={15} /> 当前车次
        </span>
        <b>{trip.id}</b>
      </header>
      <h3>
        {trip.portName} <ArrowRight size={15} /> {trip.stops.at(-1)?.city}
      </h3>
      <dl className="voa-trip-metrics">
        <div>
          <dt>运送数量</dt>
          <dd>
            {trip.quantity}
            <small> / {trip.capacity} 台</small>
          </dd>
        </div>
        <div>
          <dt>物流总成本</dt>
          <dd>
            {fmt(trip.totalCost)}
            <small> SAR</small>
          </dd>
        </div>
        <div>
          <dt>每台物流成本</dt>
          <dd>
            {fmt(trip.unitCost, 1)}
            <small> SAR / 台</small>
          </dd>
        </div>
      </dl>
      <div className="voa-stops">
        <div className="voa-origin">
          <Anchor size={14} />
          <strong>{trip.portName}</strong>
          <span>装车 {trip.quantity} 台 · 出发点</span>
        </div>
        {trip.stops.map((stop, index) => (
          <article key={stop.storeId}>
            <span className="voa-stop-number">{index + 1}</span>
            <div>
              <small>
                {index === trip.stops.length - 1 ? "目的地" : "途经卸货"} ·{" "}
                {stop.city}
              </small>
              <h4>{stop.storeName}</h4>
              <p>
                卸货 <b>{stop.quantity} 台</b> · 成本分摊{" "}
                <b>{fmt(stop.cost)} SAR</b>
              </p>
              <ul>
                {stop.orders.map((order, i) => (
                  <li key={order.orderId + "-" + i}>
                    <code>{order.orderId}</code>
                    <span>
                      {order.model} · {order.quantity} 台
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
      <footer>
        整趟运输 {fmt(trip.linehaulCost)} + 港口处理与整备{" "}
        {fmt(trip.handlingCost)} = {fmt(trip.totalCost)}{" "}
        SAR。卸货点成本按台数分摊，尾差回补。
      </footer>
    </section>
  );
}

export default function VesselOrdersDashboard({
  focusNode,
  prompt = "",
  data = defaultVesselOrders,
}: {
  focusNode?: string;
  prompt?: string;
  data?: typeof defaultVesselOrders;
}) {
  const vesselOrders = data;
  const initialLogistics =
    focusNode?.startsWith("LOGISTICS") ||
    (!focusNode && prompt.includes("物流建议"));
  const [layer, setLayer] = useState<"orders" | "logistics">(
    initialLogistics ? "logistics" : "orders",
  );
  const [mode, setMode] = useState<OrderPortMode>(
    focusNode?.endsWith("SINGLE") || (!focusNode && prompt.includes("单港"))
      ? "single"
      : "dual",
  );
  const [channel, setChannel] = useState("全部"),
    [brand, setBrand] = useState("全部"),
    [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState(vesselOrders.stores[0].id);
  const [selectedTrip, setSelectedTrip] = useState("");
  const [tripKind, setTripKind] = useState("all"),
    [page, setPage] = useState(0);
  const orders = vesselOrders.orders.filter(
    (o) => brand === "全部" || o.brand === brand,
  );
  const searchableStores = vesselOrders.stores.filter(
    (s) =>
      (channel === "全部" || s.channel === channel) &&
      (brand === "全部" || orders.some((o) => o.storeId === s.id)),
  );
  const stores = searchableStores.filter((store) =>
    matchesOrderStore(store, search),
  );
  const storeIds = new Set(stores.map((s) => s.id));
  const visibleOrders = orders.filter((o) => storeIds.has(o.storeId));
  const costSummary = summarizeOrderLogistics(
    stores,
    visibleOrders,
    vesselOrders.plans,
  );
  const store = stores.find((s) => s.id === selectedStore) ?? stores[0];
  const currentOrders = visibleOrders.filter((o) => o.storeId === store?.id);
  const plan = vesselOrders.plans[mode];
  // Filters select whole truck manifests. They never recompute a partial truck's cost.
  const matchingOrderIds = new Set(orders.map((order) => order.id));
  const trips = plan.trips.filter(
    (t) =>
      (tripKind === "all" ||
        (tripKind === "multi" ? t.stops.length > 1 : t.stops.length === 1)) &&
      t.stops.some(
        (stop) =>
          storeIds.has(stop.storeId) &&
          stop.orders.some((order) => matchingOrderIds.has(order.orderId)),
      ),
  );
  const trip = trips.find((t) => t.id === selectedTrip) ?? trips[0];
  const pageCount = Math.ceil(trips.length / 8);
  const activePage = Math.min(page, Math.max(0, pageCount - 1));
  function selectTrip(id: string) {
    setSelectedTrip(id);
    setPage(Math.floor(trips.findIndex((t) => t.id === id) / 8));
  }
  return (
    <section className="vessel-orders" data-testid="vessel-orders">
      <header className="voa-heading">
        <div>
          <small>ORDER ALLOCATION</small>
          <h2>先兑现订单，再规划到店</h2>
          <p>从门店需求到每一车的订单、卸货与成本。</p>
        </div>
        <span>{vesselOrders.snapshotDate} · 模拟订单与物流建议</span>
      </header>
      <section className="voa-section" aria-label="订单概览">
        <VesselSectionHeading
          number="01"
          english="ORDER ALLOCATION OVERVIEW"
          title="订单概览"
          note="先保障当前订单，再规划运输；本船数量与预留参数同步。"
        />
        <div className="voa-kpis">
          {[
            [
              "订单需求",
              `${fmt(sum(visibleOrders))} 台`,
              `${fmt(visibleOrders.length)} 笔订单 · ${stores.length} 家门店`,
            ],
            [
              "本船已分配",
              `${fmt(sum(visibleOrders, "allocated"))} 台`,
              "按渠道与车型预留量保障订单",
            ],
            [
              "待补供给",
              `${fmt(sum(visibleOrders) - sum(visibleOrders, "allocated"))} 台`,
              "缺口订单保留，不进入物流车次",
            ],
            [
              mode === "single" ? "单港物流建议" : "双港物流建议",
              `${fmt(plan.trips.length)} 车次`,
              `${fmt(plan.totalCost)} SAR · 全网 ${fmt(plan.quantity)} 台`,
            ],
          ].map(([label, value, note]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="voa-section" aria-label="订单与物流路线">
        <VesselSectionHeading
          number="02"
          english="ORDER & LOGISTICS PLANNING"
          title="订单与物流路线"
          note="筛选门店需求，切换订单与物流图层，查看每个班次的卸货与成本。"
        />
        <div className="voa-section-body">
          <div className="voa-filters">
            <label>
              渠道
              <select
                aria-label="订单渠道"
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setPage(0);
                }}
              >
                <option>全部</option>
                <option>直营</option>
                <option>授权</option>
              </select>
            </label>
            <label>
              品牌
              <select
                aria-label="订单品牌"
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setPage(0);
                }}
              >
                <option>全部</option>
                <option>丰田</option>
                <option>雷克萨斯</option>
              </select>
            </label>
            <OrderStoreSearch
              stores={searchableStores}
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(0);
              }}
              onSelectStore={setSelectedStore}
            />
            {(channel !== "全部" || brand !== "全部" || search) && (
              <button
                onClick={() => {
                  setChannel("全部");
                  setBrand("全部");
                  setSearch("");
                  setPage(0);
                }}
              >
                清除筛选
              </button>
            )}
          </div>
          <div className="voa-layout">
            <section className="voa-map-panel">
              <header>
                <div className="voa-layer-toggle">
                  <button
                    aria-pressed={layer === "orders"}
                    onClick={() => setLayer("orders")}
                  >
                    <MapPin size={15} />
                    门店订单
                  </button>
                  <button
                    aria-pressed={layer === "logistics"}
                    onClick={() => setLayer("logistics")}
                  >
                    <Truck size={15} />
                    物流建议
                  </button>
                </div>
                <small>
                  {layer === "orders"
                    ? "点击圆圈，查看门店订单"
                    : "选择车次，查看卸货路线"}
                </small>
              </header>
              {layer === "logistics" && (
                <div className="voa-port-toggle">
                  <button
                    aria-pressed={mode === "single"}
                    onClick={() => {
                      setMode("single");
                      setSelectedTrip("");
                      setPage(0);
                    }}
                  >
                    单港 · 吉达
                  </button>
                  <button
                    aria-pressed={mode === "dual"}
                    onClick={() => {
                      setMode("dual");
                      setSelectedTrip("");
                      setPage(0);
                    }}
                  >
                    双港 · 吉达 + 达曼
                  </button>
                </div>
              )}
              <VesselOrderMap
                stores={stores}
                orders={visibleOrders}
                layer={layer}
                storeId={store?.id ?? ""}
                trips={trips}
                trip={trip}
                mode={mode}
                onStore={setSelectedStore}
              />
            </section>
            <aside className="voa-inspector">
              {layer === "orders" ? (
                <div
                  data-testid="order-store-inspector"
                  data-store-id={store?.id ?? ""}
                >
                  <header className="voa-store-heading">
                    <span>
                      <Package size={15} />
                      门店订单
                    </span>
                    <select
                      aria-label="查看订单门店"
                      value={store?.id ?? ""}
                      onChange={(e) => setSelectedStore(e.target.value)}
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName} · {s.name}
                        </option>
                      ))}
                    </select>
                    <h3>{store?.name ?? "无匹配门店"}</h3>
                    <p>
                      {store
                        ? `${store.city} · ${store.channel} · ${store.id}`
                        : "调整筛选条件后查看订单。"}
                    </p>
                    <strong>
                      {fmt(sum(currentOrders))}
                      <small> 台 / {currentOrders.length} 笔订单</small>
                    </strong>
                  </header>
                  <Bars
                    orders={currentOrders}
                    dimension="model"
                    title="按车型数量统计"
                    testId="order-model-chart"
                  />
                  <Bars
                    orders={currentOrders}
                    dimension="type"
                    title="按订单类型统计"
                    testId="order-type-chart"
                  />
                </div>
              ) : (
                <>
                  <section
                    className="voa-trip-list"
                    data-testid="order-trip-list"
                  >
                    <header>
                      <div>
                        <h3>
                          建议车次 <small>{trips.length}</small>
                        </h3>
                        <p>全车明细 · 点击联动地图</p>
                      </div>
                      <select
                        aria-label="车次类型"
                        value={tripKind}
                        onChange={(e) => {
                          setTripKind(e.target.value);
                          setSelectedTrip("");
                          setPage(0);
                        }}
                      >
                        <option value="all">全部车次</option>
                        <option value="multi">多点卸货</option>
                        <option value="direct">单点直送</option>
                      </select>
                    </header>
                    <div className="voa-trip-items">
                      {trips
                        .slice(activePage * 8, (activePage + 1) * 8)
                        .map((t) => (
                          <button
                            key={t.id}
                            data-trip-id={t.id}
                            aria-pressed={trip?.id === t.id}
                            onClick={() => selectTrip(t.id)}
                          >
                            <span>
                              <b>{t.id}</b>
                              <small>
                                {t.stops.length > 1
                                  ? `${t.stops.length} 点卸货`
                                  : "直送"}
                              </small>
                              <strong>{t.quantity} 台</strong>
                            </span>
                            <span className="voa-trip-route">
                              {t.portName} →{" "}
                              {t.stops
                                .map(
                                  (s) =>
                                    `${s.city} ${vesselOrders.stores.find((store) => store.id === s.storeId)?.shortName}`,
                                )
                                .join(" → ")}
                            </span>
                            <span className="voa-trip-cost">
                              <span>{fmt(t.totalCost)} SAR</span>
                              <small>
                                {fmt(t.unitCost, 1)} SAR / 台 ·{" "}
                                {
                                  new Set(
                                    t.stops.flatMap((s) =>
                                      s.orders.map((o) => o.orderId),
                                    ),
                                  ).size
                                }{" "}
                                笔订单
                              </small>
                            </span>
                          </button>
                        ))}
                      {!trips.length && (
                        <p className="voa-empty">没有符合筛选条件的车次。</p>
                      )}
                    </div>
                    {pageCount > 1 && (
                      <footer>
                        <button
                          aria-label="上一页车次"
                          disabled={activePage === 0}
                          onClick={() => setPage(activePage - 1)}
                        >
                          上一页
                        </button>
                        <span>
                          {activePage + 1} / {pageCount}
                        </span>
                        <button
                          aria-label="下一页车次"
                          disabled={activePage + 1 >= pageCount}
                          onClick={() => setPage(activePage + 1)}
                        >
                          下一页
                        </button>
                      </footer>
                    )}
                  </section>
                  {trip && <TripDetail trip={trip} />}
                </>
              )}
            </aside>
          </div>
        </div>
      </section>
      <OrderLogisticsCosts summary={costSummary} />
      <details className="voa-assumptions">
        <summary>订单分车与物流计算口径</summary>
        <p>
          订单号为模拟编号。按 tab1 的渠道 ×
          车型订单总量，以门店八周销速为权重分摊，直营订单类型权重 7:2:1、授权
          4:4:2；车型缺口在各店与类型间分摊。物流仅运输本轮已分配的{" "}
          {fmt(vesselOrders.plans.dual.quantity)} 台，
          {fmt(
            vesselOrders.orders.reduce(
              (sum, order) => sum + order.quantity - order.allocated,
              0,
            ),
          )}{" "}
          台缺口不排车；分配数量与本轮预留和船量参数同步。
        </p>
        <p>
          单港由吉达出发；双港按目的城市的整趟模拟报价选择吉达或达曼。默认 8
          台/车，邻近城市合车、最多 3 个卸货点。每车费用 = 沿线最高整趟报价 +
          120 SAR × 额外卸货点 + 400 SAR × 车辆数（港口处理 150、整备
          250）。报价源参数来自当前模拟路线表，作为历史情景假设；费用不含
          VPC、跨港调拨及海运成本。筛选展示整车，其他门店的同车订单也保留。车次列表为建议，未实际发运。
        </p>
      </details>
    </section>
  );
}
