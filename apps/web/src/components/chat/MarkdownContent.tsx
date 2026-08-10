"use client";

import { memo, useCallback, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { remarkSmiles } from "@/lib/chat/markdown";
import { SmilesStructure } from "@/components/chat/SmilesStructure";
import "katex/dist/katex.min.css";
import styles from "./MarkdownContent.module.css";

function useCopyState() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, []);
  return { copied, copy };
}

function CodeBlock(props: {
  children?: ReactNode;
  className?: string;
  node?: { position?: { start?: { line?: number } } };
  [key: string]: unknown;
}) {
  const isInline = !props.className;
  const { copied, copy } = useCopyState();
  const langRaw = (/language-(\w+)/.exec(props.className || "") || [])[1];
  const lang = langRaw || "code";
  const content = typeof props.children === "string" ? props.children : "";

  if (isInline) {
    return <code className={styles.inlineCode}>{props.children}</code>;
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang}</span>
        <button type="button" className={styles.codeCopyBtn} onClick={() => copy(content)}>
          <i className={`fa-solid ${copied ? "fa-check" : "fa-copy"}`}></i>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.codePre}>
        <code className={`hljs ${props.className || ""}`}>{props.children}</code>
      </pre>
    </div>
  );
}

function BlockQuote({ children }: { children?: ReactNode }) {
  return <blockquote className={styles.blockquote}>{children}</blockquote>;
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const safe = href?.startsWith("http") || href?.startsWith("mailto:");
  if (!safe) return <span>{children}</span>;
  return (
    <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function MarkdownTable({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

function SmilesNode({ smiles }: { smiles?: string }) {
  if (!smiles) return null;
  return <SmilesStructure key={smiles} smiles={smiles} />;
}

export const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkSmiles]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={
          {
            code: CodeBlock,
            blockquote: BlockQuote,
            a: MarkdownLink,
            table: MarkdownTable,
            smiles: SmilesNode,
          } as unknown as Components
        }
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});