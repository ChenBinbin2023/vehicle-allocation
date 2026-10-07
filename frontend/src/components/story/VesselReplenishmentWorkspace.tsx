"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Play, SlidersHorizontal } from "lucide-react";
import {
  calculateVesselReplenishment,
  type ReplenishmentParameters,
  type VesselReplenishment,
} from "@/lib/story/vessel-replenishment";
import {
  calculateCommercial,
  defaultCommercialParameters,
  type CommercialParameters,
  type CommercialResult,
} from "@/lib/story/vessel-commercial";
import type { VesselScenarioVersion } from "@/lib/story/vessel-scenario";
import VesselGlobalSimulator from "./VesselGlobalSimulator";
import { StreamBlock } from "./SkillStream";
import VesselCommercialParameters from "./VesselCommercialParameters";
import {
  CommercialLogisticsView,
  CommercialProfitView,
} from "./VesselCommercialViews";
import ReplenishmentGraph from "./ReplenishmentGraph";
import ReplenishmentWaterChart from "./ReplenishmentWaterChart";
const fmt = (n: number, d = 0) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
const normalized = (p: ReplenishmentParameters) => ({
  ...structuredClone(p),
  commercial: structuredClone(p.commercial ?? defaultCommercialParameters()),
});
function SectionHeading({
  number,
  english,
  title,
  note,
}: {
  number: string;
  english: string;
  title: string;
  note: string;
}) {
  const { t: translateText } = useI18n();

  return (
    <header className="vs-section-heading">
      <span className="vs-section-number">{translateText(number)}</span>
      <div>
        <small>{translateText(english)}</small>
        <h2>{translateText(title)}</h2>
        <p>{translateText(note)}</p>
      </div>
    </header>
  );
}
function MiniTabs({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: string[][];
  value: string;
  onChange: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  return (
    <nav
      className="vc-mini-tabs vs-section-tabs"
      role="tablist"
      aria-label={translateText(label)}
    >
      {items.map(([id, name]) => (
        <button
          type="button"
          role="tab"
          key={id}
          aria-selected={value === id}
          onClick={() => onChange(id)}
        >
          {translateText(name)}
        </button>
      ))}
    </nav>
  );
}
export default function VesselReplenishmentWorkspace({
  result: savedResult,
  busy,
  focusNode,
  commercial,
  versions,
  versionId,
  onSave,
  onSelectVersion,
}: {
  result: VesselReplenishment;
  busy: boolean;
  focusNode?: string;
  commercial?: CommercialResult;
  versions?: VesselScenarioVersion[];
  versionId: string;
  onSave: (p: ReplenishmentParameters, reason: string) => void;
  onSelectVersion: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  const [parameters, setParameters] = useState(() =>
    normalized(savedResult.parameters),
  );
  const latest = useRef(parameters);
  const [parameterTab, setParameterTab] = useState("allocation"),
    [planTab, setPlanTab] = useState("graph"),
    [logisticsTab, setLogisticsTab] = useState("map"),
    [profitTab, setProfitTab] = useState("unit");
  const [selected, setSelected] = useState(savedResult.stores[0].id),
    [selectedModel, setSelectedModel] = useState(
      savedResult.stores[0].models[0].model,
    );
  const [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [progress, setProgress] = useState(savedResult.summary.budget),
    [saveError, setError] = useState("");
  useEffect(() => {
    const next = normalized(savedResult.parameters);
    setParameters(next);
    latest.current = next;
    setError("");
  }, [savedResult]);
  const deferred = useDeferredValue(parameters);
  const preview = useMemo(() => {
    try {
      const allocation = calculateVesselReplenishment(deferred);
      return {
        allocation,
        commercial: calculateCommercial(allocation),
        error: "",
      };
    } catch (e) {
      return {
        allocation: savedResult,
        commercial: commercial ?? calculateCommercial(savedResult),
        error: e instanceof Error ? e.message : "参数无效",
      };
    }
  }, [deferred, savedResult, commercial]);
  // Only the global financial preview follows the draft. All detail panels
  // share the applied snapshot until the user runs the simulation.
  const result = savedResult;
  const currentCommercial = useMemo(
    () => commercial ?? calculateCommercial(savedResult),
    [commercial, savedResult],
  );
  const error = preview.error || saveError;
  useEffect(() => {
    setProgress(result.summary.budget);
    setPlaying(false);
  }, [result]);
  useEffect(() => {
    if (!playing || busy) return;
    const timer = window.setInterval(
      () =>
        setProgress((n) =>
          Math.min(
            result.summary.budget,
            n + Math.max(1, Math.ceil(result.summary.budget / 80)),
          ),
        ),
      180 / speed,
    );
    return () => window.clearInterval(timer);
  }, [playing, busy, result, speed]);
  useEffect(() => {
    if (progress >= result.summary.budget) setPlaying(false);
  }, [progress, result.summary.budget]);
  const frame = useMemo(
    () =>
      planTab !== "water" || progress === result.summary.budget
        ? result
        : calculateVesselReplenishment(result.parameters, progress),
    [result, progress, planTab],
  );
  const store =
    result.stores.find((s) => s.id === selected) ?? result.stores[0];
  const model = store.models.some((m) => m.model === selectedModel)
    ? selectedModel
    : store.models[0].model;
  const factor = parameters.storeFactors[store.id] ?? {
    salesFactor: 1,
    performance: false,
  };
  function chooseModel(id: string) {
    setSelectedModel(id);
    if (!store.models.some((m) => m.model === id))
      setSelected(
        result.stores.find((s) => s.models.some((m) => m.model === id))!.id,
      );
  }
  const edited =
    JSON.stringify(parameters) !==
    JSON.stringify(normalized(savedResult.parameters));
  function change(next: ReplenishmentParameters) {
    const full = {
      ...next,
      commercial: next.commercial ?? defaultCommercialParameters(),
    };
    latest.current = full;
    setParameters(full);
    setError("");
  }
  function save(
    p: ReplenishmentParameters = latest.current,
    reason = "运行模拟",
  ) {
    if (busy) return;
    try {
      calculateCommercial(calculateVesselReplenishment(p));
      setError("");
      onSave(p, reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "参数无效");
    }
  }
  function patch(p: Partial<ReplenishmentParameters>) {
    const next = { ...parameters, ...p };
    change(next);
  }
  function patchStore(p: Partial<typeof factor>, id = store.id) {
    const next = {
      ...parameters,
      storeFactors: {
        ...parameters.storeFactors,
        [id]: {
          ...(parameters.storeFactors[id] ?? {
            salesFactor: 1,
            performance: false,
          }),
          ...p,
        },
      },
    };
    change(next);
  }
  function commercialChange(input: CommercialParameters) {
    change({ ...parameters, commercial: input });
  }
  function balanced() {
    const next = { ...parameters, channelGap: 0.1 };
    change(next);
  }
  function selectors(scope: string) {
    return (
      <div className="vc-context-selectors">
        <label>
          {translateText("门店")}
          <select
            aria-label={translateText(scope + "门店")}
            value={store.id}
            onChange={(e) => setSelected(e.target.value)}
          >
            {result.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {translateText(s.shortName)} · {translateText(s.name)} ·{" "}
                {translateText(s.channel)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {translateText("车型")}
          <select
            aria-label={translateText(scope + "车型")}
            value={model}
            onChange={(e) => chooseModel(e.target.value)}
          >
            {store.models.map((m) => (
              <option key={m.model} value={m.model}>
                {translateText(m.model)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }
  const s = result.summary;
  const channels = (["直营", "授权"] as const).map((channel) => ({
    channel,
    quantity: result.stores
      .filter((s) => s.channel === channel)
      .reduce((n, s) => n + s.replenishment, 0),
  }));
  return (
    <div
      className="vessel-replenishment vessel-simulation"
      data-testid="vessel-replenishment"
    >
      <div className="vs-intro">
        <div>
          <small>ALLOCATION PLANNING SIMULATOR</small>
          <h2>{translateText("分车计划模拟")}</h2>
          <p>
            {translateText("调整补库、物流与价格，查看同一份计划的经营结果。")}
          </p>
        </div>
        <span>{translateText("订单优先 · 补库经营测算")}</span>
      </div>
      <div className="vc-version-bar">
        <label>
          {translateText("情景版本")}
          {translateText(" ")}
          <select
            aria-label={translateText("情景版本")}
            value={versionId}
            disabled={busy}
            onChange={(e) => onSelectVersion(e.target.value)}
          >
            {(versions ?? [{ id: "V1", reason: "初始情景" }]).map((v) => (
              <option key={v.id} value={v.id}>
                {translateText(v.id)} · {translateText(v.reason)}
              </option>
            ))}
          </select>
        </label>
        <strong data-testid="scenario-version">
          {translateText(versionId)}
        </strong>
        <span>
          {translateText("运行模拟后保存版本 · 可从历史版本继续调整")}
        </span>
        <details>
          <summary>
            {translateText("版本记录 (")}
            {versions?.length ?? 1})
          </summary>
          <ol>
            {(versions ?? []).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectVersion(v.id)}
                >
                  {translateText(v.id)}
                </button>
                <span>
                  {translateText(v.reason)} ·{" "}
                  {translateText(v.parentId ? "基于 " + v.parentId : "初始")} ·
                  {translateText(" ")}
                  {translateText(
                    new Date(v.createdAt).toLocaleString("zh-CN", {
                      hour12: false,
                    }),
                  )}
                </span>
              </li>
            ))}
          </ol>
        </details>
      </div>

      <StreamBlock name="simulation-global">
        <section className="vs-section" aria-label={translateText("全局模拟")}>
          <SectionHeading
            number="01"
            english="GLOBAL SCENARIO SIMULATION"
            title={translateText("全局模拟")}
            note="拖动滑杆，实时预览营收、利润与物流费用；点击运行模拟，统一更新下方计划并保存版本。"
          />
          <VesselGlobalSimulator
            parameters={parameters}
            result={error ? undefined : preview.commercial}
            baseline={currentCommercial}
            disabled={busy}
            pending={parameters !== deferred}
            edited={edited}
            error={error}
            onChange={change}
            onCommit={() => save()}
            onReset={() => {
              const next = normalized(
                versions?.[0]?.parameters ?? savedResult.parameters,
              );
              change(next);
            }}
            advanced={
              <details className="vs-advanced">
                <summary>
                  <SlidersHorizontal size={14} />
                  {translateText("精细参数 · 供给、门店、车型与成本")}
                </summary>
                <form
                  className="vr-parameters vr-panel"
                  noValidate
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      e.target instanceof HTMLInputElement &&
                      e.target.type === "number"
                    ) {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    save();
                  }}
                >
                  <header className="vr-panel-heading">
                    <div>
                      <small>DETAILED ASSUMPTIONS</small>
                      <h3>
                        <SlidersHorizontal size={15} />
                        {translateText(" 精细参数")}
                      </h3>
                    </div>
                    <span>
                      {translateText(
                        edited
                          ? "参数待运行 · 点击运行后更新计划"
                          : "当前快照参数",
                      )}
                    </span>
                  </header>
                  <nav
                    className="vc-mini-tabs vc-parameter-tabs"
                    role="tablist"
                    aria-label={translateText("情景参数分类")}
                  >
                    {[
                      ["allocation", "分车参数"],
                      ["logistics", "物流参数"],
                      ["pricing", "定价参数"],
                    ].map(([id, label]) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={parameterTab === id}
                        key={id}
                        onClick={() => setParameterTab(id)}
                      >
                        {translateText(label)}
                      </button>
                    ))}
                  </nav>
                  {parameterTab === "allocation" ? (
                    <fieldset disabled={busy} className="vc-fieldset">
                      <div className="vr-parameter-grid">
                        <label>
                          <span>
                            {translateText("本船总量 ")}
                            <small>{translateText("台")}</small>
                          </span>
                          <input
                            aria-label={translateText("本船总量")}
                            type="number"
                            min="0"
                            max="100000"
                            step="1"
                            value={
                              Number.isNaN(parameters.supply)
                                ? ""
                                : parameters.supply
                            }
                            onChange={(e) =>
                              patch({ supply: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("预留比例 ")}
                            <small>%</small>
                          </span>
                          <input
                            aria-label={translateText("预留比例")}
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={parameters.reserveRatio * 100}
                            onChange={(e) =>
                              patch({
                                reserveRatio: Number(e.target.value) / 100,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("基准目标 WoS ")}
                            <small>{translateText("周")}</small>
                          </span>
                          <input
                            aria-label={translateText("精细 · 基准目标 WoS")}
                            type="number"
                            min=".1"
                            max="52"
                            step=".1"
                            value={parameters.baseWos}
                            onChange={(e) =>
                              patch({ baseWos: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("直营 / 授权级差 ")}
                            <small>{translateText("百分点")}</small>
                          </span>
                          <input
                            aria-label={translateText("直营与授权级差")}
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={parameters.channelGap * 100}
                            onChange={(e) =>
                              patch({
                                channelGap: Number(e.target.value) / 100,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("直营目标 WoS 系数 ")}
                            <small>×</small>
                          </span>
                          <input
                            aria-label={translateText(
                              "精细 · 直营目标 WoS 系数",
                            )}
                            type="number"
                            min=".1"
                            max="5"
                            step=".05"
                            value={parameters.directTargetFactor}
                            onChange={(e) =>
                              patch({
                                directTargetFactor: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("绩效目标 WoS 系数 ")}
                            <small>×</small>
                          </span>
                          <input
                            aria-label={translateText(
                              "精细 · 绩效目标 WoS 系数",
                            )}
                            type="number"
                            min=".1"
                            max="5"
                            step=".05"
                            value={parameters.performanceTargetFactor}
                            onChange={(e) =>
                              patch({
                                performanceTargetFactor: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("畅销 / 滞销搭配 ")}
                            <small>{translateText("台 : 台")}</small>
                          </span>
                          <div className="vr-pair-input">
                            <input
                              aria-label={translateText("畅销滞销搭配比例")}
                              type="number"
                              min="1"
                              max="100"
                              step="1"
                              disabled={!parameters.pairingEnabled}
                              value={parameters.hotPerSlow}
                              onChange={(e) =>
                                patch({ hotPerSlow: Number(e.target.value) })
                              }
                            />
                            <span>: 1</span>
                          </div>
                        </label>
                        <label>
                          <span>
                            {translateText("当前门店销速系数 ")}
                            <small>×</small>
                          </span>
                          <input
                            aria-label={translateText("门店销速系数")}
                            type="number"
                            min=".1"
                            max="5"
                            step=".05"
                            value={factor.salesFactor}
                            onChange={(e) =>
                              patchStore({
                                salesFactor: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("补库直送比例 ")}
                            <small>%</small>
                          </span>
                          <input
                            aria-label={translateText("补库直送比例")}
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={parameters.directDeliveryRatio * 100}
                            onChange={(e) =>
                              patch({
                                directDeliveryRatio:
                                  Number(e.target.value) / 100,
                              })
                            }
                          />
                        </label>
                        <label>
                          <span>
                            {translateText("板车容量 ")}
                            <small>{translateText("台 / 车")}</small>
                          </span>
                          <select
                            aria-label={translateText("补库板车容量")}
                            value={parameters.truckCapacity}
                            onChange={(e) =>
                              patch({ truckCapacity: Number(e.target.value) })
                            }
                          >
                            {[8, 9, 10].map((n) => (
                              <option key={n} value={n}>
                                {n}
                                {translateText(" 台")}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="vr-store-settings">
                        <label>
                          {translateText("配置门店")}
                          {translateText(" ")}
                          <select
                            aria-label={translateText("系数配置门店")}
                            value={store.id}
                            onChange={(e) => setSelected(e.target.value)}
                          >
                            {result.stores.map((s) => (
                              <option key={s.id} value={s.id}>
                                {translateText(s.shortName)} ·{" "}
                                {translateText(s.name)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="vr-check">
                          <input
                            type="checkbox"
                            aria-label={translateText("本店绩效加成")}
                            checked={factor.performance}
                            onChange={(e) =>
                              patchStore(
                                { performance: e.target.checked },
                                store.id,
                              )
                            }
                          />
                          {translateText("本店参与绩效加成")}
                        </label>
                        <label className="vr-check">
                          <input
                            type="checkbox"
                            aria-label={translateText("启用车型搭配")}
                            checked={parameters.pairingEnabled}
                            onChange={(e) =>
                              patch({ pairingEnabled: e.target.checked })
                            }
                          />
                          {translateText("启用车型搭配")}
                        </label>
                      </div>
                    </fieldset>
                  ) : (
                    <VesselCommercialParameters
                      tab={parameterTab}
                      truckCapacity={parameters.truckCapacity}
                      input={parameters.commercial}
                      result={result}
                      selected={selected}
                      model={model}
                      disabled={busy}
                      onChange={commercialChange}
                      onStore={setSelected}
                      onModel={chooseModel}
                    />
                  )}
                  <div className="vr-parameter-bottom">
                    <p>
                      {translateText(
                        "目标 WoS = 基准 × 直营系数 × 绩效系数；库存 WoS = 库存 ÷ 加成后周销速。",
                      )}
                      <br />
                      {translateText(
                        "级差 30 表示直营领先 30 个百分点；设为 100 时先补直营至目标。",
                      )}
                    </p>
                    <button
                      type="submit"
                      className="vr-primary"
                      disabled={busy || !!error || !edited}
                    >
                      <Play size={14} />
                      {translateText("应用并运行")}
                    </button>
                  </div>
                </form>
              </details>
            }
          />
        </section>
      </StreamBlock>
      <div
        className={"vs-application-status" + (edited ? " is-pending" : "")}
        role="status"
        data-testid="simulation-application-status"
      >
        <strong>
          {translateText(edited ? "预览参数尚未运行" : "计划已更新")}
        </strong>
        <span>
          {translateText(
            edited
              ? `02–04 仍显示 ${versionId}，点击「运行模拟」后统一更新。`
              : `02–04 已同步 ${versionId} · 分车、物流与利润使用同一版本。`,
          )}
        </span>
      </div>
      <StreamBlock name="simulation-plan">
        <section className="vs-section" aria-label={translateText("分车计划")}>
          <SectionHeading
            number="02"
            english="ALLOCATION PLAN"
            title={translateText("分车计划")}
            note="从计算关系到门店库存水位，查看车辆如何分配。门店与车型选择会联动利润明细。"
          />
          <div className="vs-section-body">
            <div className="vs-allocation-strip">
              <span>
                {translateText("本船 ")}
                <b>{translateText(fmt(s.supply))}</b>
                {translateText(" 台")}
              </span>
              <span>
                {translateText("预留")}
                {translateText(" ")}
                <b data-testid="replenishment-reserved">
                  {translateText(fmt(s.reserved))}
                </b>
              </span>
              <span>
                {translateText("订单已分 ")}
                <b>{translateText(fmt(s.orders))}</b>
              </span>
              <span>
                {translateText("可补库 ")}
                <b data-testid="replenishment-budget">
                  {translateText(fmt(s.budget))}
                </b>
              </span>
              {channels.map((c) => (
                <span key={c.channel}>
                  {translateText(c.channel)}
                  {translateText("获配")}
                  {translateText(" ")}
                  <b
                    data-testid={
                      c.channel === "授权"
                        ? "authorized-allocated"
                        : "direct-allocated"
                    }
                  >
                    {translateText(fmt(c.quantity))}
                  </b>
                </span>
              ))}
            </div>
            <div className="vs-plan-toolbar">
              <MiniTabs
                label="分车计划视图"
                items={[
                  ["graph", "计算图"],
                  ["water", "注水图"],
                ]}
                value={planTab}
                onChange={setPlanTab}
              />
              {selectors("计算图")}
            </div>
            {planTab === "graph" ? (
              <ReplenishmentGraph
                result={result}
                store={store}
                commercial={currentCommercial}
                model={model}
                focusNode={focusNode}
              />
            ) : (
              <>
                {!channels[1].quantity && (
                  <div
                    className="vs-channel-notice"
                    data-testid="authorized-water-explanation"
                  >
                    <div>
                      <strong>{translateText("授权店本轮尚未获配")}</strong>
                      <p>
                        {translateText("当前级差 ")}
                        {translateText(fmt(result.parameters.channelGap * 100))}
                        {translateText(" ")}
                        {translateText(
                          "个百分点；在渠道优先顺序、库存目标、可用车型与搭配规则的共同约束下，授权店尚未获配。有可用车型时，降低级差可让授权店更早参与。",
                        )}
                      </p>
                    </div>
                    {result.parameters.channelGap > 0.1 && s.budget > 0 && (
                      <button
                        type="button"
                        onClick={balanced}
                        disabled={busy}
                        title={translateText(
                          "预览渠道级差 10 个百分点的方案，点击运行模拟后生效",
                        )}
                      >
                        {translateText("均衡补库")}
                      </button>
                    )}
                  </div>
                )}
                <ReplenishmentWaterChart
                  result={result}
                  frame={frame}
                  progress={progress}
                  playing={playing}
                  speed={speed}
                  selected={store.id}
                  setProgress={setProgress}
                  setPlaying={setPlaying}
                  setSpeed={setSpeed}
                  setSelected={setSelected}
                />
              </>
            )}
            <div className="vs-plan-destination">
              <span>
                {translateText("直送门店 ")}
                <b>
                  {translateText(fmt(s.direct))}
                  {translateText(" 台")}
                </b>
              </span>
              <span>
                {translateText("先入 VPC / 中转中心 ")}
                <b>
                  {translateText(fmt(s.vpc))}
                  {translateText(" 台")}
                </b>
              </span>
              <span>
                {translateText("未分配留仓 ")}
                <b>
                  {translateText(fmt(s.retained))}
                  {translateText(" 台")}
                </b>
              </span>
            </div>
            <div
              className="vr-conservation"
              data-testid="replenishment-conservation"
            >
              {translateText(fmt(s.orders))}
              {translateText(" 订单 + ")}
              {translateText(fmt(s.reserved))}
              {translateText(" 预留 +")}
              {translateText(" ")}
              {translateText(fmt(s.replenishment))}
              {translateText(" 补库 + ")}
              {translateText(fmt(s.retained))}
              {translateText(" 未分配 =")}
              {translateText(" ")}
              <strong>
                {translateText(fmt(s.supply))}
                {translateText(" 台")}
              </strong>
            </div>
            <details className="vr-details vr-panel">
              <summary>
                {translateText("全部门店系数与补庫结果 ")}
                <span>{translateText("79 家 · 每店独立配置")}</span>
              </summary>
              <div className="vr-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{translateText("门店")}</th>
                      <th>{translateText("销速系数")}</th>
                      <th>{translateText("绩效加成")}</th>
                      <th>{translateText("目标 WoS")}</th>
                      <th>{translateText("满足率 前 → 后")}</th>
                      <th>{translateText("补库")}</th>
                      <th>{translateText("直送 / VPC")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stores.map((s) => {
                      const f = parameters.storeFactors[s.id] ?? {
                        salesFactor: 1,
                        performance: false,
                      };
                      return (
                        <tr key={s.id}>
                          <td>
                            <button onClick={() => setSelected(s.id)}>
                              {translateText(s.shortName)} ·{" "}
                              {translateText(s.name)}
                            </button>
                          </td>
                          <td>
                            <input
                              aria-label={translateText(`${s.id} 销速系数`)}
                              type="number"
                              min=".1"
                              max="5"
                              step=".05"
                              value={f.salesFactor}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={busy}
                              onChange={(e) =>
                                patchStore(
                                  { salesFactor: Number(e.target.value) },
                                  s.id,
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              disabled={busy}
                              aria-label={translateText(`${s.id} 绩效加成`)}
                              type="checkbox"
                              checked={f.performance}
                              onChange={(e) =>
                                patchStore(
                                  { performance: e.target.checked },
                                  s.id,
                                )
                              }
                            />
                          </td>
                          <td>{translateText(fmt(s.targetWeeks, 2))}</td>
                          <td>
                            {translateText(
                              fmt((s.beforeSatisfaction ?? 0) * 100, 1),
                            )}
                            % →{translateText(" ")}
                            {translateText(
                              fmt((s.afterSatisfaction ?? 0) * 100, 1),
                            )}
                            %
                          </td>
                          <td>{s.replenishment}</td>
                          <td>
                            {s.directQty} / {s.vpcQty}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
            <details className="vr-details vr-panel">
              <summary>{translateText("车型余量与模拟口径")}</summary>
              <p className="vr-footnote">
                {translateText(
                  "沿用 Tab1 / Tab2 的门店库存与订单。门店 × 车型销速、库存按可销售品牌及车型权重模拟分摊；绩效加成默认未勾选。Fortuner、Highlander、Lexus RX 350h 暂设为滞销搭配车型，属于演示假设。VPC 原有库存另计，不用于本次补库。",
                )}
              </p>
              <div className="vr-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{translateText("车型")}</th>
                      <th>{translateText("本船供给")}</th>
                      <th>{translateText("订单已分")}</th>
                      <th>{translateText("预留")}</th>
                      <th>{translateText("补库")}</th>
                      <th>{translateText("未分配")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.models.map((m) => (
                      <tr key={m.model}>
                        <td>{translateText(m.model)}</td>
                        <td>{m.supply}</td>
                        <td>{m.orders}</td>
                        <td>{m.reserved}</td>
                        <td>{m.replenishment}</td>
                        <td>{m.retained}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
      </StreamBlock>
      <StreamBlock name="simulation-logistics">
        <section className="vs-section" aria-label={translateText("物流方案")}>
          <SectionHeading
            number="03"
            english="LOGISTICS PLAN"
            title={translateText("物流方案")}
            note="吉达单港发运；库存可直送门店或先入暂存中心，再由订单触发末端调拨。"
          />
          <div className="vs-section-body">
            <MiniTabs
              label="物流方案视图"
              items={[
                ["map", "地图"],
                ["trips", "班次"],
                ["costs", "门店物流成本"],
              ]}
              value={logisticsTab}
              onChange={setLogisticsTab}
            />
            <CommercialLogisticsView
              result={currentCommercial}
              selected={store.id}
              onStore={setSelected}
              view={logisticsTab as "map" | "trips" | "costs"}
            />
          </div>
        </section>
      </StreamBlock>
      <StreamBlock name="simulation-profit">
        <section
          className="vs-section vs-profit-section"
          aria-label={translateText("利润计算")}
        >
          <SectionHeading
            number="04"
            english="PROFIT BREAKDOWN"
            title={translateText("利润计算")}
            note="直营按零售价格、授权按批发价格测算；固定费用仅计入直营店。"
          />
          <div className="vs-section-body">
            <MiniTabs
              label="利润计算视图"
              items={[
                ["unit", "单车利润"],
                ["models", "车型利润"],
                ["stores", "门店利润"],
              ]}
              value={profitTab}
              onChange={setProfitTab}
            />
            <div
              role="tabpanel"
              aria-label={translateText(
                profitTab === "unit"
                  ? "单车利润"
                  : profitTab === "models"
                    ? "车型利润"
                    : "门店利润",
              )}
            >
              {selectors("利润")}
              <CommercialProfitView
                result={currentCommercial}
                selected={store.id}
                model={model}
                onStore={setSelected}
                onModel={chooseModel}
                view={profitTab as "unit" | "models" | "stores"}
              />
            </div>
          </div>
        </section>
      </StreamBlock>
    </div>
  );
}
