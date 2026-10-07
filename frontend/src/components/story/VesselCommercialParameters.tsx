"use client";
import type {
  CommercialParameters,
  ModelPricing,
  StoreLogistics,
} from "@/lib/story/vessel-commercial";
import { commercialHubs } from "@/lib/story/vessel-commercial";
import type { VesselReplenishment } from "@/lib/story/vessel-replenishment";

const fmt = (n: number) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
export default function VesselCommercialParameters({
  tab,
  truckCapacity,
  input,
  result,
  selected,
  model,
  disabled,
  onChange,
  onStore,
  onModel,
}: {
  tab: string;
  truckCapacity: number;
  input: CommercialParameters;
  result: VesselReplenishment;
  selected: string;
  model: string;
  disabled: boolean;
  onChange: (p: CommercialParameters) => void;
  onStore: (id: string) => void;
  onModel: (id: string) => void;
}) {
  function log(id: string, p: Partial<StoreLogistics>) {
    const next = {
      ...input,
      logistics: { ...input.logistics, [id]: { ...input.logistics[id], ...p } },
    };
    onChange(next);
  }
  function price(id: string, p: Partial<ModelPricing>) {
    onChange({
      ...input,
      pricing: { ...input.pricing, [id]: { ...input.pricing[id], ...p } },
    });
  }
  function number(
    value: number,
    label: string,
    change: (n: number) => void,
    step = ".01",
  ) {
    return (
      <input
        type="number"
        aria-label={label}
        value={Number.isNaN(value) ? "" : value}
        step={step}
        disabled={disabled}
        onChange={(e) =>
          change(e.target.value === "" ? NaN : Number(e.target.value))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    );
  }
  if (tab === "logistics") {
    const factors = result.stores.map(
      (s) =>
        input.logistics[s.id].factor *
        (input.simulation?.regions[s.region] ?? 1),
    );
    const costs = result.stores.map(
      (s, i) =>
        Math.round(
          ((input.logistics[s.id].baseUnitCost * factors[i] * 8) /
            truckCapacity) *
            100,
        ) / 100,
    );
    const maximum = Math.max(100, ...costs.filter(Number.isFinite)) * 1.15;
    const maxFactor = Math.max(2, ...factors.filter(Number.isFinite));
    const width = Math.max(700, result.stores.length * 44),
      left = 70,
      right = width - 60,
      bottom = 280,
      top = 35;
    const x = (i: number) =>
      left + ((i + 0.5) * (right - left)) / result.stores.length;
    return (
      <div className="vc-logistics-parameters">
        <div className="vr-table-scroll vc-editor-scroll">
          <table>
            <thead>
              <tr>
                <th>门店 / 渠道</th>
                <th>
                  8 台满载基准
                  <br />
                  SAR
                </th>
                <th>门店系数 ×</th>
                <th>暂存中心</th>
              </tr>
            </thead>
            <tbody>
              {result.stores.map((s) => (
                <tr key={s.id} data-selected={selected === s.id}>
                  <td>
                    <button type="button" onClick={() => onStore(s.id)}>
                      {s.shortName}
                      <small>
                        {s.channel} · {s.city}
                      </small>
                    </button>
                  </td>
                  <td>
                    {number(
                      input.logistics[s.id].baseUnitCost,
                      s.id + " 基准物流成本",
                      (n) => log(s.id, { baseUnitCost: n }),
                    )}
                  </td>
                  <td>
                    {number(
                      input.logistics[s.id].factor,
                      s.id + " 物流系数",
                      (n) => log(s.id, { factor: n }),
                    )}
                  </td>
                  <td>
                    <select
                      aria-label={s.id + " 中转中心"}
                      disabled={disabled}
                      value={input.logistics[s.id].hub}
                      onChange={(e) => log(s.id, { hub: e.target.value })}
                    >
                      {commercialHubs.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {costs.every((n) => Number.isFinite(n) && n >= 0) &&
        factors.every((n) => Number.isFinite(n) && n >= 0) ? (
          <div className="vc-coefficient-panel">
            <div className="vc-chart-caption">
              <strong>每店最终单车物流成本</strong>
              <span>
                <i className="vc-dot blue" />
                成本 · 左轴 SAR <i className="vc-dot gold" />
                系数 · 右轴 ×
              </span>
            </div>
            <div className="vc-chart-scroll">
              <svg
                viewBox={"0 0 " + width + " 355"}
                style={{ minWidth: width }}
                role="img"
                aria-label="门店物流成本与系数双轴图"
                data-testid="logistics-coefficient-chart"
              >
                {[0, 1, 2, 3, 4].map((i) => {
                  const y = bottom - (i / 4) * (bottom - top);
                  return (
                    <g key={i}>
                      <line
                        x1={left}
                        x2={right}
                        y1={y}
                        y2={y}
                        stroke="#e9edf2"
                      />
                      <text x={left - 10} y={y + 4} textAnchor="end">
                        {fmt((maximum * i) / 4)}
                      </text>
                      <text x={right + 10} y={y + 4}>
                        {fmt((maxFactor * i) / 4)}
                      </text>
                    </g>
                  );
                })}
                <polyline
                  fill="none"
                  stroke="#c69533"
                  strokeWidth="2.5"
                  points={result.stores
                    .map(
                      (s, i) =>
                        x(i) +
                        "," +
                        (bottom -
                          ((factors[i] || 0) / maxFactor) * (bottom - top)),
                    )
                    .join(" ")}
                />
                {result.stores.map((s, i) => (
                  <g
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-label={s.id + " 物流成本"}
                    onClick={() => onStore(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onStore(s.id);
                      }
                    }}
                  >
                    <rect
                      x={x(i) - 12}
                      y={bottom - ((costs[i] || 0) / maximum) * (bottom - top)}
                      width="24"
                      height={((costs[i] || 0) / maximum) * (bottom - top)}
                      rx="3"
                      fill={selected === s.id ? "#265aa0" : "#9ab9db"}
                    />
                    <circle
                      cx={x(i)}
                      cy={
                        bottom -
                        ((factors[i] || 0) / maxFactor) * (bottom - top)
                      }
                      r="3"
                      fill="#c69533"
                    />
                    <text transform={"translate(" + x(i) + " 293) rotate(60)"}>
                      {s.shortName}
                    </text>
                    <title>
                      {s.name +
                        "：" +
                        fmt(costs[i]) +
                        " SAR，系数 ×" +
                        factors[i]}
                    </title>
                  </g>
                ))}
              </svg>
            </div>
            <p className="vr-footnote">
              初始成本参考单港线路报价 ÷ 8
              加示例服务费用。可逐店修改；完整单车预算包含中转及末端调拨。图中显示实时参数，最终系数
              = 门店系数 × 所属大区系数；最终单车预算 = 基准成本 × 最终系数 × 8
              ÷ 板车容量（当前 {truckCapacity} 台）。尾班按单车预算计费。
            </p>
          </div>
        ) : (
          <p
            className="vs-input-incomplete"
            role="status"
            data-testid="logistics-input-incomplete"
          >
            物流参数未填写完整或数值无效，暂无法生成成本与系数图。缺失成本不按 0
            计算。
          </p>
        )}
      </div>
    );
  }
  const columns: [keyof ModelPricing, string][] = [
    ["purchasePrice", "采购价格"],
    ["retailPrice", "零售价格"],
    ["wholesalePrice", "批发价格"],
    ["retailFactor", "零售系数"],
    ["wholesaleFactor", "批发系数"],
    ["fixedCost", "直营单车固定费用"],
  ];
  return (
    <div className="vc-pricing-parameters">
      <p className="vc-formula">
        <strong>直营</strong> 零售价 × 零售系数 − 采购价 <span>｜</span>
        <strong>授权</strong> 批发价 × 批发系数 − 采购价{" "}
        <span>→ 毛利 − 物流 − 直营固定费用 = 净利</span>
      </p>
      <div className="vr-table-scroll vc-editor-scroll">
        <table>
          <thead>
            <tr>
              <th>车型</th>
              {columns.map(([key, label]) => (
                <th key={key}>
                  {label}
                  <br />
                  {key.includes("Factor") ? "×" : "SAR"}
                </th>
              ))}
              <th>
                基准零售毛利率
                <br />%
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(input.pricing).map(([id, p]) => (
              <tr key={id} data-selected={model === id}>
                <td>
                  <button type="button" onClick={() => onModel(id)}>
                    {id}
                  </button>
                </td>
                {columns.map(([key, label]) => (
                  <td key={key}>
                    {number(
                      p[key],
                      id + " " + label,
                      (n) => price(id, { [key]: n }),
                      key.includes("Factor") ? ".01" : "100",
                    )}
                  </td>
                ))}
                <td>
                  {number(
                    Math.round((1 - p.purchasePrice / p.retailPrice) * 10000) /
                      100,
                    id + " 毛利率",
                    (n) =>
                      price(id, {
                        purchasePrice:
                          Math.round(p.retailPrice * (1 - n / 100) * 100) / 100,
                      }),
                    ".1",
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="vr-footnote">
        价格为 SAR 示例假设；成交价格 = 基准价 × 车型系数 ×
        全局价格系数。零售价须高于批发价，系数调整后仍保持这一关系。授权不扣固定费用；同车型计入各店物流后，直营单车净利须高于授权。毛利率与采购价联动，避免重复计成本。负净利会保留显示。
      </p>
    </div>
  );
}
