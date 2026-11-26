"use client";

/**
 * Report view columns, rows (frappe.desk.reportview.get), totals and inline edits (frappe.client.set_value)
 * (Desk: report_view.js get_args / setup_datatable / set_value).
 */
import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { fetchCount, type Filter } from "@/lib/list/api";
import { aggregateDocfield, groupQueryArgs, STD_GROUP_FIELDS, type GroupBy } from "@/lib/report/groupBy";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { EDITABLE, NUMERIC, STD, colKey, sqlCol, type Col, type ReportSettings, type Row, type ViewCol } from "./shared";

interface Metas {
  meta: DocTypeMeta;
  children: DocTypeMeta[];
}

/** docfield lookups across the DocType and its child tables (standard fields get Desk's labels) */
export function useDocfields(doctype: string, metas: Metas | undefined) {
  const meta = metas?.meta;
  const byDoctype = useMemo(() => {
    const m = new Map<string, Map<string, DocField>>();
    for (const x of [meta, ...(metas?.children ?? [])]) if (x) m.set(x.name, new Map((x.fields ?? []).map((f) => [f.fieldname, f])));
    return m;
  }, [meta, metas]);
  const metaOf = useCallback((dt: string): DocTypeMeta | undefined => (dt === doctype ? meta : metas?.children.find((c) => c.name === dt)), [doctype, meta, metas]);
  const fieldOf = useCallback((dt: string, fieldname: string) => byDoctype.get(dt)?.get(fieldname), [byDoctype]);
  const dfOf = useCallback(
    (c: Col): DocField => {
      const f = fieldOf(c[1], c[0]);
      if (f) return f;
      const std = STD[c[0]];
      return { fieldname: c[0], label: std?.label ?? c[0], fieldtype: std?.fieldtype ?? "Data", options: c[0] === "name" ? c[1] : std?.options } as DocField;
    },
    [fieldOf],
  );
  return { metaOf, fieldOf, dfOf };
}

type Docfields = ReturnType<typeof useDocfields>;

/** columns shown: group-by mode shows [group field, aggregate] */
function buildViewCols(doctype: string, fields: Col[], groupBy: GroupBy | null, d: Docfields): ViewCol[] {
  if (!groupBy) return fields.map((c) => ({ col: c, df: d.dfOf(c), k: colKey(c, doctype) }));
  const gb: Col = [groupBy.field, groupBy.doctype];
  // a standard field (Created By, Tags, Document Status…) has no docfield in the meta
  const std = groupBy.doctype === doctype && !d.fieldOf(doctype, groupBy.field) ? STD_GROUP_FIELDS.find((f) => f.fieldname === groupBy.field) : undefined;
  const aggDf = groupBy.aggField ? d.dfOf([groupBy.aggField, groupBy.aggDoctype ?? doctype]) : undefined;
  return [
    { col: gb, df: std ?? d.dfOf(gb), k: colKey(gb, doctype) },
    { col: ["_aggregate_column", doctype], df: aggregateDocfield(groupBy, aggDf), k: "_aggregate_column" },
  ];
}

/** reportview.get args: the chosen columns plus what editing needs (docstatus, child row names, currency fields) */
function buildQueryArgs(doctype: string, settings: ReportSettings, fields: Col[], filters: Filter[], groupBy: GroupBy | null, childDts: string[], viewCols: ViewCol[], d: Docfields) {
  if (groupBy) return { doctype, ...groupQueryArgs(groupBy, doctype), filters: JSON.stringify(filters), page_length: settings.page_length, view: "Report" };
  const sel = fields.map((c) => (c[1] === doctype ? sqlCol(c) : `${sqlCol(c)} as '${c[1]}:${c[0]}'`));
  sel.push(sqlCol(["docstatus", doctype]));
  for (const cdt of childDts) sel.push(`\`tab${cdt}\`.\`name\` as '${cdt}:name'`);
  for (const { col, df } of viewCols) {
    if (df.fieldtype !== "Currency" || typeof df.options !== "string" || !d.fieldOf(col[1], df.options)) continue;
    sel.push(col[1] === doctype ? sqlCol([df.options, doctype]) : `${sqlCol([df.options, col[1]])} as '${col[1]}:${df.options}'`);
  }
  return { doctype, fields: JSON.stringify([...new Set(sel)]), filters: JSON.stringify(filters), order_by: settings.order_by, page_length: settings.page_length, view: "Report", with_comment_count: 0 };
}

