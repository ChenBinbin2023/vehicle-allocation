import { useI18n } from "@/lib/i18n/LocaleProvider";
// Adapted from frontend_alpha: retain the reference Skill markdown renderer.
function InlineThinkingMarkdown({ text }: { text: string }) {
  const { t: translateText } = useI18n();

  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\/[a-z][a-z0-9_-]*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={index}>{translateText(part.slice(1, -1))}</code>;
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={index}>{translateText(part.slice(2, -2))}</strong>
          );
        if (/^\/[a-z][a-z0-9_-]*$/.test(part))
          return (
            <code className="markdown-skill" key={index}>
              {translateText(part)}
            </code>
          );
        return <span key={index}>{translateText(part)}</span>;
      })}
    </>
  );
}

export function ThinkingMarkdown({
  text,
  streaming,
  orderedBullets = false,
}: {
  text: string;
  streaming: boolean;
  orderedBullets?: boolean;
}) {
  const { t: translateText } = useI18n();

  const blocks: Array<{ type: "line" | "code"; text: string }> = [];
  let codeLines: string[] | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      if (codeLines) {
        blocks.push({ type: "code", text: codeLines.join("\n") });
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    blocks.push({ type: "line", text: line });
  }
  if (codeLines) blocks.push({ type: "code", text: codeLines.join("\n") });

  let bulletNumber = 0;
  return (
    <div className="iaw-thinking-markdown">
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1;
        const cursor =
          isLast && streaming ? <i className="iaw-stream-caret" /> : null;
        if (block.type === "code")
          return (
            <pre key={index}>
              <code>
                {translateText(block.text)}
                {cursor}
              </code>
            </pre>
          );

        const line = block.text;
        if (line.startsWith("#### "))
          return (
            <h5 key={index}>
              <InlineThinkingMarkdown text={line.slice(5)} />
              {cursor}
            </h5>
          );
        if (line.startsWith("### "))
          return (
            <h4 key={index}>
              <InlineThinkingMarkdown text={line.slice(4)} />
              {cursor}
            </h4>
          );
        if (line.startsWith("## "))
          return (
            <h3 key={index}>
              <InlineThinkingMarkdown text={line.slice(3)} />
              {cursor}
            </h3>
          );
        if (line.startsWith("- ")) {
          bulletNumber += 1;
          return (
            <p className={orderedBullets ? "numbered" : "bullet"} key={index}>
              <span>
                {translateText(orderedBullets ? `${bulletNumber}.` : "•")}
              </span>
              <span>
                <InlineThinkingMarkdown text={line.slice(2)} />
                {cursor}
              </span>
            </p>
          );
        }
        if (/^\d+\. /.test(line))
          return (
            <p className="numbered" key={index}>
              <span>{translateText(line.match(/^\d+/)?.[0])}.</span>
              <span>
                <InlineThinkingMarkdown text={line.replace(/^\d+\. /, "")} />
                {cursor}
              </span>
            </p>
          );
        if (line.startsWith("> "))
          return (
            <blockquote key={index}>
              <InlineThinkingMarkdown text={line.slice(2)} />
              {cursor}
            </blockquote>
          );
        if (!line)
          return (
            <span className="space" key={index}>
              {cursor}
            </span>
          );
        return (
          <p key={index}>
            <InlineThinkingMarkdown text={line} />
            {cursor}
          </p>
        );
      })}
    </div>
  );
}
