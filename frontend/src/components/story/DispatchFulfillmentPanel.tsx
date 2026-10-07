"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t: translateText } = useI18n();

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
          title={translateText("缺货调度与采购订单")}
          note="根据逐车已选方案生成 · 仅包含区域缺货车辆。"
        />
        <span className="dd-document-status">
          {translateText("待确认草案")}
        </span>
      </div>
      {!current && (
        <div
          className="dd-documents-stale"
          data-testid="dispatch-fulfillment-stale"
          role="status"
        >
          <AlertCircle size={16} />
          <span>{translateText("方案选择已调整，以下保留上次生成结果。")}</span>
          <button type="button" disabled={disabled} onClick={onGenerate}>
            {translateText("按新选择重新生成")}
          </button>
        </div>
      )}
      <div className="dd-document-summary">
        <span>
          {translateText("配送建议")}
          {translateText(" ")}
          <strong>
            {result.instructions.length}
            <small>{translateText(" 台")}</small>
          </strong>
        </span>
        <span>
          {translateText("跨区调拨")}
          {translateText(" ")}
          <strong>
            {result.instructions.length - local}
            <small>{translateText(" 台")}</small>
          </strong>
        </span>
        <span>
          {translateText("授权店采购")}
          {translateText(" ")}
          <strong>
            {local}
            <small>
              {translateText(" 台 / ")}
              {result.purchaseOrders.length}
              {translateText(" 张单")}
            </small>
          </strong>
        </span>
        <span>
          {translateText("采购金额")}
          {translateText(" ")}
          <strong>
            {translateText(
              fmt(result.purchaseOrders.reduce((n, po) => n + po.purchase, 0)),
            )}
            <small> SAR</small>
          </strong>
        </span>
      </div>
      <div
        className="dd-document-tabs"
        role="tablist"
        aria-label={translateText("缺货调度与采购单据")}
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
            {translateText(label)}
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
              {translateText(
                "逐车保留选定的来源与配送方式，授权店采购车辆先采购提车，再配送至需求门店。",
              )}
            </p>
            <div className="dd-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{translateText("订单 · 车辆")}</th>
                    <th>{translateText("车源 → 需求门店")}</th>
                    <th>{translateText("方案与配送方式")}</th>
                    <th>{translateText("物流费用")}</th>
                    <th>{translateText("预计到店")}</th>
                    <th>{translateText("贡献利润 / 状态")}</th>
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
                            {translateText(order.id)}
                            {translateText(" · 第")}
                            {translateText(" ")}
                            {translateText(
                              instruction.vehicleId.split("-CAR-")[1],
                            )}
                            {translateText(" 辆")}
                          </b>
                          <small>
                            {translateText(order.model)} ·{" "}
                            {translateText(order.trim)} /{" "}
                            {translateText(order.color)}
                          </small>
                          <small>{translateText(instruction.vin)}</small>
                        </td>
                        <td>
                          <b>{translateText(source.name)}</b>
                          <small>→ {translateText(store.name)}</small>
                        </td>
                        <td>
                          <b>
                            {translateText(
                              instruction.kind === "cross-region"
                                ? "跨区域调拨"
                                : "本区域授权店采购",
                            )}
                          </b>
                          <small>{translateText(instruction.mode)}</small>
                          {translateText(
                            instruction.purchaseOrderId && (
                              <small>{translateText("已关联采购单")}</small>
                            ),
                          )}
                        </td>
                        <td>{translateText(fmt(instruction.logistics))} SAR</td>
                        <td>
                          {translateText(
                            dispatchArrival(data, instruction.arrivalHours),
                          )}
                          <small>
                            {instruction.arrivalHours}
                            {translateText(" 小时内")}
                          </small>
                        </td>
                        <td>
                          <b
                            className={
                              instruction.profit < 0 ? "dd-negative" : ""
                            }
                          >
                            {translateText(fmt(instruction.profit))} SAR
                          </b>
                          <small
                            className={
                              instruction.requiresReview ? "dd-review" : ""
                            }
                          >
                            {translateText(
                              instruction.requiresReview
                                ? "待复核 · 亏损或超期"
                                : "待车源确认",
                            )}
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
                      <small>
                        {translateText("采购单 ")}
                        {translateText(String(index + 1).padStart(2, "0"))}
                      </small>
                      <strong>
                        {translateText(supplier.name)}
                        <ArrowRight size={13} />
                        {translateText(store.name)}
                      </strong>
                    </div>
                    <span className={po.requiresReview ? "dd-review" : ""}>
                      {translateText(
                        po.requiresReview ? "待复核草案" : "待确认草案",
                      )}
                    </span>
                  </header>
                  <div className="dd-purchase-metrics">
                    <span>
                      {translateText("数量 ")}
                      <b>
                        {po.quantity}
                        {translateText(" 台")}
                      </b>
                    </span>
                    <span>
                      {translateText("采购金额 ")}
                      <b>{translateText(fmt(po.purchase))} SAR</b>
                    </span>
                    <span>
                      {translateText("最晚到店 ")}
                      <b>
                        {translateText(dispatchArrival(data, po.arrivalHours))}
                      </b>
                    </span>
                  </div>
                  <div className="dd-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{translateText("原订单 / 车辆")}</th>
                          <th>{translateText("车型 · 配置 / 颜色")}</th>
                          <th>{translateText("数量")}</th>
                          <th>{translateText("采购单价 SAR")}</th>
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
                                {translateText(line.orderId)}
                                {translateText(" · 第")}
                                {translateText(" ")}
                                {translateText(
                                  line.vehicleId.split("-CAR-")[1],
                                )}
                                {translateText(" 辆")}
                              </b>
                              <small>{translateText(line.vin)}</small>
                            </td>
                            <td>
                              {translateText(line.model)}
                              <small>
                                {translateText(line.trim)} /{" "}
                                {translateText(line.color)}
                              </small>
                            </td>
                            <td>{translateText("1 台")}</td>
                            <td>{translateText(fmt(line.purchase))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer>
                    <span>
                      {translateText("物流 ")}
                      {translateText(fmt(po.logistics))}
                      {translateText(" · 其他归属费用 ")}
                      {translateText(fmt(po.other))}
                      {translateText(" · 总成本 ")}
                      {translateText(fmt(po.totalCost))} SAR
                    </span>
                    <small>{translateText(po.id)}</small>
                  </footer>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dd-empty">
            {translateText(
              "已选方案均为跨区调拨，本次无需生成授权店采购订单。",
            )}
          </div>
        )}
      </div>
      <p className="dd-document-note">
        {translateText(
          "单据根据本次已选方案保存。采购金额为未税车辆采购价，物流与其他归属费用分别列示；候选车辆、报价和交付安排待确认。",
        )}
      </p>
    </section>
  );
}
