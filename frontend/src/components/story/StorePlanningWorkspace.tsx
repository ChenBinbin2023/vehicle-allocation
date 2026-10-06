"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  Play,
  Ship,
  Truck,
} from "lucide-react";
import {
  calculateStoreAllocation,
  defaultDeliveryScenario,
  type AllocationScenario,
  type DeliveryScenario,
  type PlanningInput,
  type ReceivingRule,
} from "@/lib/story/store-planning";
import DeliveryRouteMap from "./DeliveryRouteMap";
import CostRateEditor from "./CostRateEditor";
import { unknownCostRates } from "@/lib/story/logistics-cost";
import type { ProfitScenario } from "@/lib/story/profit-analysis";
import AllocationPlanningWorkspace from "./AllocationPlanningWorkspace";
import type { StoryCommand, StoryRun } from "@/lib/story/types";
const fmt = (n: number | null, digits = 0) =>
  n === null
    ? "待确认"
    : n.toLocaleString("en-US", { maximumFractionDigits: digits });
const day = (n: number | null) => (n === null ? "待确认" : "D+" + n);
function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="planning-panel">
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="planning-metric">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}
function DeliveryPlanningWorkspace({
  run,
  focusedStep,
  focusRevision,
  busy,
  onRunPlanning,
  onRunProfit,
}: {
  onRunProfit: (
    input: ProfitScenario | undefined,
    deliveryRunId: string,
  ) => void;
  run: StoryRun;
  focusedStep: number | null;
  focusRevision: number;
  busy: boolean;
  onRunPlanning: (
    command: StoryCommand,
    input: PlanningInput,
    allocationRunId?: string,
  ) => void;
}) {
  const snapshot = run.planning!;
  const initial = snapshot.result.input;
  const [input, setInput] = useState<PlanningInput>(() =>
    structuredClone(initial),
  );
  const [tab, setTab] = useState("map");
  const [channel, setChannel] = useState("全部");
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const [scheduleTexts, setScheduleTexts] = useState<Record<string, string>>(
    () =>
      snapshot.kind === "delivery"
        ? Object.fromEntries(
            snapshot.result.input.stores.map((s) => [
              s.id,
              s.schedule
                .map((slot) => slot.day + ":" + slot.capacity)
                .join(","),
            ]),
          )
        : {},
  );
  useEffect(() => {
    const target =
      focusedStep === null ? undefined : run.events[focusedStep]?.planningTab;
    if (target && target !== "allocation") setTab(target);
    if (target) {
      const frame = requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [focusedStep, focusRevision, run.events]);
  const ready =
    run.blocks.find(
      (b) =>
        b.type ===
        "planning-" + (snapshot.kind === "allocation" ? "allocation" : tab),
    )?.status === "ready";
  const aInput = input as AllocationScenario,
    dInput = input as DeliveryScenario;
  const edited =
    JSON.stringify(input) !== JSON.stringify(initial) ||
    (snapshot.kind === "delivery" &&
      snapshot.result.input.stores.some(
        (s) =>
          scheduleTexts[s.id] !==
          s.schedule.map((slot) => slot.day + ":" + slot.capacity).join(","),
      ));
  function updateReceiving(id: string, patch: Partial<ReceivingRule>) {
    setInput({
      ...dInput,
      stores: dInput.stores.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }
  function rerun() {
    setError("");
    try {
      if (snapshot.kind === "allocation") {
        calculateStoreAllocation(aInput);
        onRunPlanning("/vessel-allocation", aInput);
      } else {
        const next = {
          ...dInput,
          stores: dInput.stores.map((s) => ({
            ...s,
            schedule: scheduleTexts[s.id].trim()
              ? scheduleTexts[s.id].split(/[,，]/).map((part) => {
                  if (!/^\s*\d+\s*:\s*\d+\s*$/.test(part))
                    throw new Error("后续接车格式为 日:数量，例如 4:200,9:107");
                  const [day, capacity] = part.split(":").map(Number);
                  return { day, capacity };
                })
              : [],
          })),
        };
        onRunPlanning("/delivery-plan", next, snapshot.allocationRunId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "参数无效");
    }
  }
  function exportSnapshot() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              runId: run.id,
              prompt: run.prompt,
              simulation: true,
              ...snapshot,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = run.id + ".json";
    link.click();
    URL.revokeObjectURL(url);
  }
  const allocation =
    snapshot.kind === "allocation" ? snapshot.result : snapshot.allocation;
  return (
    <div className="planning-workspace" data-testid="store-planning-workspace">
      <header className="planning-heading">
        <div>
          <small>
            {snapshot.kind === "allocation"
              ? "STORE ALLOCATION"
              : "STORE DELIVERY"}{" "}
            · PRODUCT SKILL
          </small>
          <h1>
            {snapshot.kind === "allocation"
              ? "订单先行，库存按门店注水"
              : "分货到店，按能力分批交付"}
          </h1>
          <p>
            {snapshot.kind === "allocation"
              ? "直营与授权共享供给，销速和库存决定补货水位。"
              : "同一门店可部分直送、部分经 VPC；停车场容量决定首批量。"}
          </p>
        </div>
        <span className="planning-status">
          {run.status === "complete"
            ? "模拟已完成"
            : run.status === "paused"
              ? "已暂停"
              : "模拟中"}{" "}
          · {Math.min(100, Math.round((run.elapsed / run.duration) * 100))}%
        </span>
      </header>
      <div className="planning-context">
        <span>
          <Ship size={14} /> {fmt(allocation.input.supply)} 台供给
        </span>
        <span>
          {allocation.rows.length} 家门店 ·{" "}
          {allocation.input.brand ?? "单一配置"}
        </span>
        <span>模拟数据 · 未发布 · 未签收</span>
        {snapshot.kind === "delivery" && (
          <span title={snapshot.allocationRunId}>
            引用分车画布 {snapshot.allocationRunId.split("-").at(-1)}
          </span>
        )}
        <button
          type="button"
          onClick={exportSnapshot}
          disabled={run.status !== "complete"}
        >
          <ArrowDownToLine size={14} />
          导出快照
        </button>
        {snapshot.kind === "delivery" && allocation.input.source && (
          <button
            type="button"
            disabled={busy || run.status !== "complete"}
            onClick={() => onRunProfit(undefined, run.id)}
          >
            分析订单、车型和门店利润 <ArrowRight size={14} />
          </button>
        )}
      </div>
      {snapshot.kind === "delivery" && (
        <nav className="planning-tabs" role="tablist" aria-label="物流模拟视图">
          {[
            ["map", "路线地图", Truck],
            ["routes", "到店路线", Truck],
            ["compare", "港口比较", Ship],
            ["batches", "到店批次", Boxes],
          ].map(([id, label, Icon]) => {
            const TabIcon = Icon as typeof Truck;
            return (
              <button
                type="button"
                key={String(id)}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(String(id))}
              >
                <TabIcon size={16} />
                {String(label)}
              </button>
            );
          })}
        </nav>
      )}
      {ready && (
        <div className="planning-conclusion" data-testid="planning-conclusion">
          <small>本轮结论 · 模拟计划</small>
          <p>{run.planningSummary}</p>
        </div>
      )}
      <details className="delivery-parameters">
        <summary>调整接车、VPC 容量和物流费率</summary>
        <Panel
          title="模拟参数"
          note={
            edited
              ? "参数已修改；点击模拟重跑后更新结论，并保存新画布。"
              : "调整参数，观察分车、成本和交付时间如何变化。"
          }
        >
          {snapshot.kind === "allocation" ? (
            <>
              <div className="planning-controls">
                <label>
                  可分供给（台）
                  <input
                    aria-label="可分供给"
                    type="number"
                    min="0"
                    max="100000"
                    value={aInput.supply}
                    onChange={(e) =>
                      setInput({ ...aInput, supply: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  直营目标 WoS（周）
                  <input
                    aria-label="直营目标 WoS"
                    type="number"
                    min=".1"
                    step=".5"
                    value={aInput.targetDirect}
                    onChange={(e) =>
                      setInput({
                        ...aInput,
                        targetDirect: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  授权目标 WoS（周）
                  <input
                    aria-label="授权目标 WoS"
                    type="number"
                    min=".1"
                    step=".5"
                    value={aInput.targetAuthorized}
                    onChange={(e) =>
                      setInput({
                        ...aInput,
                        targetAuthorized: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="planning-presets">
                {[1500, 1800, 2000].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-label={"供给 " + n + " 台"}
                    aria-pressed={aInput.supply === n}
                    onClick={() => setInput({ ...aInput, supply: n })}
                  >
                    {fmt(n)} 台供给
                  </button>
                ))}
              </div>
              <details className="planning-input-details">
                <summary>编辑各门店的订单、周销速和自由库存</summary>
                <div className="planning-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>门店</th>
                        <th>已订订单</th>
                        <th>周销速</th>
                        <th>到店日自由库存 E</th>
                        <th>总分车上限</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aInput.stores.map((s) => (
                        <tr key={s.id}>
                          <td>
                            {s.name} · {s.channel}
                          </td>
                          {(
                            [
                              "orders",
                              "weeklySales",
                              "availableStock",
                              "allocationCap",
                            ] as const
                          ).map((key) => (
                            <td key={key}>
                              <input
                                type="number"
                                min="0"
                                aria-label={s.id + " " + key}
                                placeholder={
                                  key === "allocationCap" ? "不限" : undefined
                                }
                                value={s[key] ?? ""}
                                onChange={(e) =>
                                  setInput({
                                    ...aInput,
                                    stores: aInput.stores.map((r) =>
                                      r.id === s.id
                                        ? {
                                            ...r,
                                            [key]:
                                              e.target.value === "" &&
                                              key === "allocationCap"
                                                ? null
                                                : Number(e.target.value),
                                          }
                                        : r,
                                    ),
                                  })
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  周销速 = 近 28 天净零售 ÷ 4。E 为到店日预计自由库存：可售库存
                  + 按期自由在途 − 预计消耗；已订订单和锁定库存已排除。
                </p>
              </details>
            </>
          ) : (
            <>
              <div className="planning-controls">
                <label>
                  运输场景
                  <select
                    aria-label="物流运输场景"
                    value={dInput.mode}
                    onChange={(e) =>
                      setInput({
                        ...dInput,
                        mode: e.target.value as "single" | "dual",
                      })
                    }
                  >
                    <option value="single">吉达单港</option>
                    <option value="dual">吉达 + 达曼双港</option>
                  </select>
                </label>
                {(["JED", "RUH", "DMM"] as const).map((vpc) => (
                  <label key={vpc}>
                    {vpc} VPC 可用车位
                    <input
                      type="number"
                      min="0"
                      aria-label={vpc + " VPC 可用车位"}
                      value={dInput.vpcCapacity[vpc]}
                      onChange={(e) =>
                        setInput({
                          ...dInput,
                          vpcCapacity: {
                            ...dInput.vpcCapacity,
                            [vpc]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              {allocation.input.source && (
                <details className="profit-parameters">
                  <summary>补充物流费用（留空为待确认）</summary>
                  <CostRateEditor
                    value={dInput.costRates ?? unknownCostRates}
                    onChange={(costRates) => setInput({ ...dInput, costRates })}
                  />
                </details>
              )}
              <div className="planning-table-scroll planning-receiving-scroll">
                <table className="planning-receiving">
                  <thead>
                    <tr>
                      <th>门店</th>
                      <th>直送条件满足</th>
                      <th>首批可接（台）</th>
                      <th>后续时段（D+日:台）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dInput.stores.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {allocation.rows.find((r) => r.id === s.id)?.name}
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={s.id + " 可直送"}
                            checked={s.directEligible}
                            onChange={(e) =>
                              updateReceiving(s.id, {
                                directEligible: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            aria-label={s.id + " 首批接车"}
                            value={s.firstCapacity}
                            onChange={(e) =>
                              updateReceiving(s.id, {
                                firstCapacity: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={s.id + " 后续接车时段"}
                            value={scheduleTexts[s.id]}
                            onChange={(e) =>
                              setScheduleTexts({
                                ...scheduleTexts,
                                [s.id]: e.target.value,
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="planning-footnote">
                {allocation.input.source
                  ? "路线及周运力来自 data，同城门店共享路线额度。首批与后续接车能力默认按周销速的一半向上取整，且不超过扣除所有品牌实物库存后的停车余量；直营直送、授权经 VPC、VPC 额度与后续时段均为可修改的情景假设。ETA 按源运输小时数折天，再配合情景接车时段。"
                  : "可接数量为停车位、接车、整备与已预订到货扣减后的剩余能力。时段采用双港基准；单港东部路线模拟顺延 3 天。VPC 车位为本船专属暂存额度，已扣除其他车辆占用。"}
              </p>
              <label className="planning-check">
                <input
                  type="checkbox"
                  disabled={!!allocation.input.source}
                  checked={dInput.includeVpcStock}
                  onChange={(e) =>
                    setInput({ ...dInput, includeVpcStock: e.target.checked })
                  }
                />
                {allocation.input.source
                  ? "data 没有独立 VPC 库存明细，本轮不额外生成 VPC 车源。"
                  : "加入独立 VPC 发运模拟：RUH → D2，20 台（已预留 D+1 接车时段）"}
              </label>
            </>
          )}
          <div className="planning-action-row">
            <button
              type="button"
              className="planning-primary"
              disabled={busy}
              onClick={rerun}
            >
              <Play size={14} />
              模拟重跑
            </button>

            {snapshot.kind === "allocation" && (
              <button
                type="button"
                disabled={busy || run.status !== "complete"}
                onClick={() =>
                  onRunPlanning(
                    "/delivery-plan",
                    defaultDeliveryScenario(),
                    run.id,
                  )
                }
              >
                生成到店物流模拟
                <ArrowRight size={14} />
              </button>
            )}
            <span>
              {edited
                ? "当前下方结果来自已保存参数"
                : "每次重跑保存一张独立画布"}
            </span>
          </div>
          {error && (
            <p role="alert" className="planning-error">
              {error}
            </p>
          )}
        </Panel>
      </details>
      {!ready ? (
        <div className="planning-loading">
          <i />
          正在计算门店方案，CUI 过程与画布同步生成…
        </div>
      ) : (
        <div ref={resultRef}>
          {snapshot.kind === "allocation" ? (
            <>
              <div className="planning-metrics">
                <Metric
                  label="已订订单先分"
                  value={fmt(snapshot.result.summary.orders) + " 台"}
                  note={
                    "订单缺口 " +
                    fmt(snapshot.result.summary.orderShortage) +
                    " 台"
                  }
                />
                <Metric
                  label="门店注水补库"
                  value={fmt(snapshot.result.summary.replenishment) + " 台"}
                  note={
                    "距目标仍缺 " +
                    fmt(snapshot.result.summary.replenishmentGap) +
                    " 台"
                  }
                />
                <Metric
                  label="保留供给"
                  value={fmt(snapshot.result.summary.retained) + " 台"}
                  note="目标已满或分车上限受限时保留"
                />
              </div>
              <Panel
                title="门店 WoS 水位"
                note="订单车单独保护。自由库存的相对水位越低，越先获得补库。"
              >
                <div className="planning-wos-chart">
                  {snapshot.result.rows.map((r) => (
                    <article key={r.id}>
                      <div>
                        <strong>{r.name}</strong>
                        <span>
                          {r.channel} · 周销 {fmt(r.weeklySales)} 台
                        </span>
                      </div>
                      <div className="planning-water">
                        <i
                          style={{
                            width:
                              Math.min(
                                100,
                                ((r.beforeWos ?? 0) /
                                  Math.max(r.targetWeeks, r.afterWos ?? 0)) *
                                  100,
                              ) + "%",
                          }}
                        />
                        <b
                          style={{
                            width:
                              Math.min(
                                100,
                                ((r.afterWos ?? 0) /
                                  Math.max(r.targetWeeks, r.afterWos ?? 0)) *
                                  100,
                              ) + "%",
                          }}
                        />
                      </div>
                      <span>
                        {r.beforeWos === null
                          ? "无销速"
                          : fmt(r.beforeWos, 2) +
                            " → " +
                            fmt(r.afterWos, 2) +
                            " 周"}
                        <small>
                          目标 {r.targetWeeks} 周 · 补库 {fmt(r.replenishment)}{" "}
                          台
                        </small>
                      </span>
                    </article>
                  ))}
                </div>
              </Panel>
              <Panel
                title="分车到门店的明细"
                note="订单基准 + WoS 补库 = 门店本轮分车量；停车场容量在物流 Skill 中分批落实。"
              >
                <label className="planning-filter">
                  渠道
                  <select
                    aria-label="分车渠道"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {["全部", "直营", "授权"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="planning-table-scroll">
                  <table data-testid="store-allocation-table">
                    <thead>
                      <tr>
                        <th>门店 / 渠道</th>
                        <th>周销速</th>
                        <th>自由库存 E</th>
                        <th>订单分车</th>
                        <th>补库</th>
                        <th>总分车</th>
                        <th>前 / 后 WoS</th>
                        <th>补库缺口</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.result.rows
                        .filter(
                          (r) => channel === "全部" || channel === r.channel,
                        )
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              {r.name}
                              <small>{r.channel}</small>
                            </td>
                            <td>{fmt(r.weeklySales)}</td>
                            <td>{fmt(r.availableStock)}</td>
                            <td>{fmt(r.orderAllocated)}</td>
                            <td className="planning-accent">
                              {fmt(r.replenishment)}
                            </td>
                            <td>
                              <strong>{fmt(r.total)}</strong>
                            </td>
                            <td>
                              {r.beforeWos === null
                                ? "无销速"
                                : fmt(r.beforeWos, 2) +
                                  " / " +
                                  fmt(r.afterWos, 2)}
                            </td>
                            <td>{fmt(r.gap)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel
                title="供给量变化的模拟结论"
                note="同一门店快照和 WoS 目标，独立重算三个场景；可点击上方供给预设重跑。"
              >
                <div className="planning-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>供给量</th>
                        <th>已订订单</th>
                        <th>补库存</th>
                        <th>保留量</th>
                        <th>订单缺口</th>
                        <th>WoS 补库缺口</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1500, 1800, 2000].map((supply) => {
                        const s = calculateStoreAllocation({
                          ...snapshot.result.input,
                          supply,
                        }).summary;
                        return (
                          <tr key={supply}>
                            <td>{fmt(supply)}</td>
                            <td>{fmt(s.orders)}</td>
                            <td>{fmt(s.replenishment)}</td>
                            <td>{fmt(s.retained)}</td>
                            <td>{fmt(s.orderShortage)}</td>
                            <td>{fmt(s.replenishmentGap)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          ) : (
            (() => {
              const result = snapshot.result,
                active = result[result.input.mode],
                s = active.summary;
              return (
                <>
                  <div className="planning-metrics">
                    <Metric
                      label="首批直送到店"
                      value={fmt(s.direct) + " 台"}
                      note={
                        allocation.input.source
                          ? "情景接车能力，受停车余量约束"
                          : "只占用已确认的首批接车能力"
                      }
                    />
                    <Metric
                      label="经 VPC 到店"
                      value={fmt(s.viaVpc) + " 台"}
                      note={"其中超首批能力 " + fmt(s.capacityOverflow) + " 台"}
                    />
                    <Metric
                      label="全链路费用"
                      value={fmt(s.cost) + (s.cost === null ? "" : " SAR")}
                      note={
                        "未落实 " +
                        fmt(s.unrouted) +
                        " 台 · 待排程 " +
                        fmt(s.pendingSchedule) +
                        " 台"
                      }
                    />
                  </div>
                  {tab === "map" && (
                    <DeliveryRouteMap
                      allocation={allocation}
                      delivery={result}
                    />
                  )}
                  {active.costs && (
                    <section
                      className="logistics-cost-summary"
                      data-testid="logistics-cost-summary"
                    >
                      <header>
                        <h2>物流成本拆解 · SAR</h2>
                        <p>
                          已路由车辆的费用；完整预算还需覆盖未落实路线。暂存天数为情景参数。
                        </p>
                      </header>
                      <div className="cost-breakdown-grid">
                        {(
                          [
                            ["干线运费", active.costs.linehaul],
                            ["港口处理", active.costs.portHandling],
                            ["整备 PDI", active.costs.pdi],
                            ["末端配送", active.costs.lastMile],
                            ["VPC 处理", active.costs.vpcHandling],
                            ["VPC 暂存", active.costs.storage],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label}>
                            <small>{label}</small>
                            <strong>{fmt(value)}</strong>
                          </div>
                        ))}
                      </div>
                      <p>
                        已知费用小计 {fmt(active.costs.knownTotal)} SAR ·
                        全链路费用 {fmt(active.summary.cost)}
                        {active.summary.cost === null ? "" : " SAR"}
                        {active.costs.missing.length
                          ? " · 待补：" + active.costs.missing.join("、")
                          : " · 补充费率为模拟"}
                      </p>
                    </section>
                  )}
                  {tab === "routes" && (
                    <Panel
                      title="每家门店的直送与暂存拆分"
                      note="单港和双港的最终目的地均为门店。服务 VPC 与实际经过的 VPC 分开记录。"
                    >
                      {allocation.input.source && (
                        <p className="planning-footnote">
                          路线卡预览前 6 家；下表列出全部 {active.rows.length}{" "}
                          家门店。
                        </p>
                      )}
                      <div className="planning-route-cards">
                        {active.rows
                          .slice(
                            0,
                            allocation.input.source ? 6 : active.rows.length,
                          )
                          .map((r) => (
                            <article key={r.storeId}>
                              <header>
                                <strong>{r.storeName}</strong>
                                <span>总分车 {fmt(r.total)} 台</span>
                              </header>
                              <div>
                                <Ship size={17} />
                                <span>{r.origin}</span>
                                <ArrowRight size={15} />
                                <span className="planning-route-target">
                                  {r.storeId} 门店
                                </span>
                              </div>
                              <p>
                                直送 {fmt(r.directQty)} 台 · 经 {r.serviceVpc}{" "}
                                VPC {fmt(r.viaVpcQty)} 台
                              </p>
                              <div className="planning-split-bar">
                                <i
                                  style={{
                                    width:
                                      (r.total
                                        ? (r.directQty / r.total) * 100
                                        : 0) + "%",
                                  }}
                                />
                                <b
                                  style={{
                                    width:
                                      (r.total
                                        ? (r.viaVpcQty / r.total) * 100
                                        : 0) + "%",
                                  }}
                                />
                              </div>
                              <small>
                                末批到店 {day(r.lastArrival)} · 未落实{" "}
                                {r.unroutedQty} · 待排程 {r.pendingScheduleQty}
                              </small>
                            </article>
                          ))}
                      </div>
                      <div className="planning-table-scroll">
                        <table data-testid="store-route-table">
                          <thead>
                            <tr>
                              <th>门店</th>
                              <th>发出地</th>
                              <th>服务 VPC</th>
                              <th>直送</th>
                              <th>经 VPC</th>
                              <th>未落实</th>
                              <th>待排程</th>
                              <th>末批到店</th>
                              <th>订单按期 / 延误 / 待确认</th>
                            </tr>
                          </thead>
                          <tbody>
                            {active.rows.map((r) => (
                              <tr key={r.storeId}>
                                <td>{r.storeName}</td>
                                <td>{r.origin}</td>
                                <td>{r.serviceVpc}</td>
                                <td>{fmt(r.directQty)}</td>
                                <td>{fmt(r.viaVpcQty)}</td>
                                <td>{fmt(r.unroutedQty)}</td>
                                <td>{fmt(r.pendingScheduleQty)}</td>
                                <td>{day(r.lastArrival)}</td>
                                <td>
                                  {r.orderOnTime} / {r.orderLate} /{" "}
                                  {r.orderPending}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  )}
                  {tab === "compare" && (
                    <Panel
                      title="双港与单港：同一分车结果，两种物流方案"
                      note={
                        allocation.input.source
                          ? "干线运费来自共享城市路线整趟报价，非满载按整趟计费；完整预算包含模拟补充费率，缺项或未落实路线时保持待确认。"
                          : "按全链路模拟单台报价计费，含暂存及末端运输；未落实路线时只列已知小计。"
                      }
                    >
                      <div data-testid="port-comparison">
                        <div className="planning-port-compare">
                          {(
                            [
                              ["dual", "吉达 + 达曼双港"],
                              ["single", "吉达单港"],
                            ] as const
                          ).map(([mode, label]) => (
                            <article key={mode}>
                              <small>{label}</small>
                              <strong>
                                {fmt(result[mode].summary.cost)}{" "}
                                {result[mode].summary.cost === null
                                  ? ""
                                  : "SAR"}
                              </strong>
                              <p>
                                订单按期 {result[mode].summary.orderOnTime} 台 ·
                                延误 {result[mode].summary.orderLate} 台
                              </p>
                              <span>
                                {allocation.input.source
                                  ? "干线运费小计"
                                  : "已知费用小计"}{" "}
                                {fmt(
                                  result[mode].costs?.linehaul ??
                                    result[mode].summary.knownCost,
                                )}{" "}
                                SAR
                              </span>
                            </article>
                          ))}
                        </div>
                        <p className="planning-saving">
                          双港节省 {fmt(result.saving)}{" "}
                          {result.saving === null ? "" : "SAR"}
                          {allocation.input.source
                            ? result.saving === null
                              ? "；完整成本或路线覆盖待确认。"
                              : "；使用情景补充费率的预算比较，非实际结算。"
                            : "；单港东部订单直送到店时间从 D+2 变为 D+5，基准订单交期 D+3。"}
                        </p>
                      </div>
                      <div className="planning-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>门店</th>
                              <th>单港末批</th>
                              <th>双港末批</th>
                              <th>单港干线摊分</th>
                              <th>双港干线摊分</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.single.rows.map((r, i) => (
                              <tr key={r.storeId}>
                                <td>{r.storeName}</td>
                                <td>{day(r.lastArrival)}</td>
                                <td>{day(result.dual.rows[i].lastArrival)}</td>
                                <td>{fmt(r.knownCost)}</td>
                                <td>{fmt(result.dual.rows[i].knownCost)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  )}
                  {tab === "batches" && (
                    <Panel
                      title="到店批次与订单保护"
                      note="以下均为计划到店时间；VPC 到货不等于门店签收，门店签收不等于客户交付。"
                    >
                      <div className="planning-table-scroll">
                        <table data-testid="store-batch-table">
                          <thead>
                            <tr>
                              <th>门店</th>
                              <th>路径</th>
                              <th>数量</th>
                              <th>订单 / 补库</th>
                              <th>计划到店</th>
                              <th>
                                {allocation.input.source
                                  ? "干线摊分单台费"
                                  : "全链单台费"}
                              </th>
                              <th>费用</th>
                            </tr>
                          </thead>
                          <tbody>
                            {active.batches.map((b) => (
                              <tr key={b.id}>
                                <td>{b.storeName}</td>
                                <td>
                                  {b.origin} →{" "}
                                  {b.viaVpc ? b.viaVpc + " VPC → " : ""}
                                  {b.storeId}
                                </td>
                                <td>{fmt(b.qty)}</td>
                                <td>
                                  {b.orders} / {b.replenishment}
                                </td>
                                <td>{day(b.arrivalDay)}</td>
                                <td>{fmt(b.unitCost)} SAR</td>
                                <td>{fmt(b.cost)} SAR</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  )}
                  {result.vpcStock.qty > 0 && (
                    <Panel
                      title="独立 VPC 现货发运"
                      note="独立订单、独立供给和已预留接车时段，不计入本船数量与成本。"
                    >
                      <p>
                        RUH VPC → D2 门店，20 台，D+1 到店，2,000
                        SAR。车辆直接从 VPC 发出，仅一段运输。
                      </p>
                    </Panel>
                  )}
                </>
              );
            })()
          )}
          <p className="planning-footnote">
            结果是本地规则计算的模拟计划。CUI
            的工具过程为演示记录；真实运行需接入订单、VIN、门店库存、承运报价和确认接车时段。
          </p>
        </div>
      )}
    </div>
  );
}

export default function StorePlanningWorkspace(
  props: Parameters<typeof DeliveryPlanningWorkspace>[0],
) {
  return props.run.planning?.kind === "allocation" ? (
    <AllocationPlanningWorkspace {...props} />
  ) : (
    <DeliveryPlanningWorkspace {...props} />
  );
}
