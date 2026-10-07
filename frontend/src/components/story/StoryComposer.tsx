"use client";
import { useI18n } from "@/lib/i18n/LocaleProvider";

import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  AudioLines,
  ChevronDown,
  FolderKanban,
  Mic,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Zap,
} from "lucide-react";
import { skillAvailability, storySkills } from "@/lib/story/skill-catalog";
import type { CampaignState } from "@/lib/story/types";
import type { Folder } from "@/lib/sessions";

export default function StoryComposer({
  campaign,
  draft,
  onDraft,
  onSubmit,
  folders,
  folderId,
  onProjectChange,
  onPlugins,
  busy,
  paused,
  onToggleRun,
  dispatchRunId,
}: {
  campaign: CampaignState;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (value: string) => void;
  folders: Folder[];
  folderId: string;
  onProjectChange: (id: string) => void;
  onPlugins: () => void;
  busy: boolean;
  paused: boolean;
  onToggleRun: () => void;
  dispatchRunId?: string;
}) {
  const { t: translateText } = useI18n();

  const [highlighted, setHighlighted] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const query = draft.trim().toLowerCase();
  const menuOpen = !dismissed && query.startsWith("/") && !/\s/.test(query);
  const options = useMemo(
    () => storySkills.filter((skill) => skill.command.startsWith(query)),
    [query],
  );
  const choose = (index: number) => {
    const skill = options[index];
    if (skill) {
      onDraft(`${skill.command} ${translateText(skill.defaultPrompt)}`);
      setDismissed(true);
      textarea.current?.focus();
    }
  };
  const submit = () => {
    if (draft.trim() && !busy && !paused) onSubmit(draft.trim());
  };
  return (
    <div className="cui-composer-wrap">
      {translateText(
        notice && (
          <div className="cui-composer-notice" role="status">
            {translateText(notice)}
            <button
              type="button"
              aria-label={translateText("关闭提示")}
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        ),
      )}
      {menuOpen && (
        <div
          className="story-skill-menu"
          role="listbox"
          aria-label={translateText("选择 Skill")}
        >
          <div className="story-skill-menu-title">
            {translateText("供应链 Skills")}
          </div>
          {options.map((skill, index) => {
            const availability = skillAvailability(
              skill.command,
              campaign,
              dispatchRunId,
            );
            return (
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                key={skill.command}
                data-testid="story-skill-option"
                className={`${index === highlighted ? "active" : ""} ${availability.available ? "available" : "unavailable"}`}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(index)}
              >
                <span>
                  <strong>{translateText(skill.command)}</strong>
                  <small>{translateText(skill.title)}</small>
                </span>
                <em>
                  {translateText(skill.description)}
                  <small>
                    {translateText(
                      availability.available ? "可运行" : availability.reason,
                    )}
                  </small>
                </em>
              </button>
            );
          })}
          {!options.length && (
            <p>{translateText("没有匹配的 Skill，按 Esc 继续输入。")}</p>
          )}
        </div>
      )}
      <form
        className="cui-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={textarea}
          data-testid="story-command"
          aria-label={translateText("输入任务或追问")}
          rows={2}
          value={draft}
          placeholder={translateText("输入任务或追问...")}
          onChange={(event) => {
            onDraft(event.target.value);
            setHighlighted(0);
            setDismissed(false);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              setDismissed(true);
              setSettings(false);
              return;
            }
            if (
              menuOpen &&
              options.length &&
              ["ArrowDown", "ArrowUp"].includes(event.key)
            ) {
              event.preventDefault();
              setHighlighted(
                (value) =>
                  (value +
                    (event.key === "ArrowDown" ? 1 : options.length - 1)) %
                  options.length,
              );
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (menuOpen && options.length) choose(highlighted);
              else submit();
            }
          }}
        />
        <div className="cui-composer-toolbar">
          <div>
            <button
              type="button"
              aria-label={translateText("添加 Skill")}
              onClick={() => {
                onDraft("/");
                setDismissed(false);
                textarea.current?.focus();
              }}
            >
              <Plus size={19} />
            </button>
            <span className="cui-access">
              <ShieldCheck size={16} />
              {translateText("完全访问")}
            </span>
          </div>
          <div className="cui-composer-model">
            <span>
              <Zap size={16} fill="currentColor" />
              5.6 Sol <em>{translateText("极高")}</em>
              <ChevronDown size={13} />
            </span>
            <button
              type="button"
              aria-label={translateText("语音输入")}
              onClick={() => setNotice("当前为本地演示，请通过文字输入任务。 ")}
            >
              <Mic size={18} />
            </button>
            {busy || paused ? (
              <button
                type="button"
                className="cui-send"
                aria-label={translateText(paused ? "继续任务" : "暂停任务")}
                onClick={onToggleRun}
              >
                {paused ? (
                  <ArrowUp size={17} />
                ) : (
                  <Square size={12} fill="currentColor" />
                )}
              </button>
            ) : (
              <button
                type="submit"
                className="cui-send"
                aria-label={translateText("发送")}
                disabled={!draft.trim()}
              >
                {draft.trim() ? (
                  <ArrowUp size={20} />
                ) : (
                  <AudioLines size={20} />
                )}
              </button>
            )}
          </div>
        </div>
      </form>
      <div className="cui-composer-contextbar">
        <label>
          <FolderKanban size={15} />
          <select
            aria-label={translateText("当前项目")}
            value={folderId}
            onChange={(event) => onProjectChange(event.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {translateText(folder.name)}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <button type="button" onClick={onPlugins}>
          <span className="cui-plugin-mark">
            <i />
            <i />
            <i />
          </span>
          {translateText("插件")}
        </button>
        <button
          type="button"
          aria-label={translateText("输入设置")}
          aria-expanded={settings}
          onClick={() => setSettings(!settings)}
        >
          <SlidersHorizontal size={15} />
        </button>
        {settings && (
          <div className="cui-settings">
            <strong>{translateText("输入设置")}</strong>
            <p>{translateText("Enter 发送 · Shift + Enter 换行")}</p>
            <p>{translateText("输入 / 选择 Skill · Esc 关闭菜单")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