const uncompress = (msg: unknown): Row[] => {
  const m = msg as { keys?: string[]; values?: unknown[][] } | Row[] | undefined;
  if (Array.isArray(m)) return m;
  const keys = m?.keys ?? [];
  return (m?.values ?? []).map((v) => Object.fromEntries(keys.map((k, i) => [k, v[i]])) as Row);
};

interface DataArgs {
  doctype: string;
  meta: DocTypeMeta | undefined;
  settings: ReportSettings | null;
  groupBy: GroupBy | null;
  docfields: Docfields;
  canWrite: string[] | undefined;
}

export function useReportViewData({ doctype, meta, settings, groupBy, docfields, canWrite }: DataArgs) {
  const qc = useQueryClient();
  const fields = useMemo(() => settings?.fields ?? [], [settings]);
  const filters = useMemo(() => settings?.filters ?? [], [settings]);
  const childDts = useMemo(() => [...new Set(fields.filter((c) => c[1] !== doctype).map((c) => c[1]))], [fields, doctype]);
  const viewCols = useMemo(() => (meta ? buildViewCols(doctype, fields, groupBy, docfields) : []), [meta, doctype, fields, groupBy, docfields]);
  const queryArgs = useMemo(() => (settings && meta ? buildQueryArgs(doctype, settings, fields, filters, groupBy, childDts, viewCols, docfields) : null), [settings, meta, doctype, fields, filters, groupBy, childDts, viewCols, docfields]);

  const rowsQuery = useQuery<Row[]>({
    queryKey: ["report-view", queryArgs],
    enabled: !!queryArgs,
    placeholderData: keepPreviousData,
    queryFn: async () => uncompress((await deskCall("frappe.desk.reportview.get", queryArgs!)).env.message),
  });
  const countQuery = useQuery({ queryKey: ["report-view-count", doctype, filters], enabled: !!meta && !groupBy, queryFn: () => fetchCount(doctype, filters) });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["report-view"] });

  // local edits layered over fetched rows until the next refetch
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [prevData, setPrevData] = useState(rowsQuery.data);
  if (prevData !== rowsQuery.data) {
    setPrevData(rowsQuery.data);
    setEdits({});
  }
  const cellValue = (r: Row, i: number, k: string) => (`${i}|${k}` in edits ? edits[`${i}|${k}`] : r[k]);

  const totals = useMemo(() => {
    if (!settings?.add_totals_row || !rows.length) return null;
    const out: Record<string, number> = {};
    for (const { col, df, k } of viewCols) if (NUMERIC.has(df.fieldtype) && df.fieldtype !== "Percent" && !STD[col[0]]) out[k] = rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return out;
  }, [settings?.add_totals_row, rows, viewCols]);

  const canEdit = (r: Row, col: Col, df: DocField) => {
    if (groupBy || Number(r.docstatus ?? 0) !== 0 || col[0] === "name" || STD[col[0]]) return false;
    if (df.read_only || df.fetch_from || !EDITABLE.has(df.fieldtype)) return false;
    if (col[1] !== doctype && !r[`${col[1]}:name`]) return false;
    return canWrite ? canWrite.includes(doctype) : true;
  };

  const commit = async (r: Row, i: number, col: Col, value: unknown) => {
    const k = colKey(col, doctype);
    if (value === (cellValue(r, i, k) ?? "")) return;
    const editKey = `${i}|${k}`;
    setEdits((e) => ({ ...e, [editKey]: value }));
    try {
      const child = col[1] !== doctype;
      await deskCall("frappe.client.set_value", { doctype: col[1], name: child ? r[`${col[1]}:name`] : r.name, fieldname: col[0], value });
      toast.success(`Updated ${docfields.dfOf(col).label ?? col[0]}`);
    } catch (e) {
      setEdits((x) => {
        const n = { ...x };
        delete n[editKey];
        return n;
      });
      toast.error(e instanceof Error ? e.message : "Could not update", { duration: 8000 });
    }
  };

  return {
    fields,
    filters,
    childDts,
    viewCols,
    rows,
    total: countQuery.data ?? rows.length,
    loading: rowsQuery.isLoading,
    fetching: rowsQuery.isFetching,
    refresh,
    cellValue,
    totals,
    canEdit,
    commit,
  };
}

export type ReportViewData = ReturnType<typeof useReportViewData>;
