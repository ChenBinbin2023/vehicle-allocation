"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { createContext, useContext, type ReactNode } from "react";
import type { StoryRun } from "@/lib/story/types";

const StreamContext = createContext<StoryRun | null>(null);
export function SkillStream({
  run,
  children,
}: {
  run: StoryRun;
  children: ReactNode;
}) {
  const { t: translateText } = useI18n();

  return (
    <StreamContext.Provider value={run}>
      {translateText(children)}
    </StreamContext.Provider>
  );
}
export function StreamBlock({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const { t: translateText } = useI18n();

  const run = useContext(StreamContext);
  if (!run) return <>{translateText(children)}</>;
  const block = run.blocks.find((item) => item.type === name);
  if (!block || block.status === "queued") return null;
  return (
    <div
      className={`skill-gui-block ${block.status}`}
      id={`${run.id}-${name}`}
      data-testid="skill-gui-block"
      data-block-type={name}
      data-block-status={block.status}
      aria-label={translateText(block.title)}
      aria-busy={block.status === "streaming"}
    >
      {translateText(
        block.status === "streaming" ? (
          <div className="skill-block-skeleton">
            <span />
            <strong>
              {translateText("正在生成")}
              {translateText(block.title)}…
            </strong>
            <i />
            <i />
          </div>
        ) : (
          children
        ),
      )}
    </div>
  );
}
