"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StoryWorkspace from "./story/StoryWorkspace";
import {
  createWorkspace,
  freshSnapshot,
  restoreWorkspace,
  type Session,
  type SessionSnapshot,
  type WorkspaceData,
} from "@/lib/sessions";
import { readWorkspace, writeWorkspace } from "@/lib/workspace-storage";
import { resolveStorySkill } from "@/lib/story/skill-catalog";

function newDraft(folderId = "global"): Session {
  return {
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    folderId,
    title: "新任务",
    snapshot: freshSnapshot(),
  };
}

export default function SessionHost() {
  const [workspace, setWorkspace] = useState<WorkspaceData>(createWorkspace);
  const [draft, setDraft] = useState<Session>(() => newDraft());
  const [ready, setReady] = useState(false);
  const draftRef = useRef(draft);
  const latestWorkspace = useRef(workspace);
  const saveTimer = useRef<number | null>(null);
  draftRef.current = draft;
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
    if (!ready || saveTimer.current !== null) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      void writeWorkspace(latestWorkspace.current);
    }, 180);
  }, [ready, workspace]);
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const updateSnapshot = useCallback(
    (id: string, snapshot: SessionSnapshot) => {
      // A draft becomes a persisted session only after the first user submission.
      if (
        !snapshot.messages.some(
          (message) => message.role === "user" && message.text.trim(),
        )
      )
        return;
      const pending = draftRef.current;
      setWorkspace((current) => {
        if (current.sessions.some((session) => session.id === id))
          return {
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === id ? { ...session, snapshot } : session,
            ),
          };
        if (pending.id !== id) return current;
        const firstQuery = snapshot.messages.find(
          (message) => message.role === "user",
        )!.text;
        const skill = resolveStorySkill(firstQuery);
        const title =
          firstQuery.replace(/^\/\S+\s*/, "").trim() ||
          skill?.title ||
          "新任务";
        return {
          ...current,
          activeId: id,
          sessions: [
            ...current.sessions,
            { ...pending, title: title.slice(0, 26), snapshot },
          ],
        };
      });
    },
    [],
  );

  const active =
    workspace.sessions.find((session) => session.id === workspace.activeId) ??
    draft;
  if (!ready)
    return (
      <div className="story-loading" aria-label="正在恢复工作会话">
        <span>AT</span>
        <p>正在恢复工作会话…</p>
      </div>
    );

  return (
    <StoryWorkspace
      key={active.id}
      session={active}
      sessions={workspace.sessions}
      folders={workspace.folders}
      snapshot={active.snapshot}
      onSnapshot={updateSnapshot}
      onSelectSession={(id) =>
        setWorkspace((current) => ({ ...current, activeId: id }))
      }
      onNewSession={(folderId = "global") => {
        setDraft(newDraft(folderId));
        setWorkspace((current) => ({ ...current, activeId: "" }));
      }}
      onProjectChange={(folderId) => {
        if (workspace.sessions.some((session) => session.id === active.id)) {
          setWorkspace((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === active.id ? { ...session, folderId } : session,
            ),
          }));
        } else setDraft((current) => ({ ...current, folderId }));
      }}
    />
  );
}
