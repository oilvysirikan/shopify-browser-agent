import { memo, type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__)/g);
  let cursor = 0;

  return parts.map((part) => {
    const partKey = `${keyPrefix}-${cursor}`;
    cursor += part.length;

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-[0.9em]"
          key={`${partKey}-code`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      ((part.startsWith("**") && part.endsWith("**")) ||
        (part.startsWith("__") && part.endsWith("__"))) &&
      part.length >= 4
    ) {
      return <strong key={`${partKey}-strong`}>{part.slice(2, -2)}</strong>;
    }

    return <span key={`${partKey}-text`}>{part}</span>;
  });
}

function renderMarkdownBasic(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim().startsWith("```")) {
      const fence = line.trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length && (lines[i] ?? "").trim().startsWith("```")) {
        i += 1;
      }
      elements.push(
        <pre
          className="overflow-x-auto rounded-md p-3 my-3 bg-neutral-100 dark:bg-neutral-900"
          key={`code-${elements.length}-${fence}`}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ulMatch) {
      const items: string[] = [];
      let listCursor = 0;
      while (i < lines.length) {
        const match = (lines[i] ?? "").match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      elements.push(
        <ul className="list-disc pl-6 my-2" key={`ul-${elements.length}`}>
          {items.map((item) => {
            const itemKey = `${elements.length}-${listCursor}`;
            listCursor += item.length;
            return (
              <li key={`ul-item-${itemKey}`}>
                {renderInline(item, `ul-${itemKey}`)}
              </li>
            );
          })}
        </ul>
      );
      continue;
    }

    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      const items: string[] = [];
      let listCursor = 0;
      while (i < lines.length) {
        const match = (lines[i] ?? "").match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      elements.push(
        <ol className="list-decimal pl-6 my-2" key={`ol-${elements.length}`}>
          {items.map((item) => {
            const itemKey = `${elements.length}-${listCursor}`;
            listCursor += item.length;
            return (
              <li key={`ol-item-${itemKey}`}>
                {renderInline(item, `ol-${itemKey}`)}
              </li>
            );
          })}
        </ol>
      );
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (i < lines.length && (lines[i] ?? "").trim() !== "") {
      const next = lines[i] ?? "";
      if (
        next.trim().startsWith("```") ||
        /^\s*[-*+]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }

    elements.push(
      <p className="my-2" key={`p-${elements.length}`}>
        {renderInline(paragraphLines.join(" "), `p-${elements.length}`)}
      </p>
    );
  }

  return elements;
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <div className="markdown-body break-words">{renderMarkdownBasic(content)}</div>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => (
    <MemoizedMarkdownBlock content={content} key={id} />
  )
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
