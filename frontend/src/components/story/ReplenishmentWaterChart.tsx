"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import type { VesselReplenishment } from "@/lib/story/vessel-replenishment";

const fmt = (n: number, d = 0) =>
  n.toLocaleString("zh-CN", { maximumFractionDigits: d });
export default function ReplenishmentWaterChart({
  result,
  frame,
  progress,
  playing,
  speed,
  selected,
  setProgress,
  setPlaying,
  setSpeed,
  setSelected,
}: {
  result: VesselReplenishment;
  frame: VesselReplenishment;
  progress: number;
  playing: boolean;
  speed: number;
  selected: string;
  setProgress: (n: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setSelected: (id: string) => void;
}) {
  const { t: translateText } = useI18n();

  const [count, setCount] = useState(8),
    [page, setPage] = useState(0);
  const step = Math.max(1, Math.ceil(result.summary.budget / 80));
  const groups = (["直营", "授权"] as const).map((channel) => {
    const all = [...result.stores]
      .filter((s) => s.channel === channel)
      .sort(
        (a, b) =>
          (a.beforeSatisfaction ?? Infinity) -
            (b.beforeSatisfaction ?? Infinity) || a.id.localeCompare(b.id),
      );
    const start = Math.min(page * count, Math.max(0, all.length - count));
    return {
      channel,
      all,
      stores: all
        .slice(start, start + count)
        .map((s) => frame.stores.find((r) => r.id === s.id)!),
    };
  });
  const shown = groups.flatMap((g) => g.stores);
  const ymax =
    Math.max(1.2, ...shown.map((s) => s.afterSatisfaction ?? 0)) * 1.05;
  const y = (ratio: number) => 287 - (ratio / ymax) * 228;
  const gap = 54,
    left = 66,
    pitch = 42,
    channelWidth = count * pitch;
  const width = left + channelWidth * 2 + gap + 25;
  const chose = frame.stores.find((s) => s.id === selected) ?? frame.stores[0];
  const active = groups.filter((g) =>
    frame.stores.some((s) => s.channel === g.channel && s.replenishment > 0),
  );
  const stage =
    progress === 0
      ? result.summary.budget
        ? "等待注水"
        : "无可用补库车辆"
      : progress === result.summary.budget
        ? "本轮补库完成"
        : active.length === 1
          ? `${active[0].channel}注水 · ${active[0].channel === "直营" ? "授权" : "直营"}尚未起注`
          : active.length === 2
            ? "直营 / 授权共同注水"
            : "库存已达标或车型搭配受限";
  function seek(value: number) {
    setPlaying(false);
    setProgress(value);
  }
  const pages = Math.max(...groups.map((g) => Math.ceil(g.all.length / count)));
  return (
    <section className="vr-panel vr-water-panel" data-testid="waterfill-player">
      <header className="vr-panel-heading">
        <div>
          <small>WATERFILL SIMULATION</small>
          <h3>{translateText("门店动态注水")}</h3>
        </div>
        <span className="vr-stage" data-testid="water-stage">
          {translateText(stage)}
        </span>
      </header>
      <div className="vr-water-toolbar">
        <button aria-label={translateText("重新演示")} onClick={() => seek(0)}>
          <RotateCcw size={14} />
        </button>
        <button
          aria-label={translateText("上一步注水")}
          onClick={() => seek(Math.max(0, progress - step))}
        >
          <SkipBack size={14} />
        </button>
        <button
          className="vr-play"
          aria-label={translateText(playing ? "暂停注水" : "播放注水")}
          disabled={!result.summary.budget}
          onClick={() => {
            if (progress >= result.summary.budget) setProgress(0);
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          {translateText(playing ? "暂停" : "播放")}
        </button>
        <button
          aria-label={translateText("下一步注水")}
          onClick={() => seek(Math.min(result.summary.budget, progress + step))}
        >
          <SkipForward size={14} />
        </button>
        <select
          aria-label={translateText("注水播放速度")}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {[0.5, 1, 2, 4].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
        <button onClick={() => seek(result.summary.budget)}>
          {translateText("查看最终水位")}
        </button>
      </div>
      <div className="vr-water-progress">
        <div>
          <span>
            {translateText("当前注入")}
            {translateText(" ")}
            <b data-testid="water-progress">
              {translateText(fmt(progress))} /{" "}
              {translateText(fmt(result.summary.budget))}
              {translateText(" 台")}
            </b>
          </span>
          <span>
            {translateText("已分")}
            {translateText(" ")}
            <b data-testid="water-assigned">
              {translateText(fmt(frame.summary.replenishment))}
            </b>
            {translateText(" ")}
            {translateText("台")}
          </span>
        </div>
        <input
          type="range"
          aria-label={translateText("注水进度")}
          min="0"
          max={result.summary.budget}
          step="1"
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <small>
          {translateText("未注入 ")}
          {translateText(fmt(result.summary.budget - progress))}
          {translateText(" 台 · 已注入未分配")}
          {translateText(" ")}
          {translateText(fmt(frame.summary.unallocatedInjection))}
          {translateText(" 台 · 预留")}
          {translateText(" ")}
          {translateText(fmt(result.summary.reserved))}
          {translateText(" 台")}
        </small>
      </div>
      <div className="vr-water-legend">
        <span>
          <i className="vr-existing" />
          {translateText("分车前库存")}
        </span>
        <span>
          <i className="vr-added" />
          {translateText("本轮补库")}
        </span>
        <span>
          <i className="vr-full" />
          {translateText("已达目标")}
        </span>
        <span>{translateText("┄ 目标 100%")}</span>
      </div>
      <div className="vr-chart-options">
        <label>
          {translateText("每组展示")}
          {translateText(" ")}
          <select
            aria-label={translateText("每组展示门店数")}
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setPage(0);
            }}
          >
            {[5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
                {translateText(" 家")}
              </option>
            ))}
          </select>
        </label>
        <span>{translateText("全部 79 家参与计算")}</span>
        <div>
          <button
            aria-label={translateText("上一组门店")}
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            aria-label={translateText("下一组门店")}
            disabled={page >= pages - 1}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </div>
      </div>
      <div className="vr-water-scroll">
        <svg
          viewBox={`0 0 ${width} 358`}
          width={width}
          height="358"
          role="group"
          aria-label={translateText("直营与授权门店满足率注水图")}
        >
          <text
            x="18"
            y="177"
            fill="#809286"
            fontSize="11"
            transform="rotate(-90 18 177)"
          >
            {translateText("库存目标满足率")}
          </text>
          {[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]
            .filter((t) => t <= ymax)
            .map((t) => (
              <g key={t}>
                <line
                  x1={left - 10}
                  y1={y(t)}
                  x2={width - 12}
                  y2={y(t)}
                  stroke={t === 1 ? "#9b8b60" : "#e8efea"}
                  strokeDasharray={t === 1 ? "5 5" : undefined}
                />
                <text
                  x={left - 16}
                  y={y(t) + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#85998b"
                >
                  {translateText(fmt(t * 100))}%
                </text>
              </g>
            ))}
          {groups.map((g, groupIndex) => {
            const start = left + groupIndex * (channelWidth + gap);
            const level =
              frame.waterLevels[g.channel === "直营" ? "direct" : "authorized"];
            const total = frame.stores
              .filter((s) => s.channel === g.channel)
              .reduce((n, s) => n + s.replenishment, 0);
            return (
              <g key={g.channel} data-water-channel={g.channel}>
                <rect
                  x={start - 8}
                  y="49"
                  width={channelWidth + 6}
                  height="239"
                  fill={groupIndex === 0 ? "#eaf2ed" : "#e4f4f0"}
                  opacity=".3"
                />
                <text
                  x={start + channelWidth / 2 - 12}
                  y="21"
                  textAnchor="middle"
                  fill={groupIndex ? "#608672" : "#4e755f"}
                  fontSize="13"
                  fontWeight="600"
                >
                  {translateText(g.channel)}
                  {translateText("店 · ")}
                  {g.all.length}
                  {translateText(" 家")}
                </text>
                <text
                  x={start + channelWidth / 2 - 12}
                  y="39"
                  textAnchor="middle"
                  fill="#82958a"
                  fontSize="10"
                >
                  {translateText("已补 ")}
                  {translateText(fmt(total))}
                  {translateText(" 台 · 当前水位 ")}
                  {translateText(fmt(level * 100, 1))}%
                </text>
                {g.stores.map((s, index) => {
                  const x = start + index * pitch,
                    before = s.beforeSatisfaction ?? 0,
                    after = s.afterSatisfaction ?? before;
                  return (
                    <g
                      key={s.id}
                      data-water-store={s.id}
                      data-replenishment={s.replenishment}
                      role="button"
                      tabIndex={0}
                      aria-label={translateText(
                        `${s.shortName} ${s.name} 满足率 ${fmt(after * 100, 1)}%`,
                      )}
                      aria-pressed={selected === s.id}
                      onClick={() => setSelected(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(s.id);
                        }
                      }}
                    >
                      <rect
                        x={x - 5}
                        y="50"
                        width="38"
                        height="280"
                        rx="4"
                        fill={selected === s.id ? "#edf4ef" : "transparent"}
                      />
                      <rect
                        x={x}
                        y={y(before)}
                        width="28"
                        height={Math.max(0, y(0) - y(before))}
                        fill={before >= 1 ? "#b8c8bd" : "#577c66"}
                        rx="1"
                      />
                      <rect
                        x={x}
                        y={y(after)}
                        width="28"
                        height={Math.max(0, y(before) - y(after))}
                        fill="#a4c8b2"
                      />
                      <text
                        x={x + 14}
                        y={y(after) - 6}
                        textAnchor="middle"
                        fill="#56715f"
                        fontSize="9"
                      >
                        {translateText(fmt(after * 100))}%
                      </text>
                      {s.replenishment > 0 && (
                        <text
                          x={x + 14}
                          y={y(after) + 14}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#4e755f"
                        >
                          +{s.replenishment}
                        </text>
                      )}
                      <text
                        x={x + 14}
                        y="307"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#647e6d"
                      >
                        {translateText(s.shortName)}
                      </text>
                      <text
                        x={x + 14}
                        y="321"
                        textAnchor="middle"
                        fontSize="9"
                        fill="#8d9d92"
                      >
                        {translateText(s.city)}
                      </text>
                      <title>
                        {translateText(s.name)}
                        {translateText("：库存 ")}
                        {s.stock}
                        {translateText(" 台，补库 ")}
                        {s.replenishment}
                        {translateText(" ")}
                        {translateText("台；满足率 ")}
                        {translateText(fmt(before * 100, 1))}% →
                        {translateText(" ")}
                        {translateText(fmt(after * 100, 1))}
                        {translateText("%；目标 ")}
                        {translateText(fmt(s.targetWeeks, 2))}
                        {translateText(" ")}
                        {translateText("周。")}
                      </title>
                    </g>
                  );
                })}
                {level > 0 && (
                  <line
                    x1={start - 6}
                    y1={y(level)}
                    x2={start + channelWidth - 10}
                    y2={y(level)}
                    stroke={groupIndex ? "#83a48e" : "#557b66"}
                    strokeWidth="2"
                  />
                )}
              </g>
            );
          })}
          <text
            x={width - 14}
            y={y(1) - 7}
            textAnchor="end"
            fontSize="10"
            fill="#968350"
          >
            {translateText("100% 目标线")}
          </text>
        </svg>
      </div>
      <aside className="vr-store-inspector">
        <div>
          <strong>
            {translateText(chose.shortName)} · {translateText(chose.name)}
          </strong>
          <small>
            {translateText(chose.channel)} · {translateText(chose.region)}
            {translateText(" · 目标 ")}
            {translateText(fmt(chose.targetWeeks, 2))}
            {translateText(" ")}
            {translateText("周")}
          </small>
        </div>
        <dl>
          <div>
            <dt>{translateText("库存 WoS")}</dt>
            <dd>
              {translateText(fmt(chose.beforeWos ?? 0, 2))}
              {translateText(" 周")}
            </dd>
          </div>
          <div>
            <dt>{translateText("分车前满足率")}</dt>
            <dd>
              {translateText(fmt((chose.beforeSatisfaction ?? 0) * 100, 1))}%
            </dd>
          </div>
          <div>
            <dt>{translateText("分车后满足率")}</dt>
            <dd>
              {translateText(fmt((chose.afterSatisfaction ?? 0) * 100, 1))}%
            </dd>
          </div>
          <div>
            <dt>{translateText("已补库 / 搭配")}</dt>
            <dd>
              {chose.replenishment} / {chose.pairedQty}
              {translateText(" 台")}
            </dd>
          </div>
        </dl>
      </aside>
      <p className="vr-footnote">
        {translateText(
          "柱高 =（现有库存 + 已补库车辆）÷ 加成后周销速 ÷ 加成后目标 WoS。图中分车后水位为归属覆盖，VPC 暂存车辆尚未计入门店实物库存。",
        )}
      </p>
    </section>
  );
}
