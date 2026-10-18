import Link from "next/link";
import type { InlineNode, RichText as RichTextDoc } from "@/lib/cms/rich-text";

/** Renderiza texto rico estruturado. Todo texto passa pelo escape do React. */
function Inline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === "link") {
          const internal = n.href.startsWith("/");
          return internal ? (
            <Link key={i} href={n.href} className="font-semibold text-brand-800 underline underline-offset-4">{n.text}</Link>
          ) : (
            <a key={i} href={n.href} rel="noopener noreferrer" target={n.href.startsWith("https://") ? "_blank" : undefined}
              className="font-semibold text-brand-800 underline underline-offset-4">{n.text}</a>
          );
        }
        let el: React.ReactNode = n.text;
        if (n.italic) el = <em>{el}</em>;
        if (n.bold) el = <strong>{el}</strong>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

export function RichText({ doc }: { doc: RichTextDoc }) {
  return (
    <div className="flex flex-col gap-4 text-base leading-relaxed text-ink">
      {doc.map((node, i) => {
        switch (node.t) {
          case "p":
            return <p key={i}><Inline nodes={node.children} /></p>;
          case "h":
            return node.level === 2 ? (
              <h2 key={i} className="mt-2 text-xl font-bold text-brand-800"><Inline nodes={node.children} /></h2>
            ) : (
              <h3 key={i} className="mt-2 text-lg font-semibold text-brand-800"><Inline nodes={node.children} /></h3>
            );
          case "ul":
            return <ul key={i} className="list-disc pl-6">{node.items.map((it, j) => <li key={j}><Inline nodes={it} /></li>)}</ul>;
          case "ol":
            return <ol key={i} className="list-decimal pl-6">{node.items.map((it, j) => <li key={j}><Inline nodes={it} /></li>)}</ol>;
        }
      })}
    </div>
  );
}
