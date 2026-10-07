import type { Session } from "../sessions";
import { resolveStorySkill } from "../story/skill-catalog";
import { translate, type Locale } from "./translate";

export function localizedSessionTitle(
  session: Session,
  locale: Locale,
): string {
  if (locale === "zh-CN") return session.title;
  const firstMessage = session.snapshot.messages.find(
    (message) => message.role === "user",
  );
  if (!firstMessage) return translate(session.title, locale);

  const prompt = firstMessage.text.replace(/^\/\S+\s*/, "").trim();
  if (!prompt) return translate(session.title, locale);
  // SessionHost saves only the first 26 characters. Translate the complete
  // original prompt so an old, truncated title cannot miss its dictionary entry.
  if (session.title !== prompt.slice(0, 26) && session.title !== prompt)
    return session.title;
  const translated = translate(prompt, locale);
  if (!/[\u4e00-\u9fff]/.test(translated)) return translated;

  const skill =
    resolveStorySkill(firstMessage.text) ??
    resolveStorySkill(session.snapshot.campaign.runs[0]?.command ?? "");
  // Free-form user input remains in the conversation; generated navigation
  // titles use the Skill name when the custom prompt has no English translation.
  return translate(skill?.title ?? "新任务", locale);
}
