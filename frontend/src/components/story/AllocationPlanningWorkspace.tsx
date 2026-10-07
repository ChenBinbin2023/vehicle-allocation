"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { matchesLocalizedText } from "@/lib/i18n/translate";

import type { SaveVesselScenario } from "@/lib/story/vessel-scenario";
import { useEffect, useMemo, useRef, useState } from "react";
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
import VesselReplenishmentWorkspace from "./VesselReplenishmentWorkspace";
import {
  replenishmentOverview,
  replenishmentOrders,
} from "@/lib/story/vessel-replenishment";
const fmt = (n: number | null, d = 0) =>
  n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d });
type Props = {
  onSaveScenario?: SaveVesselScenario;
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
  onSaveScenario,
}: Props) {
  const { t: translateText } = useI18n();

  const snapshot = run.planning!;
  if (snapshot.kind !== "allocation") throw new Error("需要分车快照");
  const result = snapshot.result,
    { summary: s } = result;
  const current = useMemo(
    () =>
      snapshot.replenishment
        ? {
            overview: replenishmentOverview(snapshot.replenishment),
            orders: replenishmentOrders(snapshot.replenishment),
          }
        : { overview: vesselOverview, orders: vesselOrders },
    [snapshot.replenishment],
  );
  const [input, setInput] = useState<AllocationScenario>(() =>
    structuredClone(result.input),
  );
  const initialTab =
    /门店补库|补库存|预留比例|物流模拟|物流系数|基准物流成本|中转中心|利润|定价|零售系数|批发系数/.test(
      run.prompt,
    ) ||
    (!!result.input.replenishment && /重跑|参数调整/.test(run.prompt))
      ? "water"
      : /订单分车|物流建议|门店订单/.test(run.prompt)
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
  }, [run.id]);
  useEffect(() => setInput(structuredClone(result.input)), [result]);
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
  }, [event?.id, focusRevision]);
  const edited = JSON.stringify(input) !== JSON.stringify(result.input);
  const ready =
    run.blocks.find((b) => b.type === "planning-" + tab)?.status === "ready" ||
    run.status === "complete";
  const visible = result.rows.filter(
    (r) =>
      (channel === "全部" || r.channel === channel) &&
      (!search ||
        matchesLocalizedText(
          `${r.name} ${r.id} ${r.city} ${r.region}`,
          search,
        )),
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
              ? { runId: run.id, simulation: true, overview: current.overview }
              : tab === "graph"
                ? { runId: run.id, simulation: true, orders: current.orders }
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
    <nav
      className="planning-tabs"
      role="tablist"
      aria-label={translateText("分车分析")}
    >
      {[
        ["overview", "基本统计"],
        ["graph", "订单分车"],
        ["water", "分车计划模拟"],
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
          {translateText(label)}
        </button>
      ))}
    </nav>
  );
  if (
    tab === "overview" ||
    tab === "graph" ||
    (tab === "water" && snapshot.replenishment)
  ) {
    return (
      <div
        className="planning-workspace allocation-data-workspace"
        data-testid="store-planning-workspace"
      >
        <header className="planning-heading">
          <div>
            <small>
              VESSEL ALLOCATION ·{translateText(" ")}
              {translateText(
                tab === "overview"
                  ? "供需与库存"
                  : tab === "graph"
                    ? "订单与物流"
                    : "门店补库存",
              )}
            </small>
            <h1>{translateText("滚装船分车工作台")}</h1>
            <p>
              {translateText(
                "先看本船供给与全网需求，再按订单优先分车，将剩余车辆注水补库存。",
              )}
            </p>
          </div>
          <span className="planning-status">
            {translateText(
              run.status === "complete"
                ? "模拟已完成"
                : run.status === "paused"
                  ? "已暂停"
                  : "模拟中",
            )}
            {translateText(" ")}·{" "}
            {Math.min(100, Math.round((run.elapsed / run.duration) * 100))}%
          </span>
        </header>
        <div className="planning-context">
          <span>
            <Database size={14} />
            {translateText("2026-08-05 · 模拟统计快照")}
          </span>
          <span>{translateText("丰田 / 雷克萨斯 · 79 家门店")}</span>
          <button disabled={run.status !== "complete"} onClick={download}>
            <Download size={13} />
            {translateText(
              tab === "overview"
                ? "导出统计快照"
                : tab === "graph"
                  ? "导出订单与物流快照"
                  : "导出快照",
            )}
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
              <VesselOverviewDashboard data={current.overview} />
            ) : tab === "water" && snapshot.replenishment ? (
              <VesselReplenishmentWorkspace
                key={run.id}
                result={snapshot.replenishment}
                commercial={snapshot.commercial}
                versions={snapshot.versions}
                versionId={snapshot.versionId ?? "V1"}
                onSave={(parameters, reason) =>
                  onSaveScenario?.(run.id, { parameters, reason })
                }
                onSelectVersion={(versionId) =>
                  onSaveScenario?.(run.id, { versionId })
                }
                busy={busy}
                focusNode={event?.planningNode}
              />
            ) : (
              <>
                <VesselOrdersDashboard
                  key={run.id + "-" + focusRevision}
                  focusNode={event?.planningNode}
                  prompt={run.prompt}
                  data={current.orders}
                />
                <details
                  className="voa-assumptions"
                  open={
                    !!event?.planningNode &&
                    !event.planningNode.startsWith("LOGISTICS") &&
                    event.operation !== "vessel.orders.read"
                  }
                >
                  <summary>
                    {translateText("品牌注水情景 · 原分车图谱")}
                  </summary>
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
              {translateText(
                tab === "overview"
                  ? "正在汇总供给、订单、销速与库存…"
                  : tab === "water"
                    ? "正在生成门店补库与注水快照…"
                    : "正在生成门店订单与物流建议…",
              )}
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
          <h1>{translateText("订单先行，库存按门店注水")}</h1>
          <p>
            {translateText(
              "门店 × 品牌数据驱动分车，从本体依赖到每一步注水，都能查看依据。",
            )}
          </p>
        </div>
        <span className="planning-status">
          {translateText(
            run.status === "complete"
              ? "模拟已完成"
              : run.status === "paused"
                ? "已暂停"
                : "模拟中",
          )}
          {translateText(" ")}·{" "}
          {Math.min(100, Math.round((run.elapsed / run.duration) * 100))}%
        </span>
      </header>
      <div className="planning-context">
        <span>
          <Database size={14} />
          {translateText(result.input.source?.snapshot ?? "历史情景")} ·
          {translateText(" ")}
          {translateText(result.input.source?.nature ?? "模拟数据")}
        </span>
        <span>
          {translateText(result.input.brand ?? "配置")} · {result.rows.length}
          {translateText(" 家门店")}
        </span>
        <span>
          {translateText("库存 ")}
          {translateText(result.input.source?.stockDate ?? "情景快照")}
          {translateText(" · 未发布")}
        </span>
        <button disabled={run.status !== "complete"} onClick={download}>
          <Download size={13} />
          {translateText("导出快照")}
        </button>
      </div>
      <div ref={outputRef}>{tabs}</div>
      <section
        className="planning-conclusion"
        data-testid="planning-conclusion"
      >
        <small>{translateText("本轮结论")}</small>
        <p>
          {translateText(fmt(result.input.supply))}
          {translateText(" 台供给，先分订单 ")}
          <b>{translateText(fmt(s.orders))}</b>
          {translateText(" ")}
          {translateText("台、补库存 ")}
          <b>{translateText(fmt(s.replenishment))}</b>
          {translateText(" 台，留仓")}
          {translateText(" ")}
          <b>{translateText(fmt(s.retained))}</b>
          {translateText(" 台。订单缺口 ")}
          {translateText(fmt(s.orderShortage))}
          {translateText(" ")}
          {translateText("台，距目标 WoS 仍缺 ")}
          {translateText(fmt(s.replenishmentGap))}
          {translateText(" 台。")}
          {translateText(
            result.input.stores.every((r) => !r.orders) &&
              " 当前没有未配订单源数据，订单默认为 0，可在情景参数中录入。",
          )}
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
            <small>{translateText(label)}</small>
            <strong>{translateText(value)}</strong>
            <span>{translateText(note)}</span>
          </article>
        ))}
      </div>
      <details
        className="planning-panel allocation-parameters"
        hidden={!!snapshot.replenishment}
      >
        <summary>
          {translateText("情景参数与未配订单")}
          {translateText(" ")}
          <span>
            {translateText(
              edited
                ? "已调整，需模拟重跑"
                : "供给 " +
                    fmt(input.supply) +
                    " 台 · 直营 " +
                    input.targetDirect +
                    " 周 / 授权 " +
                    input.targetAuthorized +
                    " 周",
            )}
          </span>
        </summary>
        <div className="planning-controls">
          <label>
            {translateText("品牌")}
            <select
              aria-label={translateText("分车品牌")}
              value={input.brand ?? "丰田"}
              onChange={(e) => {
                const next = defaultAllocationScenario(e.target.value);
                next.supply = input.supply;
                setInput(next);
                setSelected(next.stores[0].id);
              }}
            >
              <option value={"丰田"}>{translateText("丰田")}</option>
              <option value={"雷克萨斯"}>{translateText("雷克萨斯")}</option>
            </select>
          </label>
          <label>
            {translateText("本船供给（台）")}
            <input
              aria-label={translateText("供给数量")}
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
            {translateText("直营目标 WoS")}
            <input
              aria-label={translateText("直营目标 WoS")}
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
            {translateText("授权目标 WoS")}
            <input
              aria-label={translateText("授权目标 WoS")}
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
            {translateText("直营偏移")}
            <input
              aria-label={translateText("直营注水偏移")}
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
            {translateText("授权偏移")}
            <input
              aria-label={translateText("授权注水偏移")}
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
            {translateText("同步注水")}
          </button>
          <button
            aria-pressed={input.offsetAuthorized === 0.3 && !input.offsetDirect}
            onClick={() =>
              setInput({ ...input, offsetDirect: 0, offsetAuthorized: 0.3 })
            }
          >
            {translateText("直营优先 · 授权偏移 30%")}
          </button>
        </div>
        <label className="planning-check">
          <input
            type="checkbox"
            aria-label={translateText("假设在途按期到店")}
            checked={!!input.includeTransit}
            onChange={(e) =>
              setInput({ ...input, includeTransit: e.target.checked })
            }
          />
          {translateText("假设在途按期到店，计入有效库存（来源没有 ETA）")}
        </label>
        {store && (
          <div className="allocation-order-editor">
            <label>
              {translateText("选择门店")}
              <select
                aria-label={translateText("情景订单门店")}
                value={store.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {input.stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {translateText(s.id)} · {translateText(s.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {translateText("未配订单（情景）")}
              <input
                aria-label={translateText(store.id + " 未配订单")}
                type="number"
                min="0"
                value={store.orders}
                onChange={(e) => patchStore({ orders: Number(e.target.value) })}
              />
            </label>
            <label>
              {translateText("订单交期 D+")}
              <input
                aria-label={translateText(store.id + " 订单交期")}
                type="number"
                min="0"
                value={store.dueDay}
                onChange={(e) => patchStore({ dueDay: Number(e.target.value) })}
              />
            </label>
            <label>
              {translateText("分车上限（空白不限）")}
              <input
                aria-label={translateText(store.id + " 分车上限")}
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
          {translateText(
            "已锁库存不等于本船待分订单。未配订单需要独立输入，默认 0。无车型与 VIN 明细，本轮仅展示品牌级分车；品牌切换后分别计算。",
          )}
        </p>
        <div className="planning-action-row">
          <button className="planning-primary" disabled={busy} onClick={rerun}>
            <Play size={14} />
            {translateText("模拟重跑")}
          </button>
          <span>
            {translateText(
              edited ? "调整尚未进入当前快照" : "每轮保留独立快照",
            )}
          </span>
          {translateText(
            error && (
              <p role="alert" className="planning-error">
                {translateText(error)}
              </p>
            ),
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
            {translateText("正在读取数据和执行分车…")}
          </div>
        ) : tab === "water" ? (
          <WaterfillPlayer key={run.id} result={result} />
        ) : (
          <section className="planning-panel">
            <header>
              <h2>{translateText("门店分车结果")}</h2>
              <p>
                {translateText("全部 ")}
                {result.rows.length}
                {translateText(" ")}
                {translateText(
                  "家门店，来源数字与情景分配并列；点击门店可切换情景订单编辑对象。",
                )}
              </p>
            </header>
            <div className="allocation-filters">
              <input
                aria-label={translateText("搜索分车门店")}
                placeholder={translateText("搜索门店、城市或编码")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label>
                {translateText("渠道")}
                <select
                  aria-label={translateText("分车渠道")}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value={"全部"}>{translateText("全部")}</option>
                  <option value={"直营"}>{translateText("直营")}</option>
                  <option value={"授权"}>{translateText("授权")}</option>
                </select>
              </label>
              <span>
                {visible.length} / {result.rows.length}
                {translateText(" 家")}
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
                      <th key={h}>{translateText(h)}</th>
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
                          {translateText(r.name)}
                        </button>
                        <small>
                          {translateText(r.id)} · {translateText(r.brand)} ·{" "}
                          {translateText(r.city)}
                        </small>
                      </td>
                      <td>{translateText(r.channel)}</td>
                      <td>{translateText(fmt(r.weeklySales, 2))}</td>
                      <td>{translateText(fmt(r.availableStock))}</td>
                      <td>{translateText(fmt(r.transit ?? 0))}</td>
                      <td>
                        {r.orders} → {r.orderAllocated}
                      </td>
                      <td className="planning-accent">{r.replenishment}</td>
                      <td>
                        <b>{r.total}</b>
                      </td>
                      <td>
                        {translateText(fmt(r.beforeWos, 2))} →{" "}
                        {translateText(fmt(r.afterWos, 2))} /
                        {translateText(" ")}
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
        <p>
          {translateText(
            "分车归属已到门店，接下来模拟首批直送、VPC 暂存和后续到店批次。",
          )}
        </p>
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
          {translateText("生成到店物流模拟")}
          <ArrowRight size={14} />
        </button>
      </div>
      <details className="planning-input-details allocation-provenance">
        <summary>{translateText("数据来源与统计窗口")}</summary>
        {snapshot.replenishment ? (
          <>
            <p>
              {translateText(
                "沿用本船基础统计与订单分车的 2026-08-05 模拟快照；八周销速窗口为 2026-06-08—08-02，门店库存与 VPC 原有库存分别统计。",
              )}
            </p>
            <p>
              {translateText("门店 × 车型库存和销速为模拟分摊；本轮预留")}
              {translateText(" ")}
              {translateText(fmt(snapshot.replenishment.summary.reserved))}
              {translateText(" 台，未分配")}
              {translateText(" ")}
              {translateText(fmt(snapshot.replenishment.summary.retained))}
              {translateText(" ")}
              {translateText("台。参数、分车结果与下游物流均保存到本轮快照。")}
            </p>
          </>
        ) : (
          <>
            <p>
              {translateText(
                "data/00_客户/门店主数据.csv · data/02_销速/销速汇总_门店.csv · data/03_库存/当前库存_门店.csv",
              )}
            </p>
            <p>
              {translateText(
                "直营销速：2026-06-01—07-26（8 周）；授权销速：2026-05-01—07-31（92 天折周）。库存快照：2026-09-29。销速与库存日期存在间隔，保留来源口径，不当作到店日预测。",
              )}
            </p>
            <p>
              {translateText(
                "模拟数据 H_MOCK_20260929_V1；仅品牌级数据。1800 台船量、未配订单、在途按期与接车条件为情景输入。",
              )}
            </p>
          </>
        )}
      </details>
    </div>
  );
}
