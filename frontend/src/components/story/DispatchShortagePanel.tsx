"use client";
import { useState } from "react";
import VesselSectionHeading from "./VesselSectionHeading";
import { selectedDispatchOptions } from "@/lib/story/dispatch-fulfillment";
import {
  ArrowRight,
  Check,
  Clock3,
  Lightbulb,
  MapPinned,
  Store,
} from "lucide-react";
import {
  dispatchArrival,
  type DispatchSnapshot,
} from "@/lib/story/daily-dispatch";
const fmt = (n: number) => n.toLocaleString("en-US");

export default function DispatchShortagePanel({
  data,
  disabled,
  onSelect,
  onGenerate,
}: {
  data: DispatchSnapshot;
  disabled: boolean;
  onSelect: (selections: Record<string, string>) => void;
  onGenerate: () => void;
}) {
  const [selectedId, setSelectedId] = useState(data.shortages[0]?.vehicleId);
  const shortage = data.shortages.find((s) => s.vehicleId === selectedId);
  if (!shortage) return null;
  const vehicle = data.vehicles.find((v) => v.id === shortage.vehicleId)!;
  const order = data.orders.find((o) => o.id === vehicle.orderId)!;
  const store = data.stores.find((s) => s.id === order.storeId)!;
  const recommended = shortage.options.find(
    (o) => o.id === shortage.recommendedId,
  )!;
  const count = selectedDispatchOptions(data).filter((s) => s.option).length;
  return (
    <section className="dd-section dd-shortage" data-testid="dispatch-shortage">
      <div className="dd-section-heading">
        <VesselSectionHeading
          number="03"
          english="REGIONAL SHORTAGE"
          title="区域缺货 · 逐车方案比较"
          note={`区域缺货 ${data.shortages.length} 台 · 逐车比较补齐路径，并选择采用的方案。`}
        />
        <span className="dd-shortage-label">先保交期，再比较利润</span>
      </div>
      <div className="dd-shortage-toolbar">
        <strong data-testid="dispatch-selection-count">
          已选 {count} / {data.shortages.length} 台
        </strong>
        <span>选择将随当前计划保存</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onSelect(
              Object.fromEntries(
                data.shortages.map((s) => [s.vehicleId, s.recommendedId]),
              ),
            )
          }
        >
          填入建议方案
        </button>
        <button
          className="dd-generate"
          type="button"
          disabled={disabled || count !== data.shortages.length}
          onClick={onGenerate}
        >
          生成调度建议与采购订单
        </button>
      </div>
      <div className="dd-shortage-layout">
        <div className="dd-shortage-list" aria-label="选择缺货车辆">
          <div
            className="dd-shortage-list-inner"
            tabIndex={0}
            role="region"
            aria-label="缺货车辆列表"
          >
            {data.shortages.map((s) => {
              const v = data.vehicles.find((v) => v.id === s.vehicleId)!;
              const o = data.orders.find((o) => o.id === v.orderId)!;
              const dest = data.stores.find((store) => store.id === o.storeId)!;
              return (
                <button
                  type="button"
                  key={s.vehicleId}
                  data-testid="dispatch-shortage-item"
                  aria-pressed={selectedId === s.vehicleId}
                  className={selectedId === s.vehicleId ? "active" : ""}
                  onClick={() => setSelectedId(s.vehicleId)}
                >
                  <span>
                    <small>
                      {dest.region} · {dest.name}
                    </small>
                    {o.dueHours <= 24 && <i>急单</i>}
                  </span>
                  <strong>
                    {o.model}
                    <small>第 {v.id.split("-CAR-")[1]} 辆</small>
                  </strong>
                  <em>
                    {o.trim} / {o.color}
                  </em>
                  <span className="dd-shortage-order">
                    {o.id}
                    {data.selections?.[s.vehicleId] ? (
                      <span className="dd-chosen-marker">
                        <Check size={11} />
                        已选
                      </span>
                    ) : (
                      <ArrowRight size={13} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="dd-comparison">
          <div className="dd-shortage-context">
            <div>
              <strong>
                {store.name} · {order.model}
              </strong>
              <span>
                {order.id} · 第 {vehicle.id.split("-CAR-")[1]} 辆 · {order.trim}{" "}
                / {order.color}
              </span>
            </div>
            <span>
              <Clock3 size={13} />
              承诺 {dispatchArrival(data, order.dueHours)} 前
            </span>
          </div>
          <div
            className="dd-recommendation"
            data-testid="dispatch-recommendation"
          >
            <Lightbulb size={18} />
            <div>
              <strong>
                {shortage.requiresReview
                  ? "建议暂缓 · 人工复核"
                  : `推荐${recommended.kind === "cross-region" ? "跨区调拨" : "本区采购"}`}
              </strong>
              <p>{shortage.reason}</p>
            </div>
          </div>
          <div className="dd-option-grid">
            {shortage.options.map((option) => {
              const source = data.sources.find(
                (s) => s.id === option.sourceId,
              )!;
              const preferred = option.id === shortage.recommendedId;
              const chosen =
                data.selections?.[shortage.vehicleId] === option.id;
              const Icon = option.kind === "cross-region" ? MapPinned : Store;
              return (
                <article
                  className={`dd-option ${preferred ? "recommended" : ""} ${chosen ? "selected" : ""}`}
                  key={option.id}
                  data-testid="dispatch-option"
                >
                  <header>
                    <span>
                      <Icon size={17} />
                      {option.kind === "cross-region"
                        ? "跨区域调拨"
                        : "本区域授权店采购"}
                    </span>
                    {preferred && (
                      <i>
                        <Check size={12} />
                        {shortage.requiresReview ? "待复核" : "推荐"}
                      </i>
                    )}
                  </header>
                  <div className="dd-option-source">
                    <strong>
                      {source.name}
                      <ArrowRight size={12} />
                      {store.city}
                    </strong>
                    <span>{option.mode}</span>
                    <small>候选车辆 {option.vin}</small>
                  </div>
                  <div
                    className={`dd-option-profit ${option.profit < 0 ? "negative" : ""}`}
                  >
                    <span>单车贡献利润</span>
                    <strong>
                      {fmt(option.profit)}
                      <small>SAR</small>
                    </strong>
                    <em>
                      贡献利润率{" "}
                      {((option.profit / option.revenue) * 100).toFixed(1)}%
                    </em>
                  </div>
                  <dl className="dd-cost-breakdown">
                    <div>
                      <dt>未税净收入</dt>
                      <dd>{fmt(option.revenue)}</dd>
                    </div>
                    <div>
                      <dt>采购成本</dt>
                      <dd>− {fmt(option.purchase)}</dd>
                    </div>
                    <div>
                      <dt>物流费用</dt>
                      <dd>− {fmt(option.logistics)}</dd>
                    </div>
                    <div>
                      <dt>佣金 / 其他归属费用</dt>
                      <dd>− {fmt(option.other)}</dd>
                    </div>
                    <div className="dd-total-cost">
                      <dt>
                        总成本 <small>SAR</small>
                      </dt>
                      <dd>{fmt(option.totalCost)}</dd>
                    </div>
                  </dl>
                  <div
                    className={`dd-option-arrival ${option.onTime ? "on-time" : "late"}`}
                  >
                    <Clock3 size={15} />
                    <div>
                      <strong>
                        {dispatchArrival(data, option.arrivalHours)} 到店
                      </strong>
                      <span>
                        预计 {option.arrivalHours} 小时 ·{" "}
                        {option.onTime
                          ? "满足订单交期"
                          : `超出交期 ${option.arrivalHours - order.dueHours} 小时`}
                      </span>
                    </div>
                    <b>{option.onTime ? "按期" : "超期"}</b>
                  </div>
                  <div className="dd-option-action">
                    <button
                      type="button"
                      aria-pressed={chosen}
                      disabled={disabled}
                      onClick={() =>
                        onSelect({ [shortage.vehicleId]: option.id })
                      }
                    >
                      {chosen && <Check size={13} />}
                      {chosen ? "已选择此方案" : "选择此方案"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="dd-comparison-note">
            金额单位 SAR。贡献利润 = 未税净收入 − 采购 − 物流 −
            佣金及其他归属费用。采购报价及车辆权属待确认，候选未锁定；两种方案互斥，不重复计入调度台数。
          </p>
        </div>
      </div>
    </section>
  );
}
