/**
 * Options for Desk's multi-value controls (multiselect.js get_parsed_options, multiselect_list.js process_options /
 * set_options, multicheck.js parse_df_options): `df.options` as lines, a JSON list (or { options: [...] }), or an
 * array of strings / { label, value, description, checked }; `df.get_data(txt)` (sync or a promise) wins when set.
 */
import { useEffect, useState } from "react";
import type { DocField } from "@/lib/frappe/types";

/** a multi-value field's value as a list: an array, or MultiSelect's comma-separated "a, b" */
export function multiValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export interface MultiOption {
  label: string;
  value: string;
  description?: string;
  checked?: boolean;
  disabled?: boolean;
}

export function normOptions(raw: unknown): MultiOption[] {
  let o: unknown = raw;
  if (typeof o === "string") {
    const t = o.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const j = JSON.parse(t);
        o = Array.isArray(j) ? j : Array.isArray(j?.options) ? j.options : [];
      } catch {
        o = t.split("\n");
      }
    } else o = t ? t.split("\n") : [];
  }
  if (!Array.isArray(o)) return [];
  return o
    .filter((x) => x != null && x !== "")
    .map((x) => {
      if (typeof x !== "object") return { label: String(x).trim(), value: String(x).trim() };
      const r = x as Record<string, unknown>;
      const value = String(r.value ?? r.label ?? "");
      return { label: String(r.label ?? "") || value, value, description: r.description ? String(r.description) : undefined, checked: !!r.checked, disabled: !!r.disabled };
    });
}

type GetData = (txt?: string) => unknown;

/** options for the field, re-asking get_data(txt) as the search text changes */
export function useMultiOptions(field: DocField, txt = ""): MultiOption[] {
  const getData = (field as { get_data?: GetData }).get_data;
  const [state, setState] = useState<{ key: string; opts: MultiOption[] } | null>(null);
  useEffect(() => {
    if (typeof getData !== "function") return;
    let dead = false;
    const t = setTimeout(() => {
      Promise.resolve()
        .then(() => getData(txt))
        .then((r) => !dead && setState({ key: txt, opts: normOptions(r ?? []) }))
        .catch(() => !dead && setState({ key: txt, opts: [] }));
    }, 120);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [getData, txt]);
  if (typeof getData === "function") return state?.opts ?? [];
  return normOptions(field.options);
}
