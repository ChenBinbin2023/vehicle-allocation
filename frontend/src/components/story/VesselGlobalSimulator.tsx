"use client";
import { Play, RotateCcw } from "lucide-react";
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
            绩效系数仅作用于已勾选绩效加成的门店。
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
        <div className="vs-financial-bars">
          {metrics.map((m) => {
            const extent = Math.max(
              Math.abs(m.base) * 1.5,
              Math.abs(m.value ?? 0) * 1.12,
              m.money ? 1 : 0.01,
            );
            const height = Math.min(
              100,
              (Math.abs(m.value ?? 0) / extent) * 100,
            );
            const initial = Math.min(100, (Math.abs(m.base) / extent) * 100);
            const delta = m.value === undefined ? undefined : m.value - m.base;
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
                    : fmt(m.value * (m.money ? 0.0001 : 100), m.money ? 1 : 2)}
                  <small>{m.money ? "万" : "%"}</small>
                </strong>
                <span className="vs-metric-delta">
                  {delta === undefined
                    ? "无法计算"
                    : `${delta >= 0 ? "+" : ""}${fmt(delta * (m.money ? 0.0001 : 100), 2)}${m.money ? "万" : "pp"}`}
                </span>
                <div className="vs-bar-area">
                  <div className="vs-metric-track">
                    <div style={{ height: height + "%" }} />
                    <i style={{ bottom: height + "%" }} />
                  </div>
                  <div
                    className="vs-baseline-line"
                    style={{ bottom: initial + "%" }}
                    title="初始版本"
                  >
                    <span>初始</span>
                  </div>
                </div>
                <h4>{m.label}</h4>
              </article>
            );
          })}
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
              按本轮补库车辆全部售出测算。采购、价格与运费均为模拟假设；虚线对比初始版本。
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
