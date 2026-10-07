"use client";
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
  return (
    <StreamContext.Provider value={run}>{children}</StreamContext.Provider>
  );
}
export function StreamBlock({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const run = useContext(StreamContext);
  if (!run) return <>{children}</>;
  const block = run.blocks.find((item) => item.type === name);
  if (!block || block.status === "queued") return null;
  return (
    <div
      className={`skill-gui-block ${block.status}`}
      id={`${run.id}-${name}`}
      data-testid="skill-gui-block"
      data-block-type={name}
      data-block-status={block.status}
      aria-label={block.title}
      aria-busy={block.status === "streaming"}
    >
      {block.status === "streaming" ? (
        <div className="skill-block-skeleton">
          <span />
          <strong>正在生成{block.title}…</strong>
          <i />
          <i />
        </div>
      ) : (
        children
      )}
    </div>
  );
}
