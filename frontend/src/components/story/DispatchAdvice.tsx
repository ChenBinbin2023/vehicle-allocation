"use client";
import VesselSectionHeading from "./VesselSectionHeading";
import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Truck,
} from "lucide-react";
import {
  dispatchArrival,
  type DispatchSnapshot,
} from "@/lib/story/daily-dispatch";
const fmt = (n: number) => n.toLocaleString("en-US");

export default function DispatchAdvice({ data }: { data: DispatchSnapshot }) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([data.trips[0]?.id]);
  const trips = data.trips.filter(
    (trip) =>
      (mode === "all" || trip.mode === mode) &&
      (!search.trim() ||
        trip.vehicleIds.some((id) => {
          const vehicle = data.vehicles.find((v) => v.id === id)!;
          const order = data.orders.find((o) => o.id === vehicle.orderId)!;
          return `${trip.id} ${vehicle.vin} ${order.id} ${order.model} ${order.trim} ${data.stores.find((s) => s.id === order.storeId)!.name} ${data.sources.find((s) => s.id === trip.sourceId)!.name}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
        })),
  );
  const pageCount = Math.max(1, Math.ceil(trips.length / 4));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = trips.slice(currentPage * 4, currentPage * 4 + 4);
  return (
    <section className="dd-section" data-testid="dispatch-available">
      <div className="dd-section-heading">
        <VesselSectionHeading
          number="02"
          english="FULFILMENT"
          title="有货车辆 · 调度建议"
          note={`区域有货 ${data.summary.vehicles - data.summary.shortage} 台 · 展开批次追溯每个订单中的每台车。`}
        />
        <span>
          有货物流小计
          <strong>
            {fmt(data.summary.logistics)} <small>SAR</small>
          </strong>
        </span>
      </div>
      <div className="dd-advice-toolbar">
        <label className="dd-search">
          <Search size={15} />
          <input
            aria-label="搜索调度批次"
            value={search}
            placeholder="订单号、门店、车型或车源"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <div className="dd-segment">
          {[
            ["all", "全部批次", "全部批次"],
            ["consolidated", "大车拼载", "仅大车拼载"],
            ["small", "小车直送", "仅小车直送"],
          ].map(([value, title, label]) => (
            <button
              type="button"
              key={value}
              aria-label={label}
              aria-pressed={mode === value}
              className={mode === value ? "active" : ""}
              onClick={() => {
                setMode(value);
                setPage(0);
              }}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      <div className="dd-trip-list">
        {shown.map((trip) => {
          const source = data.sources.find((s) => s.id === trip.sourceId)!;
          const destinations = trip.storeIds.map((id) =>
            data.stores.find((s) => s.id === id)!,
          );
          const orderCount = new Set(
            trip.vehicleIds.map(
              (id) => data.vehicles.find((v) => v.id === id)!.orderId,
            ),
          ).size;
          const open = expanded.includes(trip.id);
          return (
            <article
              className={`dd-trip ${open ? "expanded" : ""}`}
              key={trip.id}
              data-testid="dispatch-trip"
            >
              <button
                type="button"
                className="dd-trip-toggle"
                aria-expanded={open}
                aria-controls={`dispatch-trip-${trip.id}`}
                onClick={() =>
                  setExpanded(
                    open
                      ? expanded.filter((id) => id !== trip.id)
                      : [...expanded, trip.id],
                  )
                }
              >
                <span className={`dd-truck-icon ${trip.mode}`}>
                  <Truck size={20} />
                </span>
                <span className="dd-trip-route">
                  <span>
                    <b>{source.name}</b>
                    <ArrowRight size={13} />
                    <b>
                      {[...new Set(destinations.map((s) => s.city))].join(
                        " / ",
                      )}
                    </b>
                  </span>
                  <small>
                    {trip.id} · {destinations.map((s) => s.name).join(" → ")}
                  </small>
                </span>
                <span className={`dd-mode ${trip.mode}`}>
                  {trip.mode === "small" ? "小车直送" : "多单大车拼载"}
                </span>
                <ChevronDown size={16} className={open ? "rotated" : ""} />
              </button>
              <div className="dd-trip-metrics">
                <div>
                  <span>配载</span>
                  <strong>
                    {trip.vehicleIds.length}
                    <small> / {trip.capacity} 台</small>
                    <i className="dd-load">
                      <i
                        style={{
                          width: `${(trip.vehicleIds.length / trip.capacity) * 100}%`,
                        }}
                      />
                    </i>
                  </strong>
                </div>
                <div>
                  <span>合并订单</span>
                  <strong>
                    {orderCount}
                    <small> 笔 · {trip.storeIds.length} 个卸货点</small>
                  </strong>
                </div>
                <div>
                  <span>物流费用</span>
                  <strong>
                    {fmt(trip.totalCost)}
                    <small> SAR / 趟</small>
                  </strong>
                </div>
                <div>
                  <span>预计到店</span>
                  <strong>
                    {dispatchArrival(data, trip.arrivalHours)}
                    <small>{trip.arrivalHours} 小时内</small>
                  </strong>
                </div>
              </div>
              {open && (
                <div
                  id={`dispatch-trip-${trip.id}`}
                  className="dd-trip-details"
                >
                  <div className="dd-trip-detail-head">
                    <strong>逐车来源与配送明细</strong>
                    <span>
                      预计发车 {dispatchArrival(data, trip.departHours)} ·
                      沿线约 {fmt(trip.distance)} km
                    </span>
                  </div>
                  {trip.comparison && (
                    <p className="dd-trip-comparison">
                      本组 {trip.comparison.quantity} 台：小车组合合计{" "}
                      {fmt(trip.comparison.smallCost)} SAR / 最晚{" "}
                      {trip.comparison.smallArrivalHours}h，大车{" "}
                      {fmt(trip.comparison.consolidatedCost)} SAR /{" "}
                      {trip.comparison.consolidatedArrivalHours}h。
                      {trip.comparison.reason}
                    </p>
                  )}
                  <div className="dd-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>订单 / 车辆</th>
                          <th>门店 · 车型 / 配置</th>
                          <th>车源</th>
                          <th>单车物流</th>
                          <th>预计到店</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trip.vehicleIds.map((id) => {
                          const vehicle = data.vehicles.find(
                            (v) => v.id === id,
                          )!;
                          const order = data.orders.find(
                            (o) => o.id === vehicle.orderId,
                          )!;
                          const destination = data.stores.find(
                            (s) => s.id === vehicle.storeId,
                          )!;
                          return (
                            <tr key={id}>
                              <td>
                                <b>
                                  {order.id} · 第 {id.split("-CAR-")[1]} 辆
                                </b>
                                <small>{vehicle.vin}</small>
                              </td>
                              <td>
                                <b>
                                  {destination.name} · {order.model}
                                </b>
                                <small>
                                  {order.trim} / {order.color}
                                </small>
                              </td>
                              <td>
                                {source.name}
                                <small>
                                  {source.type === "vpc"
                                    ? "VPC 可用库存"
                                    : "其他门店可用库存"}
                                </small>
                              </td>
                              <td>
                                <b>{fmt(vehicle.logistics!)} SAR</b>
                                <small>
                                  {trip.mode === "small"
                                    ? "小车直送"
                                    : "多单拼大车"}
                                </small>
                              </td>
                              <td>
                                {dispatchArrival(data, vehicle.arrivalHours!)}
                                <small className="dd-on-time">
                                  承诺 {order.dueHours}h · 按期
                                </small>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    费用按本批次车辆均摊，尾差分配至前序车辆；所有单车费用之和等于本趟总费用。
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!trips.length && (
        <div className="dd-empty" data-testid="dispatch-trips-empty">
          暂无匹配的调度批次，请调整搜索或运输方式。
        </div>
      )}
      <footer className="dd-pagination">
        <span>
          {trips.length
            ? `${currentPage * 4 + 1}–${Math.min(currentPage * 4 + 4, trips.length)}`
            : "0"}{" "}
          / {trips.length} 个批次<small>筛选保留完整配载与费用</small>
        </span>
        <div>
          <button
            type="button"
            aria-label="上一页调度批次"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="下一页调度批次"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </footer>
      <details className="dd-assumptions">
        <summary>查看物流测算口径</summary>
        <p>
          同车源、同区域沿线合并，最多 8 台 / 3 个卸货点；小车最多 2
          台，急单单独发运。演示报价：小车 240 + 2.4 × 估算公里数，大车 900 +
          3.2 × 沿线最远距离 + 120 × 额外卸货点（SAR）。公里数按城市直线距离 ×
          1.22
          估算；到店时间包括集货、运输、装卸与各站停靠。报价与路线需执行前确认。
        </p>
      </details>
    </section>
  );
}
