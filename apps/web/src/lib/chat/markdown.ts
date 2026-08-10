import type { Parent, Root, Text } from "mdast";
import { looksLikeSmiles } from "./smiles";

const TOKEN_RE = /\[[A-Za-z0-9@+\-.]+\]|[A-Za-z0-9[\]()=#+\-\\/@.%]{3,}/g;

type Child = Text | { type: "smiles"; smiles: string };

type MutableNode = {
  type?: string;
  value?: unknown;
  children?: unknown[];
};

function isMathScope(parentNode: Parent): boolean {
  return parentNode.type === "math" || parentNode.type === "inlineMath";
}

/**
 * Remark plugin: scans plain-text runs for SMILES-like tokens and replaces
 * them with custom `smiles` nodes so ReactMarkdown can render 2D structures
 * via a components override. Falls back gracefully if the token isn't valid.
 */
export function remarkSmiles() {
  return (tree: Root): void => {
    const targets: { parent: Parent; text: Text }[] = [];

    const walk = (parent: Parent, node: MutableNode) => {
      if (node.type === "text" && node.value !== undefined) {
        targets.push({ parent, text: node as unknown as Text });
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          if (child && typeof child === "object") walk(node as Parent, child as MutableNode);
        }
      }
    };
    walk(tree, tree as unknown as MutableNode);

    for (const { parent, text } of targets) {
      if (isMathScope(parent)) continue;
      if (parent.type === "code" || parent.type === "inlineCode") continue;

      const value: string = text.value;
      const children: Child[] = [];
      let lastIndex = 0;
      let found = false;

      TOKEN_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TOKEN_RE.exec(value))) {
        if (!looksLikeSmiles(m[0])) continue;
        found = true;
        if (m.index > lastIndex) {
          children.push({ type: "text", value: value.slice(lastIndex, m.index) });
        }
        children.push({ type: "smiles", smiles: m[0] });
        lastIndex = m.index + m[0].length;
      }

      if (found && lastIndex < value.length) {
        children.push({ type: "text", value: value.slice(lastIndex) });
      }
      if (!found) continue;

      const i = parent.children.indexOf(text);
      parent.children.splice(i, 1, ...(children as unknown as (typeof parent.children)[number][]));
    }
  };
}