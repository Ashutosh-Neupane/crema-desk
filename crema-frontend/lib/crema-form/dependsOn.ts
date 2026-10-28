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
  /** parent doc for child-row expressions (`parent.status`) */
  parent?: Record<string, unknown>,
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
    if (Array.isArray(v)) return v.length > 0;
    return !!v && v !== "0";
  }

  try {
    // Desk evaluates depends_on JS from the DocType definition the same way (only
    // `doc` / `parent` / `locals` in scope); the expressions are site config, not user input.
    // `let out = …; return out` like Desk's frappe.utils.eval, so a trailing `;` (`eval:doc.x === "Report";`) is valid
    // eslint-disable-next-line no-new-func
    const fn = new Function("doc", "parent", "locals", `"use strict"; let out = ${expr}; return out;`); // react-doctor-disable-line no-eval
    return !!fn(values, parent ?? {}, values);
  } catch {
    return true;
  }
}
