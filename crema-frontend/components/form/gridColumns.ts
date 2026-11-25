/**
 * Child table grid columns (Desk: frappe/public/js/frappe/form/grid.js, grid_row.js setup_columns): which child
 * fields show as columns and how wide, and the user's own GridView column settings.
 */
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

/** Desk grid.js GRID_MIN_COLUMN_WIDTH / GRID_MAX_COLUMN_WIDTH */
export const MIN_COL_PX = 60;
export const MAX_COL_PX = 600;
export const clampWidth = (w: number) => Math.max(MIN_COL_PX, Math.min(MAX_COL_PX, Math.round(w) || MIN_COL_PX));

export interface GridViewColumn {
  fieldname: string;
  width: number;
  sticky?: number;
}

const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "HTML", "Button", "Heading", "Image", "Table", "Table MultiSelect"]);
const NUMERIC = new Set(["Int", "Float", "Currency", "Percent"]);

/** Desk grid.js LEGACY_COLSIZE_TO_PX: the 1–12 `columns` units → px */
const UNITS_TO_PX: Record<number, number> = { 1: 60, 2: 100, 3: 140, 4: 200, 5: 250, 6: 300, 7: 350, 8: 400, 9: 450, 10: 500, 11: 550, 12: 600 };

function defaultWidth(df: DocField): number {
  if (df.columns) return Number(df.columns);
  if (df.fieldtype === "Check") return 1;
  if (NUMERIC.has(df.fieldtype)) return df.fieldtype === "Currency" ? 2 : 1;
  if (["Text", "Small Text", "Text Editor", "Long Text"].includes(df.fieldtype)) return 3;
  return 2;
}

/** fields that can be grid columns (Desk: not a layout field, not hidden) */
export const columnFields = (meta: DocTypeMeta, overrides: Record<string, Record<string, unknown>>, table: string) =>
  (meta.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype) && !(overrides[`${table}.${f.fieldname}`]?.hidden ?? f.hidden));

/**
 * Grid columns with their width in px. The user's own columns (GridView user setting, Desk setup_user_defined_columns)
 * win; otherwise in_list_view fields up to 10 units, Desk's default.
 */
export function gridColumns(
  meta: DocTypeMeta,
  overrides: Record<string, Record<string, unknown>>,
  table: string,
  userCols?: Array<{ fieldname?: string; width?: number | string; columns?: number | string }>,
): Array<DocField & { width: number }> {
  const visible = columnFields(meta, overrides, table);
  if (userCols?.length) {
    const mine = userCols
      .map((u) => {
        const f = visible.find((x) => x.fieldname === u.fieldname);
        // Desk migrates legacy `columns` (1–12) to px
        return f ? { ...f, width: clampWidth(Number(u.width) || UNITS_TO_PX[Number(u.columns)] || 140) } : null;
      })
      .filter((x): x is DocField & { width: number } => !!x);
    if (mine.length) return mine;
  }
  let cols = visible.filter((f) => f.in_list_view);
  if (!cols.length) cols = visible.filter((f) => f.reqd).concat(visible.filter((f) => !f.reqd)).slice(0, 4);
  const out: Array<DocField & { width: number }> = [];
  let total = 0;
  for (const f of cols) {
    const w = defaultWidth(f);
    if (total + w > 10) break;
    total += w;
    out.push({ ...f, width: UNITS_TO_PX[w] ?? 100 });
  }
  return out;
}

