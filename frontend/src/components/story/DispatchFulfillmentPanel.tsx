"use client";
import { useId, useState } from "react";
import { AlertCircle, ArrowRight, FileText, Truck } from "lucide-react";
import {
  dispatchArrival,
  type DispatchSnapshot,
} from "@/lib/story/daily-dispatch";
import { dispatchFulfillmentIsCurrent } from "@/lib/story/dispatch-fulfillment";
import VesselSectionHeading from "./VesselSectionHeading";

const fmt = (n: number) => n.toLocaleString("en-US");
export default function DispatchFulfillmentPanel({
  data,
  disabled,
  onGenerate,
}: {
  data: DispatchSnapshot;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const [tab, setTab] = useState<"dispatch" | "purchase">("dispatch");
  const id = useId();
  const result = data.fulfillment;
  if (!result) return null;
  const current = dispatchFulfillmentIsCurrent(data);
  const local = result.instructions.filter(
    (i) => i.kind === "local-dealer",
  ).length;
  return (
    <section
      className="dd-section dd-fulfillment"
      data-testid="dispatch-fulfillment"
    >
      <div className="dd-section-heading">
        <VesselSectionHeading
          number="04"
          english="DISPATCH & PURCHASE"
          title="缺货调度与采购订单"
          note="根据逐车已选方案生成 · 仅包含区域缺货车辆。"
        />
        <span className="dd-document-status">待确认草案</span>
      </div>
      {!current && (
        <div
          className="dd-documents-stale"
          data-testid="dispatch-fulfillment-stale"
          role="status"
        >
          <AlertCircle size={16} />
          <span>方案选择已调整，以下保留上次生成结果。</span>
          <button type="button" disabled={disabled} onClick={onGenerate}>
            按新选择重新生成
          </button>
        </div>
      )}
      <div className="dd-document-summary">
        <span>
          配送建议{" "}
          <strong>
            {result.instructions.length}
            <small> 台</small>
          </strong>
        </span>
        <span>
          跨区调拨{" "}
          <strong>
            {result.instructions.length - local}
            <small> 台</small>
          </strong>
        </span>
        <span>
          授权店采购{" "}
          <strong>
            {local}
            <small> 台 / {result.purchaseOrders.length} 张单</small>
          </strong>
        </span>
        <span>
          采购金额{" "}
          <strong>
            {fmt(result.purchaseOrders.reduce((n, po) => n + po.purchase, 0))}
            <small> SAR</small>
          </strong>
        </span>
      </div>
      <div
        className="dd-document-tabs"
        role="tablist"
        aria-label="缺货调度与采购单据"
      >
        {(
          [
            ["dispatch", "缺货调度建议", Truck, result.instructions.length],
            [
              "purchase",
              "授权店采购订单",
              FileText,
              result.purchaseOrders.length,
            ],
          ] as const
        ).map(([value, label, Icon, count]) => (
          <button
            type="button"
            role="tab"
            id={`${id}-${value}-tab`}
            aria-selected={tab === value}
            aria-controls={`${id}-${value}-panel`}
            key={value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "dispatch"
                    : event.key === "End"
                      ? "purchase"
                      : value === "dispatch"
                        ? "purchase"
                        : "dispatch";
                setTab(next);
                document.getElementById(`${id}-${next}-tab`)?.focus();
              }
            }}
          >
            <Icon size={14} />
            {label}
            <small>{count}</small>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
        className="dd-document-panel"
      >
        {tab === "dispatch" ? (
          <>
            <p className="dd-document-caption">
              逐车保留选定的来源与配送方式，授权店采购车辆先采购提车，再配送至需求门店。
            </p>
            <div className="dd-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>订单 · 车辆</th>
                    <th>车源 → 需求门店</th>
                    <th>方案与配送方式</th>
                    <th>物流费用</th>
                    <th>预计到店</th>
                    <th>贡献利润 / 状态</th>
                  </tr>
                </thead>
                <tbody>
                  {result.instructions.map((instruction) => {
                    const order = data.orders.find(
                      (o) => o.id === instruction.orderId,
                    )!;
                    const source = data.sources.find(
                      (s) => s.id === instruction.sourceId,
                    )!;
                    const store = data.stores.find(
                      (s) => s.id === instruction.storeId,
                    )!;
                    return (
                      <tr
                        key={instruction.id}
                        data-testid="dispatch-instruction"
                      >
                        <td>
                          <b>
                            {order.id} · 第{" "}
                            {instruction.vehicleId.split("-CAR-")[1]} 辆
                          </b>
                          <small>
                            {order.model} · {order.trim} / {order.color}
                          </small>
                          <small>{instruction.vin}</small>
                        </td>
                        <td>
                          <b>{source.name}</b>
                          <small>→ {store.name}</small>
                        </td>
                        <td>
                          <b>
                            {instruction.kind === "cross-region"
                              ? "跨区域调拨"
                              : "本区域授权店采购"}
                          </b>
                          <small>{instruction.mode}</small>
                          {instruction.purchaseOrderId && (
                            <small>已关联采购单</small>
                          )}
                        </td>
                        <td>{fmt(instruction.logistics)} SAR</td>
                        <td>
                          {dispatchArrival(data, instruction.arrivalHours)}
                          <small>{instruction.arrivalHours} 小时内</small>
                        </td>
                        <td>
                          <b
                            className={
                              instruction.profit < 0 ? "dd-negative" : ""
                            }
                          >
                            {fmt(instruction.profit)} SAR
                          </b>
                          <small
                            className={
                              instruction.requiresReview ? "dd-review" : ""
                            }
                          >
                            {instruction.requiresReview
                              ? "待复核 · 亏损或超期"
                              : "待车源确认"}
                          </small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : result.purchaseOrders.length ? (
          <div className="dd-purchase-list">
            {result.purchaseOrders.map((po, index) => {
              const supplier = data.sources.find(
                (s) => s.id === po.supplierId,
              )!;
              const store = data.stores.find((s) => s.id === po.storeId)!;
              return (
                <article
                  className="dd-purchase-order"
                  key={po.id}
                  data-testid="dispatch-purchase-order"
                >
                  <header>
                    <div>
                      <small>采购单 {String(index + 1).padStart(2, "0")}</small>
                      <strong>
                        {supplier.name}
                        <ArrowRight size={13} />
                        {store.name}
                      </strong>
                    </div>
                    <span className={po.requiresReview ? "dd-review" : ""}>
                      {po.requiresReview ? "待复核草案" : "待确认草案"}
                    </span>
                  </header>
                  <div className="dd-purchase-metrics">
                    <span>
                      数量 <b>{po.quantity} 台</b>
                    </span>
                    <span>
                      采购金额 <b>{fmt(po.purchase)} SAR</b>
                    </span>
                    <span>
                      最晚到店 <b>{dispatchArrival(data, po.arrivalHours)}</b>
                    </span>
                  </div>
                  <div className="dd-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>原订单 / 车辆</th>
                          <th>车型 · 配置 / 颜色</th>
                          <th>数量</th>
                          <th>采购单价 SAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.lines.map((line) => (
                          <tr
                            key={line.vehicleId}
                            data-testid="dispatch-purchase-line"
                          >
                            <td>
                              <b>
                                {line.orderId} · 第{" "}
                                {line.vehicleId.split("-CAR-")[1]} 辆
                              </b>
                              <small>{line.vin}</small>
                            </td>
                            <td>
                              {line.model}
                              <small>
                                {line.trim} / {line.color}
                              </small>
                            </td>
                            <td>1 台</td>
                            <td>{fmt(line.purchase)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer>
                    <span>
                      物流 {fmt(po.logistics)} · 其他归属费用 {fmt(po.other)} ·
                      总成本 {fmt(po.totalCost)} SAR
                    </span>
                    <small>{po.id}</small>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dd-empty">
            已选方案均为跨区调拨，本次无需生成授权店采购订单。
          </div>
        )}
      </div>
      <p className="dd-document-note">
        单据根据本次已选方案保存。采购金额为未税车辆采购价，物流与其他归属费用分别列示；候选车辆、报价和交付安排待确认。
      </p>
    </section>
  );
}
