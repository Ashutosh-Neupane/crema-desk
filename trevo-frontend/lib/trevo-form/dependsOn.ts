/**
 * dependsOn — evaluates Frappe's conditional field properties:
 * `depends_on`, `mandatory_depends_on`, `read_only_depends_on`.
 *
 * Frappe supports two syntaxes:
 *  1. A plain fieldname — truthy when that field has a value:
 *       depends_on: "is_recurring"
 *  2. A JS expression, optionally prefixed with `eval:`, evaluated with the
 *     current document available as `doc` (and `locals` for compatibility):
 *       depends_on: "eval:doc.status == 'Open'"
 *
 * Errors during evaluation fail open (field stays visible) to match a
 * least-surprising behavior when a script expression is malformed.
 */

/** True when the condition expression is satisfied by the current values. */
export function evalDependsOn(
  expression: string | null | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!expression) return true;

  let expr = String(expression).trim();
  if (!expr) return true;

  if (expr.startsWith("eval:")) {
    expr = expr.slice(5).trim();
  }

  // Plain fieldname → show when that field has a value
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
    const v = values[expr];
    return !!v && v !== "0";
  }

  try {
    // Only `doc` / `locals` are in scope — no globals leak in from here
    /* eslint-disable-next-line no-new-func */
    const fn = new Function("doc", "locals", `"use strict"; return (${expr});`);
    return !!fn(values, values);
  } catch {
    return true;
  }
}
