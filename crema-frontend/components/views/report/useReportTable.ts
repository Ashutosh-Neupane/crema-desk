"use client";

/** Query report grid state: search, sort, tree collapse, hidden columns, paging (Desk: DataTable in query_report.js). */
import { useMemo, useState } from "react";
import { NUMERIC, type ReportColumn, type ReportRow } from "@/lib/report/columns";
import { PAGE, parentIndices, type RunResult } from "./queryReportTypes";

export interface TableRow {
  row: ReportRow;
  i: number;
  parent: boolean;
}
export type SortState = { field: string; dir: 1 | -1 } | null;

/** hide descendants of collapsed rows */
function visibleTreeRows(list: TableRow[], collapsed: Set<number>) {
  const out: TableRow[] = [];
  let hideBelow: number | null = null;
  for (const item of list) {
    const ind = item.row.indent ?? 0;
    if (hideBelow !== null && ind > hideBelow) continue;
    hideBelow = collapsed.has(item.i) ? ind : null;
    out.push(item);
  }
  return out;
}

function sortRows(list: TableRow[], sort: NonNullable<SortState>, columns: ReportColumn[]) {
  const col = columns.find((c) => c.fieldname === sort.field);
  const num = !!col && NUMERIC.has(col.fieldtype);
  return [...list].sort((a, b) => {
    const x = a.row[sort.field];
    const y = b.row[sort.field];
    return (num ? (Number(x) || 0) - (Number(y) || 0) : String(x ?? "").localeCompare(String(y ?? ""))) * sort.dir;
  });
}

function filterRows(list: TableRow[], query: string, columns: ReportColumn[]) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(({ row }) => columns.some((c) => String(row[c.fieldname] ?? "").toLowerCase().includes(q)));
}

/** next sort on a header click: ascending → descending → off */
export const nextSort = (s: SortState, field: string): SortState => {
  if (s?.field !== field) return { field, dir: 1 };
  return s.dir === 1 ? { field, dir: -1 } : null;
};

export function useReportTable(result: RunResult | null, initialDepth: number | undefined) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [limit, setLimit] = useState(PAGE);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set());

  // reset per-result view state when a new result arrives
  const [prevResult, setPrevResult] = useState(result);
  if (prevResult !== result) {
    setPrevResult(result);
    setLimit(PAGE);
    setCollapsed(result && typeof initialDepth === "number" ? parentIndices(result.rows, initialDepth) : new Set());
  }

  const isTree = !!result?.rows.some((r) => typeof r.indent === "number");
  const columns = useMemo(() => (result?.columns ?? []).filter((c) => !c.hidden && !hiddenCols.has(c.fieldname)), [result, hiddenCols]);

  const rows = useMemo(() => {
    if (!result) return [] as TableRow[];
    const parents = isTree ? parentIndices(result.rows) : new Set<number>();
    let list = result.rows.map((row, i) => ({ row, i, parent: parents.has(i) }));
    if (isTree) list = visibleTreeRows(list, collapsed);
    list = filterRows(list, query, columns);
    return sort && !isTree ? sortRows(list, sort, columns) : list;
  }, [result, isTree, collapsed, query, sort, columns]);

  const total = useMemo(() => {
    if (!result?.totals) return null;
    const first = result.columns.find((c) => !c.hidden && !NUMERIC.has(c.fieldtype));
    return first ? { ...result.totals, [first.fieldname]: "Total" } : result.totals;
  }, [result]);

  const toggleIn = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>) => (v: T) =>
    set((s) => {
      const n = new Set(s);
      if (n.has(v)) n.delete(v);
      else n.add(v);
      return n;
    });

  return {
    query,
    setQuery,
    sort,
    toggleSort: (field: string) => setSort((s) => nextSort(s, field)),
    collapsed,
    toggleCollapsed: toggleIn(setCollapsed),
    expandAll: () => setCollapsed(new Set()),
    collapseAll: () => setCollapsed(result ? parentIndices(result.rows) : new Set()),
    limit,
    showMore: () => setLimit((l) => l + PAGE),
    hiddenCols,
    toggleColumn: toggleIn(setHiddenCols),
    isTree,
    columns,
    rows,
    total,
  };
}

export type ReportTableState = ReturnType<typeof useReportTable>;
