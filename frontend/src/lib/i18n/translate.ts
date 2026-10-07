import core from "./core.en.json";
import planning from "./planning.en.json";
import analytics from "./analytics.en.json";
import domain from "./domain.en.json";

export type Locale = "zh-CN" | "en";
export const LOCALE_STORAGE = "atlas-interface-language";

const sourceMessages: Record<string, string> = {
  ...planning,
  ...analytics,
  ...core,
  ...domain,
  用户菜单: "User menu",
  界面语言: "Interface language",
};
const messages: Record<string, string> = Object.fromEntries(
  Object.entries(sourceMessages).map(([source, target]) => [
    source.trim(),
    target.trim(),
  ]),
);
// The CUI renders paragraphs and bullet lines separately from the original summary.
for (const [source, target] of Object.entries(messages)) {
  const sourceLines = source.split("\n").filter(Boolean);
  const targetLines = target.split("\n").filter(Boolean);
  if (sourceLines.length > 1 && sourceLines.length === targetLines.length)
    sourceLines.forEach((line, index) => {
      messages[line.replace(/^(?:[-•]\s|\d+\.\s)/, "").trim()] = targetLines[
        index
      ]
        .replace(/^(?:[-•]\s|\d+\.\s)/, "")
        .trim();
    });
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(messages)
  .filter(([source]) => /\{\d+\}/.test(source))
  .map(([source, target]) => {
    const anchors = source.split(/\{\d+\}/g);
    return {
      target,
      indices: Array.from(source.matchAll(/\{(\d+)\}/g), (match) =>
        Number(match[1]),
      ),
      anchor: [...anchors].sort((a, b) => b.length - a.length)[0],
      specificity: anchors.join("").length,
      pattern: new RegExp("^" + anchors.map(escape).join("([\\s\\S]*?)") + "$"),
    };
  })
  // Avoid patterns such as "{0} 台{1}" swallowing an entire composite narrative.
  .filter(
    (template) => template.specificity >= 4 || template.indices.length === 1,
  )
  .sort((a, b) => b.specificity - a.specificity);
const phrases = Object.keys(messages)
  .filter((source) => !/\{\d+\}/.test(source) && /[\u4e00-\u9fff]/.test(source))
  .sort((a, b) => b.length - a.length);
const phrasePattern = new RegExp(
  phrases
    .map(
      (source) =>
        (/^\d/.test(source) ? "(?<![\\d.,])" : "") +
        escape(source) +
        (/\d$/.test(source) ? "(?![\\d.,])" : ""),
    )
    .join("|"),
  "g",
);
const cache = new Map<string, string>();

function english(value: string, depth = 0): string {
  if (!/[\u4e00-\u9fff]/.test(value)) return value;
  // Source references and filenames remain usable in either interface language.
  if (/^(?:data|src|frontend)\/.+\.[a-z0-9]+$/i.test(value.trim()))
    return value;
  const cached = cache.get(value);
  if (cached !== undefined) return cached;
  const text = value.trim();
  let result = messages[text];
  if (result === undefined && text.includes("\n") && depth < 8)
    result = text
      .split("\n")
      .map((line) => english(line, depth + 1))
      .join("\n");
  const bullet = text.match(/^(?:[-•]\s|\d+\.\s)/)?.[0];
  if (result === undefined && bullet && depth < 8)
    result = bullet + english(text.slice(bullet.length), depth + 1);
  if (result === undefined && depth < 8) {
    // Some engine narratives concatenate complete sentences with a separate summary.
    for (const phrase of phrases) {
      if (phrase.length < 12 || !/[。.!?]$/.test(phrase)) continue;
      if (text.startsWith(phrase)) {
        result =
          messages[phrase] +
          " " +
          english(text.slice(phrase.length), depth + 1);
        break;
      }
      if (text.endsWith(phrase)) {
        result =
          english(text.slice(0, -phrase.length), depth + 1) +
          " " +
          messages[phrase];
        break;
      }
    }
  }
  if (result === undefined && depth < 8) {
    for (const template of templates) {
      if (!text.includes(template.anchor)) continue;
      const match = template.pattern.exec(text);
      if (!match) continue;
      result = template.target.replace(/\{(\d+)\}/g, (_, index: string) =>
        english(
          match[template.indices.indexOf(Number(index)) + 1] ?? "",
          depth + 1,
        ),
      );
      break;
    }
  }
  if (result === undefined)
    result = text
      .replace(phrasePattern, (source) => ` ${messages[source]} `)
      .replace(/[ \t]+/g, " ")
      .trim();
  if (/^[台笔家个辆]/.test(text) && !/^\s/.test(value)) result = " " + result;
  // Keep spacing in JSX text fragments (e.g. a number followed by its unit).
  result =
    value.slice(0, value.length - value.trimStart().length) +
    result +
    value.slice(value.trimEnd().length);
  if (cache.size > 10000) cache.clear();
  cache.set(value, result);
  return result;
}

/** Translate presentation strings only; business objects, IDs and input values stay intact. */
export function translate<T>(value: T, locale: Locale): T {
  if (locale === "zh-CN") return value;
  if (typeof value === "string") return english(value) as T;
  if (Array.isArray(value))
    return value.map((item) => translate(item, locale)) as T;
  return value;
}

const originalPrompts = new Map(
  Object.entries(messages)
    .filter(([source]) => !/\{\d+\}/.test(source))
    .map(([source, target]) => [target, source]),
);
const parameterNames: Record<string, string> = {
  "total supply": "总量",
  supply: "供给",
  total: "总量",
  reserveRatio: "预留比例",
  tierGap: "级差",
  baseWoS: "基准WoS",
  directWoS: "直营WoS",
  authorizedWoS: "授权WoS",
  D2Reception: "D2接车",
  "reserve ratio": "预留比例",
  reserve: "预留比例",
  "baseline WoS": "基准WoS",
  "base WoS": "基准WoS",
  "channel gap": "级差",
  gap: "级差",
  "direct WoS": "直营WoS",
  "authorized WoS": "授权WoS",
  "price coefficient": "价格系数",
  "logistics coefficient": "物流系数",
  "retail coefficient": "零售系数",
  "wholesale coefficient": "批发系数",
  model: "车型",
  price: "单价",
  purchase: "采购",
  discount: "折扣",
  commission: "佣金",
  other: "其他",
  "port fee": "港口费",
  "PDI fee": "整备",
  "last mile": "末端",
  "VPC fee": "VPC费",
  "storage fee": "暂存日费",
  "storage days": "暂存天数",
};
const parameters = new RegExp(
  "\\b(" + Object.keys(parameterNames).map(escape).join("|") + ")(?=\\s*=)",
  "gi",
);

/** Adapt English prompts at the calculation boundary, preserving the original conversation. */
export function toBusinessPrompt(value: string): string {
  const command = value.match(/^\/\S+\s+/)?.[0] ?? "";
  const detail = value.slice(command.length);
  const original = originalPrompts.get(detail.trim());
  if (original !== undefined) return command + original;
  let normalized = value
    .replace(
      /\bbrand\s*=\s*(Toyota|Lexus)\b/gi,
      (_, brand: string) =>
        "品牌=" + (brand.toLowerCase() === "lexus" ? "雷克萨斯" : "丰田"),
    )
    .replace(
      parameters,
      (name) =>
        parameterNames[
          Object.keys(parameterNames).find(
            (key) => key.toLowerCase() === name.toLowerCase(),
          )!
        ],
    )
    .replace(/\bsingle[ -]port\b/gi, "单港")
    .replace(/\bdual[ -]port\b/gi, "双港")
    .replace(/\breplenish(?:ment)?\b/gi, "补库")
    .replace(/\bdemo (?:cost )?rates\b/gi, "演示费率");
  // Profit snapshots use Chinese model labels; vessel simulations use distinct English model IDs.
  if (command.trim() === "/profit-analysis")
    normalized = normalized.replace(
      /车型\s*=\s*(Land Cruiser\s*300|Camry|Hilux)\b/gi,
      (_, model: string) =>
        "车型=" +
        ({
          camry: "凯美瑞",
          hilux: "海拉克斯",
          landcruiser300: "兰德酷路泽300",
        }[model.toLowerCase().replace(/\s/g, "")] ?? model),
    );
  return normalized;
}

export function matchesLocalizedText(text: string, keyword: string): boolean {
  const searchable = `${text} ${translate(text, "en")}`.toLowerCase();
  return keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => searchable.includes(word));
}
