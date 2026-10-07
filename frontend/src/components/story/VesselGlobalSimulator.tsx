"use client";
import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { ReplenishmentParameters } from "@/lib/story/vessel-replenishment";
import type { CommercialResult } from "@/lib/story/vessel-commercial";

const fmt = (n: number, d = 1) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  // Historical or fine-grained values may exceed the compact slider's usual
  // range; include them rather than letting the browser silently clamp them.
  min = Number.isFinite(value) ? Math.min(min, value) : min;
  max = Number.isFinite(value) ? Math.max(max, value) : max;
  return (
    <label className="vs-slider">
      <span>
        {label}
        <output>
          {fmt(value, 2)} <small>{unit}</small>
        </output>
      </span>
      <div>
        <small>{min}</small>
        <input
          type="range"
          aria-label={label}
          aria-valuetext={`${fmt(value, 2)} ${unit}`}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          style={{
            background: `linear-gradient(to right, #557b66 ${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%, #e4eae6 0)`,
          }}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <small>{max}</small>
      </div>
    </label>
  );
}
export default function VesselGlobalSimulator({
  parameters: p,
  result,
  baseline,
  disabled,
  pending,
  edited,
  error,
  onChange,
  onCommit,
  onReset,
  advanced,
}: {
  parameters: ReplenishmentParameters;
  result?: CommercialResult;
  baseline: CommercialResult;
  disabled: boolean;
  pending: boolean;
  edited: boolean;
  error: string;
  onChange: (p: ReplenishmentParameters) => void;
  onCommit: () => void;
  onReset: () => void;
  advanced: React.ReactNode;
}) {
  const [magnified, setMagnified] = useState(true);
  const c = p.commercial!;
  const global = c.simulation ?? {
    regions: {},
    retailFactor: 1,
    wholesaleFactor: 1,
  };
  function globalChange(patch: Partial<typeof global>) {
    onChange({
      ...p,
      commercial: { ...c, simulation: { ...global, ...patch } },
    });
  }
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    change: (n: number) => void,
  ) => (
    <Slider
      key={label}
      {...{
        label,
        value,
        min,
        max,
        step,
        unit,
        disabled,
        onChange: change,
      }}
    />
  );
  const totals = result?.profit.summary,
    base = baseline.profit.summary;
  const direct = result?.profit.stores
    .filter((s) => s.channel === "直营")
    .reduce((n, s) => n + s.quantity, 0);
  const authorized = result?.profit.stores
    .filter((s) => s.channel === "授权")
    .reduce((n, s) => n + s.quantity, 0);
  const channelSaturated = authorized === 0 && (direct ?? 0) > 0;
  const metrics = [
    {
      id: "revenue",
      label: "总营收",
      value: totals?.revenue,
      base: base.revenue,
      money: true,
    },
    {
      id: "net",
      label: "总净利润",
      value: totals?.net,
      base: base.net,
      money: true,
    },
    {
      id: "margin",
      label: "净利润率",
      value: totals?.margin ?? undefined,
      base: base.margin ?? 0,
      money: false,
    },
    {
      id: "logistics",
      label: "物流费用",
      value: result?.logistics.totalCost,
      base: baseline.logistics.totalCost,
      money: true,
    },
  ];
  return (
    <div className="vs-global-grid">
      <div className="vs-controls">
        <div className="vs-subheading">
          <small>WHAT-IF PARAMETERS</small>
          <h3>调整参数，即时查看经营结果</h3>
        </div>
        <fieldset disabled={disabled}>
          <legend>分车参数</legend>
          {slider("基准目标 WoS", p.baseWos, 1, 8, 0.1, "周", (n) =>
            onChange({ ...p, baseWos: n }),
          )}
          {slider(
            "直营 / 授权级差",
            p.channelGap * 100,
            0,
            100,
            1,
            "百分点",
            (n) => onChange({ ...p, channelGap: n / 100 }),
          )}
          {slider(
            "直营目标 WoS 系数",
            p.directTargetFactor,
            0.5,
            2,
            0.05,
            "×",
            (n) => onChange({ ...p, directTargetFactor: n }),
          )}
          {slider(
            "绩效目标 WoS 系数",
            p.performanceTargetFactor,
            1,
            2,
            0.05,
            "×",
            (n) => onChange({ ...p, performanceTargetFactor: n }),
          )}
          {slider("板车容量", p.truckCapacity, 8, 10, 1, "台 / 车", (n) =>
            onChange({ ...p, truckCapacity: n }),
          )}
          <small className="vs-control-note">
            绩效系数仅作用于已勾选门店。物流按 8
            台满载基准摊销，增大板车容量可降低单车预算。
          </small>
        </fieldset>
        <fieldset disabled={disabled}>
          <legend>大区物流系数</legend>
          <div className="vs-region-sliders">
            {["西部", "中部", "东部", "北部", "南部"].map((region) =>
              slider(
                region + "物流系数",
                global.regions[region] ?? 1,
                0.5,
                2,
                0.05,
                "×",
                (n) =>
                  globalChange({ regions: { ...global.regions, [region]: n } }),
              ),
            )}
          </div>
        </fieldset>
        <fieldset disabled={disabled}>
          <legend>价格系数</legend>
          <div className="vs-region-sliders">
            {slider(
              "零售价格系数",
              global.retailFactor,
              0.8,
              1.2,
              0.01,
              "×",
              (n) => globalChange({ retailFactor: n }),
            )}
            {slider(
              "批发价格系数",
              global.wholesaleFactor,
              0.8,
              1.2,
              0.01,
              "×",
              (n) => globalChange({ wholesaleFactor: n }),
            )}
          </div>
          {channelSaturated && (
            <small className="vs-control-note">
              当前授权补库为 0 台，批发价格系数暂不影响总营收与总利润。
            </small>
          )}
        </fieldset>
        <div className="vs-controls-footer">
          <span>
            {pending
              ? "正在更新模拟…"
              : error
                ? "请调整参数后再运行"
                : edited
                  ? "实时预览 · 参数待运行"
                  : "当前运行版本已保存"}
            <small>点击运行，更新下方 02–04 并保存情景版本</small>
          </span>
          <button type="button" onClick={onReset} disabled={disabled}>
            <RotateCcw size={13} />
            恢复初始
          </button>
          <button
            type="button"
            className="vs-primary"
            onClick={onCommit}
            disabled={disabled || pending || !!error || !edited}
          >
            <Play size={13} />
            运行模拟
          </button>
        </div>
        {advanced}
      </div>
      <div className="vs-financials" aria-busy={pending}>
        <div className="vs-subheading">
          <small>BUSINESS IMPACT</small>
          <h3>
            整体经营指标 <span>补库车辆 · SAR</span>
          </h3>
        </div>
        <div className="vs-chart-toolbar">
          <span>
            {magnified
              ? "局部刻度 · 对比运行值 · 超出时切换绝对值"
              : "从零展示 · 完整金额"}
          </span>
          <div role="group" aria-label="经营指标图表刻度">
            <button
              type="button"
              aria-pressed={magnified}
              onClick={() => setMagnified(true)}
            >
              变化放大
            </button>
            <button
              type="button"
              aria-pressed={!magnified}
              onClick={() => setMagnified(false)}
            >
              绝对值
            </button>
          </div>
        </div>
        <div className="vs-financial-bars">
          {metrics.map((m) => {
            // Freeze the magnified domain against the applied version while
            // dragging. Auto-scaling against the draft hides small differences.
            const radius = m.money
              ? Math.max(
                  Math.abs(m.base) *
                    (m.id === "logistics" ? 0.5 : m.id === "net" ? 0.25 : 0.1),
                  10000,
                )
              : 0.02;
            const low = magnified
              ? m.base - radius
              : Math.min(0, m.base * 1.5, (m.value ?? 0) * 1.12);
            const high = magnified
              ? m.base + radius
              : Math.max(
                  m.base * 1.5,
                  (m.value ?? 0) * 1.12,
                  m.money ? 10000 : 0.01,
                );
            const position = (value: number) =>
              Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
            const height = position(m.value ?? low);
            const initial = position(m.base);
            const zero = position(0);
            const fillBottom = magnified ? 0 : Math.min(zero, height);
            const fillHeight =
              m.value === undefined
                ? 0
                : magnified
                  ? height
                  : Math.abs(height - zero);
            const delta = m.value === undefined ? undefined : m.value - m.base;
            const relative =
              delta === undefined || m.base === 0
                ? undefined
                : (delta / Math.abs(m.base)) * 100;
            const clipped =
              m.value !== undefined && (m.value < low || m.value > high);
            const axis = (n: number) =>
              fmt(n * (m.money ? 0.0001 : 100), 2) + (m.money ? "万" : "%");
            return (
              <article
                key={m.id}
                className={(m.value ?? 0) < 0 ? "is-negative" : ""}
              >
                <strong
                  data-testid={"simulation-" + m.id}
                  title={
                    m.value === undefined
                      ? ""
                      : m.money
                        ? fmt(m.value, 2) + " SAR"
                        : fmt(m.value * 100, 2) + "%"
                  }
                >
                  {m.value === undefined
                    ? "—"
                    : fmt(m.value * (m.money ? 0.0001 : 100), 2)}
                  <small>{m.money ? "万" : "%"}</small>
                </strong>
                <span className="vs-metric-delta">
                  {delta === undefined
                    ? "无法计算"
                    : m.money
                      ? relative === undefined
                        ? "新增金额"
                        : `${relative >= 0 ? "+" : ""}${fmt(relative, 2)}%`
                      : `${delta >= 0 ? "+" : ""}${fmt(delta * 100, 3)}pp`}
                  <small data-testid={"simulation-impact-" + m.id}>
                    {delta === undefined
                      ? "—"
                      : `${delta >= 0 ? "+" : ""}${fmt(delta * (m.money ? 1 : 100), m.money ? 2 : 3)} ${m.money ? "SAR" : "百分点"}`}
                  </small>
                </span>
                <div className="vs-bar-area">
                  <div
                    className="vs-metric-scale"
                    data-testid={"simulation-" + m.id + "-scale"}
                  >
                    <span>{axis(high)}</span>
                    <span>{axis(low)}</span>
                  </div>
                  <div className="vs-metric-track">
                    <div
                      style={{
                        bottom: fillBottom + "%",
                        height: fillHeight + "%",
                      }}
                    />
                    {m.value !== undefined && (
                      <i style={{ bottom: height + "%" }} />
                    )}
                  </div>
                  {!magnified && low < 0 && (
                    <div
                      className="vs-zero-line"
                      style={{ bottom: zero + "%" }}
                    >
                      <span>0</span>
                    </div>
                  )}
                  <div
                    className="vs-baseline-line"
                    style={{ bottom: initial + "%" }}
                    title="当前运行版本"
                  >
                    <span>运行值</span>
                  </div>
                  {clipped && (
                    <span
                      className="vs-chart-clipped"
                      style={{
                        top: m.value! < low ? "auto" : "2px",
                        bottom: m.value! < low ? "2px" : "auto",
                      }}
                    >
                      超出刻度
                    </span>
                  )}
                </div>
                <h4>{m.label}</h4>
              </article>
            );
          })}
        </div>
        <div className="vs-live-plan" data-testid="simulation-channel-split">
          <span>直营 {direct === undefined ? "—" : fmt(direct, 0)} 台</span>
          <span>
            授权 {authorized === undefined ? "—" : fmt(authorized, 0)} 台
          </span>
          <span>物流 {result ? result.logistics.trips.length : "—"} 班次</span>
        </div>
        {error ? (
          <div role="alert" className="vs-assessment is-error">
            <strong>当前参数无法生成有效方案</strong>
            <p>{error}</p>
            <small>
              指标暂不展示，下方保留最近有效版本。请调整系数后继续模拟。
            </small>
          </div>
        ) : (
          <div className="vs-assessment">
            <strong>
              {pending
                ? "模拟更新中"
                : (totals?.net ?? 0) < 0
                  ? "本方案预计净亏损"
                  : "当前方案经营测算"}
            </strong>
            <p>
              预计补库 {totals?.quantity ?? 0}{" "}
              台，直营按零售、授权按批发计收；授权店固定费用为 0。
            </p>
            <small>
              按本轮补库车辆全部售出测算。采购、价格与运费均为模拟假设；虚线与差额对比当前运行版本，点击运行后更新对比基准。
            </small>
          </div>
        )}
        <div className="vs-formula">
          <span>营收 − 采购成本 = 毛利</span>
          <span>毛利 − 物流费用 − 直营固定费用 = 净利</span>
        </div>
      </div>
    </div>
  );
}
