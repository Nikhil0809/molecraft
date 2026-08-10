/**
 * Best-effort heuristic: is this token likely a SMILES string rather than a
 * plain English word? Used only to decide whether to attempt 2D rendering —
 * the renderer falls back to plain text when parsing fails.
 */
const PURE_ORGANIC_RE = /^(?:Cl|Br|Si|Se|As|[CONPSIFB]|[cnops]){2,5}$/;
const PURE_LETTER_BLOCKLIST = new Set([
  "con", "cos", "son", "can", "cat", "sos", "bin", "pin", "tin", "sin", "win",
  "cup", "bag", "fig", "gun", "peg", "ced", "con", "cop", "nap", "pad", "pen",
  "red", "run", "sit", "tip", "tan", "tun", "urn", "uso", "eva", "eda", "pfa",
]);

export function looksLikeSmiles(token: string): boolean {
  if (!token || token.length < 3 || token.length > 250) return false;

  const first = token[0];
  if (first === "[") {
    if (!/^\[[A-Za-z][a-zA-Z0-9@+\-.]*\]/.test(token)) return false;
  } else if (!/[A-Za-z]/.test(first)) {
    return false;
  } else if (first === first.toLowerCase()) {
    // lowercase start is only valid for aromatic atoms
    if (!"cnopsb".includes(first)) return false;
  }

  const hasStructuralChar = /[\[\]()=#+\-\\/@0-9]/.test(token);

  // Pure-letter organic chain (e.g. "CCO", "CCN") — short only.
  if (!hasStructuralChar) {
    if (token.length > 5) return false;
    if (!PURE_ORGANIC_RE.test(token)) return false;
    if (PURE_LETTER_BLOCKLIST.has(token.toLowerCase())) return false;
    return true;
  }

  // Skip plain words with a trailing digit (CDK4, HER2, KRAS, MDMX...).
  if (/^[A-Z][a-z]*\d+$/.test(token)) return false;

  // Balanced parentheses/brackets.
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const ch of token) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch === ")" || ch === "]" || ch === "}") {
      const open = pairs[ch];
      if (stack.pop() !== open) return false;
    }
  }
  if (stack.length > 0) return false;

  // Needs at least one real atom.
  const uppercaseAtoms = token.match(/Cl|Br|Se|As|Si|[A-Z]/g) ?? [];
  if (uppercaseAtoms.length === 0) {
    // All-aromatic chains (c1ccccc1) must carry ring digits or brackets.
    return /[0-9\[\]]/.test(token) && /[cnops]/.test(token);
  }

  // Common English/chemistry tokens with letters+digits that are not SMILES.
  const banned = /^(?:e|g|ic|ec|etc|fig|ref|table|no|vs|et|al|fda|cdk|her|braf|kras|mdm|pdr1)?\.?\d*$/i;
  if (banned.test(token)) return false;

  return true;
}

/** Extract every inline text token that looks like a SMILES string. */
export function findSmilesCandidates(text: string): string[] {
  const matches = text.match(/\[[^\]]+\]|[A-Za-z0-9[\]()=#+\-\\/@.%]{2,}/g) || [];
  const out: string[] = [];
  for (const m of matches) {
    if (looksLikeSmiles(m)) out.push(m);
  }
  return out;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.6));
}