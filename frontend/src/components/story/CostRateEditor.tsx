"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import {
  costLabels,
  completeCostRates,
  type CostRates,
} from "@/lib/story/logistics-cost";
export default function CostRateEditor({
  value,
  onChange,
}: {
  value: CostRates;
  onChange: (value: CostRates) => void;
}) {
  const { t: translateText } = useI18n();

  return (
    <div className="cost-editor">
      <div className="planning-controls">
        {(Object.keys(costLabels) as Array<keyof CostRates>).map((key) => (
          <label key={key}>
            {translateText(costLabels[key])}
            {translateText(
              key === "storageDays"
                ? "（天）"
                : "（SAR/台" + (key === "storageDaily" ? "/天" : "") + "）",
            )}
            <input
              type="number"
              min="0"
              step="any"
              aria-label={translateText("费用 " + costLabels[key])}
              placeholder={translateText("待确认")}
              value={value[key] ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onChange({ ...completeCostRates })}>
        {translateText("填入演示费率")}
      </button>
      <p className="planning-footnote">
        {translateText(
          "空值为未知，0 为明确零费用；演示费率来自 data/05_利润，非实际报价。暂存天数为统一情景假设。港口、PDI、末端按路由台数计费；VPC 处理与暂存仅计经 VPC 的车辆。",
        )}
      </p>
    </div>
  );
}
