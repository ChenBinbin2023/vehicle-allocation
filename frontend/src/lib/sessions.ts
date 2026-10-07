import { createCampaignState } from "./story/seed";
import { restoreCampaignState } from "./story/state";
import type { CampaignState, StoryStage } from "./story/types";

export type StoryMessage = {
  id: number;
  role: "user" | "agent";
  text: string;
  title?: string;
  storyRunId?: string;
  createdAt?: string;
};

export type SessionSnapshot = {
  campaign: CampaignState;
  activeStage: StoryStage | "welcome";
  canvasMode: "business" | "process";
  messages: StoryMessage[];
  draft: string;
};

export type Session = {
  id: string;
  folderId: string;
  title: string;
  snapshot: SessionSnapshot;
};

export type Folder = { id: string; name: string };

export type WorkspaceData = {
  version: 3;
  folders: Folder[];
  sessions: Session[];
  activeId: string;
};

// Keep the supply-chain entry separate from cached sessions in the old demo.
export const WORKSPACE_STORAGE = "atlas-supply-chain-workspace-v3";

const id = () =>
  `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function freshSnapshot(): SessionSnapshot {
  return {
    campaign: createCampaignState(),
    activeStage: "welcome",
    canvasMode: "business",
    messages: [],
    draft: "",
  };
}

export function createWorkspace(): WorkspaceData {
  return {
    version: 3,
    folders: [
      { id: "global", name: "全局" },
      { id: "single-port", name: "分车计划" },
    ],
    sessions: [],
    activeId: "",
  };
}

export function addFolder(
  workspace: WorkspaceData,
  name: string,
): WorkspaceData {
  if (!name.trim()) throw new Error("请输入文件夹名称");
  return {
    ...workspace,
    folders: [...workspace.folders, { id: id(), name: name.trim() }],
  };
}

export function addSession(
  workspace: WorkspaceData,
  folderId: string,
  title = "新供应保障 Session",
): WorkspaceData {
  if (!workspace.folders.some((folder) => folder.id === folderId)) {
    throw new Error("文件夹不存在");
  }
  const session: Session = {
    id: id(),
    folderId,
    title: title.trim() || "新供应保障 Session",
    snapshot: freshSnapshot(),
  };
  return {
    ...workspace,
    sessions: [...workspace.sessions, session],
    activeId: session.id,
  };
}

export function restoreWorkspace(
  raw: string | null,
  _legacy?: string | null,
): WorkspaceData {
  try {
    const value = JSON.parse(raw ?? "null") as WorkspaceData | null;
    if (
      value?.version !== 3 ||
      !Array.isArray(value.folders) ||
      value.folders.length === 0 ||
      !Array.isArray(value.sessions)
    ) {
      return createWorkspace();
    }
    const sessions = value.sessions
      .filter((session) =>
        value.folders.some((folder) => folder.id === session.folderId),
      )
      .map((session) => ({
        ...session,
        snapshot: {
          ...freshSnapshot(),
          ...session.snapshot,
          campaign: restoreCampaignState(session.snapshot?.campaign),
          messages: Array.isArray(session.snapshot?.messages)
            ? session.snapshot.messages
            : [],
        },
      }));
    const folders = value.folders.map((folder) =>
      folder.id === "single-port" ? { ...folder, name: "分车计划" } : folder,
    );
    if (!folders.some((folder) => folder.id === "global"))
      folders.unshift({ id: "global", name: "全局" });
    return {
      version: 3,
      folders,
      sessions,
      activeId:
        value.activeId === ""
          ? ""
          : sessions.some((session) => session.id === value.activeId)
            ? value.activeId
            : (sessions[0]?.id ?? ""),
    };
  } catch {
    return createWorkspace();
  }
}
