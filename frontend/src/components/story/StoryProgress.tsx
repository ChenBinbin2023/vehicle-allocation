"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  PackageCheck,
  Route,
  Ship,
  Shuffle,
} from "lucide-react";
import type { CampaignState, StoryCommand, StoryStage } from "@/lib/story/types";

const stages: Array<{
  command: StoryCommand;
  stage: StoryStage;
  label: string;
  window: string;
  icon: typeof Ship;
}> = [
  { command: "/crisis-brief", stage: "crisis", label: "单港影响研判", window: "T-14", icon: AlertTriangle },
  { command: "/vessel-allocation", stage: "allocation", label: "船次分车", window: "T-10", icon: Ship },
  { command: "/delivery-plan", stage: "delivery", label: "物流方案", window: "T-7", icon: Route },
  { command: "/arrival-execution", stage: "execution", label: "到港执行", window: "T0–T+3", icon: PackageCheck },
  { command: "/daily-rebalance", stage: "rebalance", label: "每日调拨", window: "T+4 起", icon: Shuffle },
];

export default function StoryProgress({
  campaign,
  activeStage,
  onSelect,
}: {
  campaign: CampaignState;
  activeStage: StoryStage | "welcome";
  onSelect: (stage: StoryStage) => void;
}) {
  return (
    <section className="story-progress" data-testid="story-progress">
      <div className="story-sidebar-label">故事进度</div>
      <div className="story-progress-list">
        {stages.map((item, index) => {
          const runs = campaign.runs.filter((run) => run.command === item.command);
          const latest = runs.at(-1);
          const unlocked = Boolean(latest);
          const complete = latest?.status === "complete";
          const running = latest?.status === "running" || latest?.status === "paused";
          const Icon = item.icon;
          return (
            <button
              key={item.command}
              type="button"
              data-testid={`stage-${item.stage}`}
              className={`story-stage ${activeStage === item.stage ? "active" : ""}`}
              disabled={!unlocked}
              onClick={() => unlocked && onSelect(item.stage)}
            >
              <span className={`story-stage-index ${complete ? "complete" : running ? "running" : ""}`}>
                {complete ? <Check size={13} /> : <Circle size={9} />}
              </span>
              <span className="story-stage-copy">
                <strong><Icon size={14} />{item.label}</strong>
                <small>{item.window} · {runs.length ? `${runs.length} 次运行` : index === 0 ? "从 CUI 发起" : "等待前序 Skill"}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
