/**
 * Awesomebar calculator — Desk's awesomebar make_calculator (awesome_bar.js): an input that starts with a
 * digit, "(" or "=" and is arithmetic shows "<expr> = <result>". Desk evaluates it with eval after an
 * allow-list regex; here the expression is parsed by a small recursive-descent parser instead, so nothing
 * from the input is ever evaluated as code.
 */
import { formatNumber } from "@/lib/frappe/format";

type Token = { type: "num"; value: number; decimals: number } | { type: "op"; value: "+" | "-" | "*" | "/" | "%" | "(" | ")" };

const ALLOWED = /^[0-9+\-*/%().\s]+$/;
const NUMBER = /\d+(?:\.\d*)?|\.\d+/y;

/** Tokenize an allow-listed expression; null on anything unexpected. */
function tokenize(expr: string): Token[] | null {
  if (!ALLOWED.test(expr)) return null;
  const out: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
    } else if ("+-*/%()".includes(ch)) {
      out.push({ type: "op", value: ch as "+" | "-" | "*" | "/" | "%" | "(" | ")" });
      i++;
    } else {
      NUMBER.lastIndex = i;
      const m = NUMBER.exec(expr);
      if (!m) return null;
      const [text] = m;
      const dot = text.indexOf(".");
      out.push({ type: "num", value: Number(text), decimals: dot === -1 ? 0 : text.length - dot - 1 });
      i += text.length;
    }
  }
  return out;
}

export interface Arithmetic {
  value: number;
  /** most decimal places written in any operand (Desk formats the result with this precision) */
  decimals: number;
  /** at least one binary operator was used (a bare number is not a calculation) */
  hasOperator: boolean;
}

/** Safe arithmetic: numbers, + - * / %, parentheses, unary sign. Returns null on any error. */
export function evaluateArithmetic(expr: string): Arithmetic | null {
  const parsedTokens = tokenize(expr);
  if (!parsedTokens || parsedTokens.length === 0) return null;
  const tokens: Token[] = parsedTokens;
  let pos = 0;
  let hasOperator = false;
  const peek = () => tokens[pos];
  const isOp = (t: Token | undefined, ...ops: string[]) => t?.type === "op" && ops.includes(t.value);

  const fail = (): never => {
    throw new Error("syntax");
  };

  function primary(): number {
    const t = tokens[pos++];
    if (!t) return fail();
    if (t.type === "num") return t.value;
    if (t.value === "(") {
      const v = expression();
      if (!isOp(tokens[pos++], ")")) fail();
      return v;
    }
    if (t.value === "+" || t.value === "-") {
      const v = primary();
      return t.value === "-" ? -v : v;
    }
    return fail();
  }

  function term(): number {
    let v = primary();
    while (isOp(peek(), "*", "/", "%")) {
      hasOperator = true;
      const op = (tokens[pos++] as { value: string }).value;
      const r = primary();
      if (op === "*") v *= r;
      else if (op === "/") v /= r;
      else v %= r;
    }
    return v;
  }

  function expression(): number {
    let v = term();
    while (isOp(peek(), "+", "-")) {
      hasOperator = true;
      const op = (tokens[pos++] as { value: string }).value;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  try {
    const value = expression();
    if (pos !== tokens.length || !Number.isFinite(value)) return null;
    const decimals = Math.max(0, ...tokens.map((t) => (t.type === "num" ? t.decimals : 0)));
    return { value, decimals, hasOperator };
  } catch {
    return null;
  }
}

export interface CalculatorResult {
  /** the expression as typed (without a leading "=") */
  expr: string;
  /** the formatted result, e.g. "23" or "2,468.5" (site number format) */
  text: string;
}

/** Desk make_calculator: null when the input is not a calculation. */
export function calculate(input: string): CalculatorResult | null {
  const raw = input.trim();
  if (!/^[\d(=]/.test(raw)) return null;
  const expr = raw.startsWith("=") ? raw.slice(1).trim() : raw;
  const parsed = evaluateArithmetic(expr);
  if (!parsed || !parsed.hasOperator) return null;
  return { expr, text: formatNumber(parsed.value, null, parsed.decimals) };
}
