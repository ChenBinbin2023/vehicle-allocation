"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t: translateText } = useI18n();

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
          {translateText("分车计划模拟")}
          {translateText(" ")}
          <span className="water-stage" data-testid="water-stage">
            {translateText(stage)}
          </span>
        </h2>
        <p>
          {translateText("订单先分配 ")}
          {translateText(fmt(result.summary.orders))}
          {translateText(" 台，剩余 ")}
          {translateText(fmt(budget))}
          {translateText(" ")}
          {translateText(
            "台进入补库池。每一帧重新计算最低相对水位与整车分配。",
          )}
        </p>
      </header>
      <div className="water-controls">
        <button
          aria-label={translateText("重新演示")}
          onClick={() => {
            setPlaying(false);
            setProgress(0);
          }}
        >
          <RotateCcw size={14} />
        </button>
        <button
          aria-label={translateText("上一步注水")}
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
          aria-label={translateText(playing ? "暂停注水" : "播放注水")}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {translateText(" ")}
          {translateText(playing ? "暂停" : "播放")}
        </button>
        <button
          aria-label={translateText("下一步注水")}
          onClick={() => {
            setPlaying(false);
            setProgress((p) => Math.min(budget, p + step));
          }}
        >
          <SkipForward size={14} />
        </button>
        <label>
          {translateText("播放速度")}
          {translateText(" ")}
          <select
            aria-label={translateText("注水播放速度")}
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
          {translateText("查看最终水位")}
        </button>
      </div>
      <div className="water-progress">
        <label htmlFor="water-budget">
          {translateText("当前注入供给")}
          {translateText(" ")}
          <strong data-testid="water-progress">
            {translateText(fmt(progress))} / {translateText(fmt(budget))}
            {translateText(" 台")}
          </strong>
        </label>
        <input
          id="water-budget"
          aria-label={translateText("注水进度")}
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
            {translateText("已分补库")}
            {translateText(" ")}
            <b data-testid="water-assigned">
              {translateText(fmt(frame.summary.replenishment))}
            </b>
            {translateText(" ")}
            {translateText("台")}
          </span>
          <span>
            {translateText("未注入 ")}
            {translateText(fmt(budget - progress))}
            {translateText(" 台 · 当前留仓")}
            {translateText(" ")}
            {translateText(fmt(frame.summary.retained))}
            {translateText(" 台")}
          </span>
          <span>
            {translateText("共用水位 ")}
            {translateText(fmt(frame.waterLevel * 100, 1))}%
          </span>
        </div>
      </div>
      <div className="water-legend">
        <span>
          <i className="water-existing" />
          {translateText("有效库存 E")}
        </span>
        <span>
          <i className="water-added" />
          {translateText("本轮补库")}
        </span>
        <span>
          <i className="water-level-key" />
          {translateText("当前渠道水位")}
        </span>
        <span>
          <i className="water-target-key" />
          {translateText("目标 100%")}
        </span>
        <label>
          {translateText("渠道")}
          {translateText(" ")}
          <select
            aria-label={translateText("注水渠道")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value={"全部"}>{translateText("全部")}</option>
            <option value={"直营"}>{translateText("直营")}</option>
            <option value={"授权"}>{translateText("授权")}</option>
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
                    {translateText(ch)}{" "}
                    <small>
                      {group.length}
                      {translateText(" 家门店")}
                    </small>
                  </h3>
                  <span>
                    {translateText("偏移 ")}
                    {translateText(fmt(offset * 100))}
                    {translateText("% · 本轮已补")}
                    {translateText(" ")}
                    {translateText(fmt(channelTotals(ch)))}
                    {translateText(" 台")}
                  </span>
                </header>
                <div className="water-chart-scroll">
                  <svg
                    width={width}
                    height="305"
                    role="group"
                    aria-label={translateText(`${ch}门店注水水位图`)}
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
                            {translateText(fmt(tick * 100))}%
                          </text>
                        </g>
                      ))}
                    <text x="9" y="16" fontSize="10" fill="#869c94">
                      {translateText("相对 WoS")}
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
                          aria-label={translateText(
                            `${r.id} 注水 ${r.replenishment} 台`,
                          )}
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
                            {translateText(r.id.replace("MOCK-", ""))}
                          </text>
                          <title>
                            {translateText(r.name)}：
                            {translateText(fmt(r.beforeWos ?? 0, 2))} →
                            {translateText(" ")}
                            {translateText(fmt(r.afterWos ?? 0, 2))}
                            {translateText(" 周，补 ")}
                            {r.replenishment}
                            {translateText(" ")}
                            {translateText("台")}
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
                          {translateText("水位 ")}
                          {translateText(fmt(level * 100, 1))}%
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
            <strong>{translateText(chosen.name)}</strong>
            <small>
              {translateText(chosen.id)} · {translateText(chosen.city)} ·{" "}
              {translateText(chosen.channel)}
            </small>
          </div>
          <span>
            {translateText("周销速 ")}
            <b>{translateText(fmt(chosen.weeklySales, 2))}</b>
          </span>
          <span>
            {translateText("有效库存 ")}
            <b>{translateText(fmt(chosen.effectiveStock))}</b>
          </span>
          <span>
            {translateText("本轮补库 ")}
            <b>{translateText(fmt(chosen.replenishment))}</b>
          </span>
          <span>
            WoS{translateText(" ")}
            <b>
              {translateText(fmt(chosen.beforeWos ?? 0, 2))} →{" "}
              {translateText(fmt(chosen.afterWos ?? 0, 2))}
            </b>
            {translateText(" ")}/ {chosen.targetWeeks}
            {translateText(" 周")}
          </span>
        </aside>
      )}
      <p className="planning-footnote">
        {translateText(
          "柱高 =（有效库存 + 本轮补库）÷（周销速 × 目标 WoS）。已有高库存门店保持原水位，不强行注水。订单车单列；播放仅查看本轮快照，调整规则后需模拟重跑。",
        )}
      </p>
    </section>
  );
}
