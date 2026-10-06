"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { Session } from "@/lib/sessions";

export type WorkspaceView = "task" | "overview" | "data";

export default function WorkspaceSidebar({
  sessions,
  activeId,
  view,
  onView,
  onSelectSession,
  onNewSession,
}: {
  sessions: Session[];
  activeId: string;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <aside className="story-sidebar" data-testid="workspace-sidebar">
      <div className="story-brand">
        <span>AT</span>
        <div>
          <strong>ATLAS</strong>
          <small>Supply Chain Workspace</small>
        </div>
      </div>
      <div className="workspace-quick-actions">
        <button type="button" onClick={onNewSession} aria-label="新建 Session">
          <Plus size={16} />
          <span>新任务</span>
        </button>
      </div>
      <section className="workspace-sidebar-section">
        <div className="workspace-section-label">工作空间</div>
        <nav aria-label="工作空间">
          <button
            type="button"
            aria-label="供应链工作台"
            title="供应链工作台"
            className={view === "overview" ? "active" : ""}
            onClick={() => onView("overview")}
          >
            <LayoutDashboard size={16} />
            <span>供应链工作台</span>
          </button>
          <button
            type="button"
            aria-label="数据与业务规则"
            title="数据与业务规则"
            className={view === "data" ? "active" : ""}
            onClick={() => onView("data")}
          >
            <Database size={16} />
            <span>数据与业务规则</span>
          </button>
        </nav>
      </section>
      <section
        className="workspace-sidebar-section workspace-projects"
        data-testid="workspace-project-tree"
      >
        <div className="workspace-section-label">
          项目{" "}
          <button
            type="button"
            aria-label="新建项目任务"
            onClick={onNewSession}
          >
            <Plus size={13} />
          </button>
        </div>
        <button
          type="button"
          className="workspace-project-title"
          aria-label="ALJ · 沙特供应链"
          title="ALJ · 沙特供应链"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <FolderKanban size={15} />
          <strong>ALJ · 沙特供应链</strong>
        </button>
        {expanded && (
          <div className="workspace-session-tree">
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                className={
                  activeId === session.id && view === "task" ? "active" : ""
                }
                onClick={() => {
                  onView("task");
                  onSelectSession(session.id);
                }}
              >
                <MessageSquare size={13} />
                <span>{session.title}</span>
                {session.snapshot.campaign.runs.some(
                  (run) => run.status === "running",
                ) && <i />}
              </button>
            ))}
          </div>
        )}
      </section>
      <div className="workspace-account">
        <span>OM</span>
        <div>
          <strong>Omar</strong>
          <small>全国供应链负责人</small>
        </div>
        <span className="workspace-account-status" title="本地演示数据" />
      </div>
    </aside>
  );
}
