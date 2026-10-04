"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StoryWorkspace from "./story/StoryWorkspace";
import {
  addSession,
  createWorkspace,
  restoreWorkspace,
  type SessionSnapshot,
  type WorkspaceData,
} from "@/lib/sessions";
import { readWorkspace, writeWorkspace } from "@/lib/workspace-storage";

export default function SessionHost() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(createWorkspace);
  const [ready, setReady] = useState(false);
  const latestWorkspace = useRef(workspace);
  const saveTimer = useRef<number | null>(null);
  latestWorkspace.current = workspace;

  useEffect(() => {
    let cancelled = false;
    readWorkspace()
      .then((stored) => {
        if (!cancelled) setWorkspace(restoreWorkspace(stored));
      })
      .catch(() => {
        if (!cancelled) setWorkspace(createWorkspace());
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current !== null) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void writeWorkspace(latestWorkspace.current);
    }, 180);
  }, [ready, workspace]);

  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
  }, []);

  const updateSnapshot = useCallback((id: string, snapshot: SessionSnapshot) => {
    setWorkspace((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === id ? { ...session, snapshot } : session,
      ),
    }));
  }, []);

  const active =
    workspace.sessions.find((session) => session.id === workspace.activeId) ??
    workspace.sessions[0];

  if (!ready) {
    return <div className="story-loading" aria-label="正在恢复工作会话"><span>AT</span><p>正在恢复吉达单港工作会话…</p></div>;
  }
  if (!active) return null;

  return (
    <StoryWorkspace
      key={active.id}
      session={active}
      sessions={workspace.sessions}
      snapshot={active.snapshot}
      onSnapshot={updateSnapshot}
      onSelectSession={(id) =>
        setWorkspace((current) => ({ ...current, activeId: id }))
      }
      onNewSession={() =>
        setWorkspace((current) =>
          addSession(
            current,
            active.folderId,
            `单港演练 ${current.sessions.length + 1}`,
          ),
        )
      }
    />
  );
}
