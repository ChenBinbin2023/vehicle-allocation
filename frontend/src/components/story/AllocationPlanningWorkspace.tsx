"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Play, Database } from "lucide-react";
import {
  calculateStoreAllocation,
  defaultAllocationScenario,
  defaultDeliveryScenario,
  type AllocationScenario,
  type PlanningInput,
} from "@/lib/story/store-planning";
import type { StoryCommand, StoryRun } from "@/lib/story/types";
import AllocationGraph from "./AllocationGraph";
import WaterfillPlayer from "./WaterfillPlayer";
import VesselOverviewDashboard from "./VesselOverviewDashboard";
import { vesselOverview } from "@/lib/story/vessel-overview";
import VesselOrdersDashboard from "./VesselOrdersDashboard";
import { vesselOrders } from "@/lib/story/vessel-orders";
const fmt = (n: number | null, d = 0) =>
  n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });
type Props = {
  run: StoryRun;
  focusedStep: number | null;
  focusRevision: number;
  busy: boolean;
  onRunPlanning: (
    command: StoryCommand,
    input: PlanningInput,
    allocationRunId?: string,
  ) => void;
};
export default function AllocationPlanningWorkspace({
  run,
  focusedStep,
  focusRevision,
  busy,
  onRunPlanning,
}: Props) {
  const snapshot = run.planning!;
  if (snapshot.kind !== "allocation") throw new Error("需要分车快照");
  const result = snapshot.result,
    { summary: s } = result;
  const [input, setInput] = useState<AllocationScenario>(() =>
    structuredClone(result.input),
  );
  const initialTab = /订单分车|物流建议|门店订单/.test(run.prompt)
    ? "graph"
    : "overview";
  const [tab, setTab] = useState(initialTab),
    [channel, setChannel] = useState("全部"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(result.rows[0]?.id),
    [error, setError] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setInput(structuredClone(result.input));
    setTab(initialTab);
    setSelected(result.rows[0]?.id);
    setError("");
  }, [run.id, result]);
  const event = focusedStep === null ? undefined : run.events[focusedStep];
  useEffect(() => {
    if (
      event?.planningTab &&
      ["overview", "graph", "water", "allocation"].includes(event.planningTab)
    ) {
      setTab(event.planningTab);
      const frame = requestAnimationFrame(() =>
        outputRef.current?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [event, focusRevision]);
  const edited = JSON.stringify(input) !== JSON.stringify(result.input);
  const ready =
    run.blocks.find((b) => b.type === "planning-" + tab)?.status === "ready" ||
    run.status === "complete";
  const visible = result.rows.filter(
    (r) =>
      (channel === "全部" || r.channel === channel) &&
      (!search || `${r.name} ${r.id} ${r.city} ${r.region}`.includes(search)),
  );
  const store = input.stores.find((r) => r.id === selected) ?? input.stores[0];
  function patchStore(patch: Partial<typeof store>) {
    setInput({
      ...input,
      stores: input.stores.map((s) =>
        s.id === store.id ? { ...s, ...patch } : s,
      ),
    });
  }
  function rerun() {
    try {
      calculateStoreAllocation(input);
      setError("");
      onRunPlanning("/vessel-allocation", input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "参数无效");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            tab === "overview"
              ? { runId: run.id, simulation: true, overview: vesselOverview }
              : tab === "graph"
                ? { runId: run.id, simulation: true, orders: vesselOrders }
                : { runId: run.id, simulation: true, ...snapshot },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      run.id +
      (tab === "overview" ? "-overview" : tab === "graph" ? "-orders" : "") +
      ".json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const tabs = (
    <nav className="planning-tabs" role="tablist" aria-label="分车分析">
      {[
        ["overview", "基本统计"],
        ["graph", "订单分车"],
        ["water", "注水演示"],
        ["allocation", "门店结果"],
      ].map(([id, label], index, items) => (
        <button
          role="tab"
          aria-selected={tab === id}
          aria-controls={`allocation-panel-${run.id}-${id}`}
          id={`allocation-tab-${run.id}-${id}`}
          tabIndex={tab === id ? 0 : -1}
          key={id}
          onClick={() => setTab(id)}
          onKeyDown={(e) => {
            const next =
              e.key === "ArrowRight"
                ? (index + 1) % items.length
                : e.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : null;
            if (next === null) return;
            e.preventDefault();
            setTab(items[next][0]);
            e.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>("button")
              [next]?.focus();
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
  if (tab === "overview" || tab === "graph") {
    return (
      <div
        className="planning-workspace allocation-data-workspace"
        data-testid="store-planning-workspace"
      >
        <header className="planning-heading">
          <div>
            <small>
              VESSEL ALLOCATION ·{" "}
              {tab === "overview" ? "供需与库存" : "订单与物流"}
            </small>
            <h1>滚装船分车工作台</h1>
            <p>先看本船供给与全网需求，再查看订单分车、物流建议和门店结果。</p>
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
            <Database size={14} />
            2026-08-05 · 模拟统计快照
          </span>
          <span>丰田 / 雷克萨斯 · 79 家门店</span>
          <button disabled={run.status !== "complete"} onClick={download}>
            <Download size={13} />
            {tab === "overview" ? "导出统计快照" : "导出订单与物流快照"}
          </button>
        </div>
        <div ref={outputRef}>{tabs}</div>
        <section
          role="tabpanel"
          id={`allocation-panel-${run.id}-${tab}`}
          aria-labelledby={`allocation-tab-${run.id}-${tab}`}
        >
          {ready ? (
            tab === "overview" ? (
              <VesselOverviewDashboard />
            ) : (
              <>
                <VesselOrdersDashboard
                  key={run.id + "-" + focusRevision}
                  focusNode={event?.planningNode}
                  prompt={run.prompt}
                />
                <details
                  className="voa-assumptions"
                  open={
                    !!event?.planningNode &&
                    !event.planningNode.startsWith("LOGISTICS") &&
                    event.operation !== "vessel.orders.read"
                  }
                >
                  <summary>品牌注水情景 · 原分车图谱</summary>
                  <AllocationGraph
                    key={run.id + "-" + focusRevision}
                    result={result}
                    focusNode={event?.planningNode}
                  />
                </details>
              </>
            )
          ) : (
            <div className="planning-loading">
              <i />
              {tab === "overview"
                ? "正在汇总供给、订单、销速与库存…"
                : "正在生成门店订单与物流建议…"}
            </div>
          )}
        </section>
      </div>
    );
  }
  return (
    <div
      className="planning-workspace allocation-data-workspace"
      data-testid="store-planning-workspace"
    >
      <header className="planning-heading">
        <div>
          <small>STORE ALLOCATION · PRODUCT SKILL</small>
          <h1>订单先行，库存按门店注水</h1>
          <p>门店 × 品牌数据驱动分车，从本体依赖到每一步注水，都能查看依据。</p>
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
          <Database size={14} />
          {result.input.source?.snapshot ?? "历史情景"} ·{" "}
          {result.input.source?.nature ?? "模拟数据"}
        </span>
        <span>
          {result.input.brand ?? "配置"} · {result.rows.length} 家门店
        </span>
        <span>
          库存 {result.input.source?.stockDate ?? "情景快照"} · 未发布
        </span>
        <button disabled={run.status !== "complete"} onClick={download}>
          <Download size={13} />
          导出快照
        </button>
      </div>
      <div ref={outputRef}>{tabs}</div>
      <section
        className="planning-conclusion"
        data-testid="planning-conclusion"
      >
        <small>本轮结论</small>
        <p>
          {fmt(result.input.supply)} 台供给，先分订单 <b>{fmt(s.orders)}</b>{" "}
          台、补库存 <b>{fmt(s.replenishment)}</b> 台，留仓{" "}
          <b>{fmt(s.retained)}</b> 台。订单缺口 {fmt(s.orderShortage)}{" "}
          台，距目标 WoS 仍缺 {fmt(s.replenishmentGap)} 台。
          {result.input.stores.every((r) => !r.orders) &&
            " 当前没有未配订单源数据，订单默认为 0，可在情景参数中录入。"}
        </p>
      </section>
      <div className="planning-metrics allocation-summary">
        {[
          ["已订订单", fmt(s.orders) + " 台", "交期优先 · 与补库单列"],
          [
            "注水补库",
            fmt(s.replenishment) + " 台",
            `${result.rows.filter((r) => r.replenishment > 0).length} 家门店获得补库`,
          ],
          [
            "目标剩余缺口",
            fmt(s.replenishmentGap) + " 台",
            `留仓 ${fmt(s.retained)} 台 · 数量守恒`,
          ],
        ].map(([label, value, note]) => (
          <article className="planning-metric" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{note}</span>
          </article>
        ))}
      </div>
      <details className="planning-panel allocation-parameters">
        <summary>
          情景参数与未配订单{" "}
          <span>
            {edited
              ? "已调整，需模拟重跑"
              : "供给 " +
                fmt(input.supply) +
                " 台 · 直营 " +
                input.targetDirect +
                " 周 / 授权 " +
                input.targetAuthorized +
                " 周"}
          </span>
        </summary>
        <div className="planning-controls">
          <label>
            品牌
            <select
              aria-label="分车品牌"
              value={input.brand ?? "丰田"}
              onChange={(e) => {
                const next = defaultAllocationScenario(e.target.value);
                next.supply = input.supply;
                setInput(next);
                setSelected(next.stores[0].id);
              }}
            >
              <option>丰田</option>
              <option>雷克萨斯</option>
            </select>
          </label>
          <label>
            本船供给（台）
            <input
              aria-label="供给数量"
              type="number"
              min="0"
              max="100000"
              value={input.supply}
              onChange={(e) =>
                setInput({ ...input, supply: Number(e.target.value) })
              }
            />
          </label>
          <label>
            直营目标 WoS
            <input
              aria-label="直营目标 WoS"
              type="number"
              min=".1"
              step=".5"
              value={input.targetDirect}
              onChange={(e) =>
                setInput({ ...input, targetDirect: Number(e.target.value) })
              }
            />
          </label>
          <label>
            授权目标 WoS
            <input
              aria-label="授权目标 WoS"
              type="number"
              min=".1"
              step=".5"
              value={input.targetAuthorized}
              onChange={(e) =>
                setInput({ ...input, targetAuthorized: Number(e.target.value) })
              }
            />
          </label>
          <label>
            直营偏移
            <input
              aria-label="直营注水偏移"
              type="number"
              min="0"
              max="1"
              step=".1"
              value={input.offsetDirect ?? 0}
              onChange={(e) =>
                setInput({ ...input, offsetDirect: Number(e.target.value) })
              }
            />
          </label>
          <label>
            授权偏移
            <input
              aria-label="授权注水偏移"
              type="number"
              min="0"
              max="1"
              step=".1"
              value={input.offsetAuthorized ?? 0}
              onChange={(e) =>
                setInput({ ...input, offsetAuthorized: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="planning-presets">
          <button
            aria-pressed={!(input.offsetDirect || input.offsetAuthorized)}
            onClick={() =>
              setInput({ ...input, offsetDirect: 0, offsetAuthorized: 0 })
            }
          >
            同步注水
          </button>
          <button
            aria-pressed={input.offsetAuthorized === 0.3 && !input.offsetDirect}
            onClick={() =>
              setInput({ ...input, offsetDirect: 0, offsetAuthorized: 0.3 })
            }
          >
            直营优先 · 授权偏移 30%
          </button>
        </div>
        <label className="planning-check">
          <input
            type="checkbox"
            aria-label="假设在途按期到店"
            checked={!!input.includeTransit}
            onChange={(e) =>
              setInput({ ...input, includeTransit: e.target.checked })
            }
          />
          假设在途按期到店，计入有效库存（来源没有 ETA）
        </label>
        {store && (
          <div className="allocation-order-editor">
            <label>
              选择门店
              <select
                aria-label="情景订单门店"
                value={store.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {input.stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.id} · {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              未配订单（情景）
              <input
                aria-label={store.id + " 未配订单"}
                type="number"
                min="0"
                value={store.orders}
                onChange={(e) => patchStore({ orders: Number(e.target.value) })}
              />
            </label>
            <label>
              订单交期 D+
              <input
                aria-label={store.id + " 订单交期"}
                type="number"
                min="0"
                value={store.dueDay}
                onChange={(e) => patchStore({ dueDay: Number(e.target.value) })}
              />
            </label>
            <label>
              分车上限（空白不限）
              <input
                aria-label={store.id + " 分车上限"}
                type="number"
                min="0"
                value={store.allocationCap ?? ""}
                onChange={(e) =>
                  patchStore({
                    allocationCap:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        )}
        <p className="planning-footnote">
          已锁库存不等于本船待分订单。未配订单需要独立输入，默认 0。无车型与 VIN
          明细，本轮仅展示品牌级分车；品牌切换后分别计算。
        </p>
        <div className="planning-action-row">
          <button className="planning-primary" disabled={busy} onClick={rerun}>
            <Play size={14} />
            模拟重跑
          </button>
          <span>{edited ? "调整尚未进入当前快照" : "每轮保留独立快照"}</span>
          {error && (
            <p role="alert" className="planning-error">
              {error}
            </p>
          )}
        </div>
      </details>
      <div
        className="allocation-output"
        role="tabpanel"
        id={`allocation-panel-${run.id}-${tab}`}
        aria-labelledby={`allocation-tab-${run.id}-${tab}`}
      >
        {!ready ? (
          <div className="planning-loading">
            <i />
            正在读取数据和执行分车…
          </div>
        ) : tab === "water" ? (
          <WaterfillPlayer key={run.id} result={result} />
        ) : (
          <section className="planning-panel">
            <header>
              <h2>门店分车结果</h2>
              <p>
                全部 {result.rows.length}{" "}
                家门店，来源数字与情景分配并列；点击门店可切换情景订单编辑对象。
              </p>
            </header>
            <div className="allocation-filters">
              <input
                aria-label="搜索分车门店"
                placeholder="搜索门店、城市或编码"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label>
                渠道
                <select
                  aria-label="分车渠道"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option>全部</option>
                  <option>直营</option>
                  <option>授权</option>
                </select>
              </label>
              <span>
                {visible.length} / {result.rows.length} 家
              </span>
            </div>
            <div className="planning-table-scroll allocation-result-table">
              <table data-testid="store-allocation-table">
                <thead>
                  <tr>
                    {[
                      "门店 / 品牌",
                      "渠道",
                      "周销速",
                      "自由库存",
                      "在途",
                      "情景订单 → 已分",
                      "补库",
                      "分车合计",
                      "WoS 前 → 后 / 目标",
                      "剩余缺口",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} data-testid={"allocation-" + r.id}>
                      <td>
                        <button
                          onClick={() => {
                            setSelected(r.id);
                            document.querySelector<HTMLDetailsElement>(
                              ".allocation-parameters",
                            )!.open = true;
                          }}
                        >
                          {r.name}
                        </button>
                        <small>
                          {r.id} · {r.brand} · {r.city}
                        </small>
                      </td>
                      <td>{r.channel}</td>
                      <td>{fmt(r.weeklySales, 2)}</td>
                      <td>{fmt(r.availableStock)}</td>
                      <td>{fmt(r.transit ?? 0)}</td>
                      <td>
                        {r.orders} → {r.orderAllocated}
                      </td>
                      <td className="planning-accent">{r.replenishment}</td>
                      <td>
                        <b>{r.total}</b>
                      </td>
                      <td>
                        {fmt(r.beforeWos, 2)} → {fmt(r.afterWos, 2)} /{" "}
                        {r.targetWeeks}
                      </td>
                      <td>{r.gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      <div className="allocation-next">
        <p>分车归属已到门店，接下来模拟首批直送、VPC 暂存和后续到店批次。</p>
        <button
          className="planning-primary"
          disabled={busy || run.status !== "complete"}
          onClick={() =>
            onRunPlanning(
              "/delivery-plan",
              defaultDeliveryScenario(result),
              run.id,
            )
          }
        >
          生成到店物流模拟
          <ArrowRight size={14} />
        </button>
      </div>
      <details className="planning-input-details allocation-provenance">
        <summary>数据来源与统计窗口</summary>
        <p>
          data/00_客户/门店主数据.csv · data/02_销速/销速汇总_门店.csv ·
          data/03_库存/当前库存_门店.csv
        </p>
        <p>
          直营销速：2026-06-01—07-26（8 周）；授权销速：2026-05-01—07-31（92
          天折周）。库存快照：2026-09-29。销速与库存日期存在间隔，保留来源口径，不当作到店日预测。
        </p>
        <p>
          模拟数据 H_MOCK_20260929_V1；仅品牌级数据。1800
          台船量、未配订单、在途按期与接车条件为情景输入。
        </p>
      </details>
    </div>
  );
}
