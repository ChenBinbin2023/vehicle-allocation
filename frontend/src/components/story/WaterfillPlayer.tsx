"use client";
import { useState, useMemo, useEffect } from "react";
import { Play, Pause, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import {
  calculateStoreAllocation,
  type StoreAllocation,
} from "@/lib/story/store-planning";
const fmt = (n: number, d = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: d });
export default function WaterfillPlayer({
  result,
}: {
  result: StoreAllocation;
}) {
  const [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [selected, setSelected] = useState(result.rows[0]?.id),
    [filter, setFilter] = useState("全部");
  const budget = result.input.supply - result.summary.orders;
  const step = Math.max(1, Math.ceil(budget / 80));
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
    setSelected(result.rows[0]?.id);
  }, [result]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setProgress((p) => Math.min(budget, p + step)),
      120 / speed,
    );
    return () => clearInterval(timer);
  }, [playing, budget, step, speed]);
  useEffect(() => {
    if (progress >= budget) setPlaying(false);
  }, [progress, budget]);
  const frame = useMemo(
    () =>
      calculateStoreAllocation({
        ...result.input,
        supply: result.summary.orders + progress,
      }),
    [result, progress],
  );
  const ratio = (r: (typeof frame.rows)[number], after: boolean) =>
    r.weeklySales
      ? (r.effectiveStock + (after ? r.replenishment : 0)) /
        (r.weeklySales * r.targetWeeks)
      : 0;
  const ymax = Math.max(1.2, ...result.rows.map((r) => ratio(r, true))) * 1.04;
  const chosen = frame.rows.find((r) => r.id === selected) ?? frame.rows[0];
  const growing = ["直营", "授权"].filter((ch) =>
    frame.rows.some(
      (r) => r.channel === ch && r.replenishment > 0 && r.gap > 0,
    ),
  );
  const stage =
    progress === 0
      ? "等待注水"
      : frame.summary.replenishmentGap === 0
        ? "全部达到目标"
        : growing.length
          ? growing.join("、") + "一起注水"
          : "可补门店已达到分车上限";
  const y = (level: number) =>
    246 - (Math.min(ymax, Math.max(0, level)) / ymax) * 210;
  const channelTotals = (ch: string) =>
    frame.rows
      .filter((r) => r.channel === ch)
      .reduce((s, r) => s + r.replenishment, 0);
  return (
    <section
      className="planning-panel waterfill-panel"
      data-testid="waterfill-player"
    >
      <header>
        <h2>
          分车计划模拟{" "}
          <span className="water-stage" data-testid="water-stage">
            {stage}
          </span>
        </h2>
        <p>
          订单先分配 {fmt(result.summary.orders)} 台，剩余 {fmt(budget)}{" "}
          台进入补库池。每一帧重新计算最低相对水位与整车分配。
        </p>
      </header>
      <div className="water-controls">
        <button
          aria-label="重新演示"
          onClick={() => {
            setPlaying(false);
            setProgress(0);
          }}
        >
          <RotateCcw size={14} />
        </button>
        <button
          aria-label="上一步注水"
          onClick={() => {
            setPlaying(false);
            setProgress((p) => Math.max(0, p - step));
          }}
        >
          <SkipBack size={14} />
        </button>
        <button
          className="planning-primary"
          onClick={() => {
            if (progress >= budget) setProgress(0);
            setPlaying(!playing);
          }}
          disabled={!budget}
          aria-label={playing ? "暂停注水" : "播放注水"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
          {playing ? "暂停" : "播放"}
        </button>
        <button
          aria-label="下一步注水"
          onClick={() => {
            setPlaying(false);
            setProgress((p) => Math.min(budget, p + step));
          }}
        >
          <SkipForward size={14} />
        </button>
        <label>
          播放速度{" "}
          <select
            aria-label="注水播放速度"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <button
          onClick={() => {
            setPlaying(false);
            setProgress(budget);
          }}
        >
          查看最终水位
        </button>
      </div>
      <div className="water-progress">
        <label htmlFor="water-budget">
          当前注入供给{" "}
          <strong data-testid="water-progress">
            {fmt(progress)} / {fmt(budget)} 台
          </strong>
        </label>
        <input
          id="water-budget"
          aria-label="注水进度"
          type="range"
          min="0"
          max={budget}
          step="1"
          value={progress}
          onChange={(e) => {
            setPlaying(false);
            setProgress(Number(e.target.value));
          }}
        />
        <div>
          <span>
            已分补库{" "}
            <b data-testid="water-assigned">
              {fmt(frame.summary.replenishment)}
            </b>{" "}
            台
          </span>
          <span>
            未注入 {fmt(budget - progress)} 台 · 当前留仓{" "}
            {fmt(frame.summary.retained)} 台
          </span>
          <span>共用水位 {fmt(frame.waterLevel * 100, 1)}%</span>
        </div>
      </div>
      <div className="water-legend">
        <span>
          <i className="water-existing" />
          有效库存 E
        </span>
        <span>
          <i className="water-added" />
          本轮补库
        </span>
        <span>
          <i className="water-level-key" />
          当前渠道水位
        </span>
        <span>
          <i className="water-target-key" />
          目标 100%
        </span>
        <label>
          渠道{" "}
          <select
            aria-label="注水渠道"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>全部</option>
            <option>直营</option>
            <option>授权</option>
          </select>
        </label>
      </div>
      <div className="water-channels">
        {(["直营", "授权"] as const)
          .filter((ch) => filter === "全部" || filter === ch)
          .map((ch) => {
            const group = frame.rows.filter((r) => r.channel === ch),
              width = Math.max(480, group.length * 24 + 75),
              offset =
                (ch === "直营"
                  ? result.input.offsetDirect
                  : result.input.offsetAuthorized) ?? 0;
            const level = Math.max(0, frame.waterLevel - offset);
            return (
              <article className="water-channel" key={ch}>
                <header>
                  <h3>
                    {ch} <small>{group.length} 家门店</small>
                  </h3>
                  <span>
                    偏移 {fmt(offset * 100)}% · 本轮已补{" "}
                    {fmt(channelTotals(ch))} 台
                  </span>
                </header>
                <div className="water-chart-scroll">
                  <svg
                    width={width}
                    height="305"
                    role="group"
                    aria-label={`${ch}门店注水水位图`}
                  >
                    {[0, 0.5, 1, Math.ceil(ymax * 2) / 2]
                      .filter((v) => v <= ymax)
                      .map((tick, i) => (
                        <g key={i}>
                          <line
                            x1="50"
                            y1={y(tick)}
                            x2={width - 15}
                            y2={y(tick)}
                            stroke={tick === 1 ? "#c6aa67" : "#e6eeea"}
                            strokeDasharray={tick === 1 ? "5 4" : undefined}
                          />
                          <text
                            x="43"
                            y={y(tick) + 4}
                            textAnchor="end"
                            fontSize="10"
                            fill="#869c94"
                          >
                            {fmt(tick * 100)}%
                          </text>
                        </g>
                      ))}
                    <text x="9" y="16" fontSize="10" fill="#869c94">
                      相对 WoS
                    </text>
                    {group.map((r, i) => {
                      const x = 62 + i * 24,
                        before = ratio(r, false),
                        after = ratio(r, true);
                      return (
                        <g
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`${r.id} 注水 ${r.replenishment} 台`}
                          onClick={() => setSelected(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(r.id);
                            }
                          }}
                          className="water-bar"
                        >
                          <rect
                            x={x - 8}
                            y="29"
                            width="20"
                            height="220"
                            fill={r.id === selected ? "#edf6f0" : "transparent"}
                          />
                          <rect
                            x={x - 5}
                            y={y(before)}
                            width="14"
                            height={246 - y(before)}
                            fill="#526d64"
                          />
                          <rect
                            x={x - 5}
                            y={y(after)}
                            width="14"
                            height={Math.max(0, y(before) - y(after))}
                            fill="#71bdd0"
                          />
                          <text
                            x={x + 2}
                            y="261"
                            fontSize="8"
                            fill="#799089"
                            textAnchor="end"
                            transform={`rotate(-50 ${x + 2} 261)`}
                          >
                            {r.id.replace("MOCK-", "")}
                          </text>
                          <title>
                            {r.name}：{fmt(r.beforeWos ?? 0, 2)} →{" "}
                            {fmt(r.afterWos ?? 0, 2)} 周，补 {r.replenishment}{" "}
                            台
                          </title>
                        </g>
                      );
                    })}
                    {progress > 0 && (
                      <>
                        <line
                          x1="50"
                          y1={y(level)}
                          x2={width - 15}
                          y2={y(level)}
                          stroke="#389eb0"
                          strokeWidth="1.5"
                        />
                        <text
                          x={width - 18}
                          y={y(level) - 6}
                          textAnchor="end"
                          fontSize="10"
                          fill="#23879a"
                        >
                          水位 {fmt(level * 100, 1)}%
                        </text>
                      </>
                    )}
                  </svg>
                </div>
              </article>
            );
          })}
      </div>
      {chosen && (
        <aside className="water-store-detail">
          <div>
            <strong>{chosen.name}</strong>
            <small>
              {chosen.id} · {chosen.city} · {chosen.channel}
            </small>
          </div>
          <span>
            周销速 <b>{fmt(chosen.weeklySales, 2)}</b>
          </span>
          <span>
            有效库存 <b>{fmt(chosen.effectiveStock)}</b>
          </span>
          <span>
            本轮补库 <b>{fmt(chosen.replenishment)}</b>
          </span>
          <span>
            WoS{" "}
            <b>
              {fmt(chosen.beforeWos ?? 0, 2)} → {fmt(chosen.afterWos ?? 0, 2)}
            </b>{" "}
            / {chosen.targetWeeks} 周
          </span>
        </aside>
      )}
      <p className="planning-footnote">
        柱高 =（有效库存 + 本轮补库）÷（周销速 × 目标
        WoS）。已有高库存门店保持原水位，不强行注水。订单车单列；播放仅查看本轮快照，调整规则后需模拟重跑。
      </p>
    </section>
  );
}
