"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Puzzle,
  Search,
} from "lucide-react";
import type { Folder, Session } from "@/lib/sessions";
import AccountMenu from "./AccountMenu";
import { localizedSessionTitle } from "@/lib/i18n/session-title";

export type WorkspaceView = "task" | "overview" | "data" | "plugins";
export default function WorkspaceSidebar({
  sessions,
  folders,
  activeId,
  activeFolderId,
  view,
  collapsed,
  onToggle,
  onView,
  onSelectSession,
  onNewSession,
}: {
  sessions: Session[];
  folders: Folder[];
  activeId: string;
  activeFolderId: string;
  view: WorkspaceView;
  collapsed: boolean;
  onToggle: () => void;
  onView: (view: WorkspaceView) => void;
  onSelectSession: (id: string) => void;
  onNewSession: (folderId?: string) => void;
}) {
  const { t: translateText, locale } = useI18n();

  const [closed, setClosed] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <aside className="story-sidebar" data-testid="workspace-sidebar">
      <div className="story-brand">
        <ChartNoAxesColumnIncreasing size={24} strokeWidth={2.5} />
        <strong>{translateText("供应链决策智能")}</strong>
        <button
          type="button"
          aria-label={translateText(collapsed ? "展开导航" : "收起导航")}
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>
      </div>
      <nav
        className="workspace-quick-actions"
        aria-label={translateText("快捷操作")}
      >
        <button
          type="button"
          onClick={() => onNewSession("global")}
          aria-label={translateText("新任务")}
        >
          <MessageSquare size={17} />
          <span>{translateText("新任务")}</span>
        </button>
        <button
          type="button"
          onClick={() => onView("plugins")}
          aria-label={translateText("插件")}
        >
          <Puzzle size={17} />
          <span>{translateText("插件")}</span>
        </button>
        <div className="workspace-more">
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            aria-label={translateText("更多")}
          >
            <MoreHorizontal size={17} />
            <span>{translateText("更多")}</span>
          </button>
          {moreOpen && (
            <div className="workspace-more-menu">
              <button
                type="button"
                onClick={() => {
                  onView("data");
                  setMoreOpen(false);
                }}
              >
                {translateText("数据与业务规则")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onView("overview");
                  setMoreOpen(false);
                }}
              >
                {translateText("工作台总览")}
              </button>
            </div>
          )}
        </div>
      </nav>
      <section className="workspace-sidebar-section">
        <div className="workspace-section-label">
          {translateText("工作空间 ")}
          <Search size={13} />
        </div>
        <nav aria-label={translateText("工作空间")}>
          <button
            type="button"
            className={view === "overview" ? "active" : ""}
            onClick={() => onView("overview")}
            aria-label={translateText("供应链工作台")}
          >
            <LayoutDashboard size={16} />
            <span>{translateText("供应链工作台")}</span>
          </button>
          <button
            type="button"
            className={view === "data" ? "active" : ""}
            onClick={() => onView("data")}
            aria-label={translateText("数据与业务规则")}
          >
            <FolderKanban size={16} />
            <span>{translateText("数据与业务规则")}</span>
          </button>
        </nav>
      </section>
      <section
        className="workspace-sidebar-section workspace-projects"
        data-testid="workspace-project-tree"
      >
        <div className="workspace-section-label">
          {translateText("项目")}
          {translateText(" ")}
          <button
            type="button"
            aria-label={translateText("在分车计划中新建任务")}
            onClick={() => onNewSession("single-port")}
          >
            <Plus size={14} />
          </button>
        </div>
        {folders.map((folder) => {
          const expanded = !closed.includes(folder.id);
          return (
            <div
              className="workspace-project"
              key={folder.id}
              data-folder-id={folder.id}
            >
              <div
                className={`workspace-project-row ${activeFolderId === folder.id && view === "task" ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="workspace-project-expand"
                  aria-label={translateText(
                    `${expanded ? "收起" : "展开"}${folder.name}`,
                  )}
                  aria-expanded={expanded}
                  onClick={() =>
                    setClosed((current) =>
                      expanded
                        ? [...current, folder.id]
                        : current.filter((id) => id !== folder.id),
                    )
                  }
                >
                  {expanded ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </button>
                <button
                  type="button"
                  className="workspace-project-title"
                  aria-label={translateText(folder.name)}
                  onClick={() => onNewSession(folder.id)}
                >
                  <FolderKanban size={15} />
                  <strong>{translateText(folder.name)}</strong>
                </button>
                <button
                  type="button"
                  className="workspace-project-add"
                  aria-label={translateText(`在${folder.name}中新建任务`)}
                  onClick={() => onNewSession(folder.id)}
                >
                  <Plus size={14} />
                </button>
              </div>
              {expanded && (
                <div className="workspace-session-tree">
                  {sessions
                    .filter((session) => session.folderId === folder.id)
                    .map((session) => (
                      <button
                        type="button"
                        key={session.id}
                        data-testid="workspace-session"
                        className={
                          activeId === session.id && view === "task"
                            ? "active"
                            : ""
                        }
                        onClick={() => {
                          onView("task");
                          onSelectSession(session.id);
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>{localizedSessionTitle(session, locale)}</span>
                        {session.snapshot.campaign.runs.some(
                          (run) => run.status === "running",
                        ) && <i />}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
      <AccountMenu />
    </aside>
  );
}
