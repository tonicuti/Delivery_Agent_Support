import { Fragment } from "react";

const BOLD = /\*\*(.+?)\*\*/g;

function inline(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    parts.push(text.slice(last, match.index));
    parts.push(<strong key={match.index}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Just enough formatting for chat answers (paragraphs, bullets, numbered lists, bold). Never raw HTML. */
export default function Markdownish({ text }) {
  const blocks = [];
  let list = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•])\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const kind = numbered ? "ol" : "ul";
      if (!list || list.kind !== kind) { list = { kind, items: [] }; blocks.push(list); }
      list.items.push((bullet ?? numbered)[1]);
    } else if (line.trim()) {
      list = null;
      blocks.push({ kind: "p", text: line.replace(/^#+\s*/, "") });
    } else {
      list = null;
    }
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      {blocks.map((b, i) => b.kind === "p"
        ? <p key={i}>{inline(b.text)}</p>
        : b.kind === "ul"
          ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((t, j) => <Fragment key={j}><li>{inline(t)}</li></Fragment>)}</ol>)}
    </div>
  );
}
