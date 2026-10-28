"use client";

/**
 * Report view (Desk: frappe/public/js/frappe/views/reports/report_view.js) — a spreadsheet
 * over frappe.desk.reportview.get:
 *  - pick columns from the DocType and its child tables (child rows fan out like Desk)
 *  - inline edit of draft documents (frappe.client.set_value, child rows by `<cdt>:name`)
 *  - filters, sort per column, group by with count/sum/avg, totals row, page size
 *  - settings remembered per user (user_settings "Report"); Save / Save As → Report Builder report
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Columns3, Download, Filter as FilterIcon, Layers, ListFilter, MoreHorizontal, RefreshCw, Save, Sigma, X } from "lucide-react";
import { useFormMetas } from "@/lib/hooks/useFormMetas";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { deskCall } from "@/lib/frappe/form";
import { fetchCount, type Filter } from "@/lib/list/api";
import { formatCell } from "@/lib/list/format";
import { toCsv } from "@/lib/report/columns";
import { FilterEditor, NO_VALUE, OPERATORS, describeValue, fieldLabel, filtersFromParams } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import LinkInput from "@/components/list/LinkInput";
import DatePicker from "@/components/form/DatePicker";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

/** [fieldname, doctype] — Desk's report view field tuple */
type Col = [string, string];
type Row = Record<string, unknown> & { name: string };
interface GroupBySettings {
  group_by: string;
  aggregate_function: "count" | "sum" | "avg";
  aggregate_on?: string;
}
interface ReportSettings {
  fields?: Col[];
  filters?: Filter[];
  order_by?: string;
  add_totals_row?: 0 | 1;
  page_length?: number;
  group_by?: GroupBySettings | null;
}

const enc = encodeURIComponent;
const NUMERIC = new Set(["Currency", "Float", "Int", "Percent"]);
const EDITABLE = new Set(["Data", "Int", "Float", "Currency", "Percent", "Select", "Link", "Date", "Check", "Small Text", "Text", "Long Text", "Phone", "Duration"]);
const STD: Record<string, Partial<DocField>> = {
  name: { label: "ID", fieldtype: "Link" },
  owner: { label: "Created By", fieldtype: "Link", options: "User" },
  creation: { label: "Created On", fieldtype: "Datetime" },
  modified: { label: "Last Updated On", fieldtype: "Datetime" },
  modified_by: { label: "Last Updated By", fieldtype: "Link", options: "User" },
  docstatus: { label: "Document Status", fieldtype: "Int" },
  idx: { label: "Index", fieldtype: "Int" },
};
const key = (c: Col, doctype: string) => (c[1] === doctype ? c[0] : `${c[1]}:${c[0]}`);
const sqlCol = (c: Col) => `\`tab${c[1]}\`.\`${c[0]}\``;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export default function ReportView({ doctype, reportName }: { doctype: string; reportName?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: metas, error: metaError } = useFormMetas(doctype);
  const { data: ctx } = useDeskContext();
  const meta = metas?.meta;
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const currency = ctx?.sysdefaults?.currency as string | undefined;

  const metaOf = useCallback((dt: string): DocTypeMeta | undefined => (dt === doctype ? meta : metas?.children.find((c) => c.name === dt)), [doctype, meta, metas]);
  const dfOf = useCallback(
    (c: Col): DocField => {
      const f = metaOf(c[1])?.fields?.find((x) => x.fieldname === c[0]);
      if (f) return f;
      const std = STD[c[0]];
      return { fieldname: c[0], label: std?.label ?? c[0], fieldtype: std?.fieldtype ?? "Data", options: c[0] === "name" ? c[1] : std?.options } as DocField;
    },
    [metaOf],
  );

  // ── settings: saved report → user settings → list-view defaults ───────────
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [report, setReport] = useState<{ name: string; is_standard?: string } | null>(null);
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    (async () => {
      let s: ReportSettings = {};
      try {
        if (reportName) {
          const { env } = await deskCall("frappe.client.get", { doctype: "Report", name: reportName });
          const doc = env.message as { name: string; json?: string; is_standard?: string };
          s = JSON.parse(doc.json || "{}") as ReportSettings;
          if (!cancelled) setReport({ name: doc.name, is_standard: doc.is_standard });
        } else {
          const { env } = await deskCall("frappe.model.utils.user_settings.get", { doctype });
          const us = JSON.parse(String(env.message || "{}")) as { Report?: ReportSettings };
          s = us.Report ?? {};
        }
      } catch {
        /* fall back to defaults */
      }
      if (cancelled) return;
      const titleField = typeof meta.title_field === "string" ? meta.title_field : "";
      const defaults: Col[] = [["name", doctype], ...(meta.fields ?? []).filter((f) => (f.in_list_view || f.fieldname === titleField) && !NO_VALUE.has(f.fieldtype)).map((f) => [f.fieldname, doctype] as Col)];
      if (meta.is_submittable) defaults.push(["docstatus", doctype]);
      const urlFilters = filtersFromParams(doctype, new URLSearchParams(params.toString()));
      setSettings({
        fields: s.fields?.length ? s.fields.filter((c) => Array.isArray(c) && c.length >= 2) : defaults,
        filters: urlFilters.length ? urlFilters : (s.filters ?? []),
        order_by: s.order_by || `\`tab${doctype}\`.\`${meta.sort_field || "modified"}\` ${String(meta.sort_order || "desc").toLowerCase()}`,
        add_totals_row: s.add_totals_row ? 1 : 0,
        page_length: s.page_length || 20,
        group_by: s.group_by?.group_by && s.group_by.aggregate_function ? s.group_by : null,
      });
    })();
    return () => {
      cancelled = true;
    };
    // params read once on load; later filter edits stay local like Desk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, doctype, reportName]);

  const update = (patch: Partial<ReportSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

  // remember view settings per user (not for saved reports — those save explicitly)
  useEffect(() => {
    if (!settings || reportName) return;
    const t = setTimeout(() => {
      deskCall("frappe.model.utils.user_settings.save", { doctype, user_settings: JSON.stringify({ Report: settings }) }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [settings, doctype, reportName]);

  const fields = useMemo(() => settings?.fields ?? [], [settings]);
  const filters = useMemo(() => settings?.filters ?? [], [settings]);
  const groupBy = settings?.group_by ?? null;
  const childDts = useMemo(() => [...new Set(fields.filter((c) => c[1] !== doctype).map((c) => c[1]))], [fields, doctype]);

  // columns shown: group-by mode shows [group field, aggregate]
  const viewCols: Array<{ col: Col; df: DocField; k: string }> = useMemo(() => {
    if (!meta) return [];
    if (groupBy) {
      const gb: Col = [groupBy.group_by, doctype];
      const aggLabel = groupBy.aggregate_function === "count" ? "Count" : `${groupBy.aggregate_function === "sum" ? "Sum" : "Average"} of ${dfOf([groupBy.aggregate_on ?? "name", doctype]).label}`;
      return [
        { col: gb, df: dfOf(gb), k: groupBy.group_by },
        { col: ["_aggregate_column", doctype], df: { fieldname: "_aggregate_column", label: aggLabel, fieldtype: groupBy.aggregate_function === "count" ? "Int" : "Float" } as DocField, k: "_aggregate_column" },
      ];
    }
    return fields.map((c) => ({ col: c, df: dfOf(c), k: key(c, doctype) }));
  }, [meta, groupBy, fields, dfOf, doctype]);

  // ── data ──────────────────────────────────────────────────────────────────
  const queryArgs = useMemo(() => {
    if (!settings || !meta) return null;
    if (groupBy) {
      return {
        doctype,
        fields: JSON.stringify([sqlCol([groupBy.group_by, doctype])]),
        filters: JSON.stringify(filters),
        group_by: sqlCol([groupBy.group_by, doctype]),
        aggregate_on_field: groupBy.aggregate_on || "name",
        aggregate_on_doctype: doctype,
        aggregate_function: groupBy.aggregate_function,
        order_by: "_aggregate_column desc",
        page_length: settings.page_length,
        view: "Report",
      };
    }
    const sel = fields.map((c) => (c[1] === doctype ? sqlCol(c) : `${sqlCol(c)} as '${c[1]}:${c[0]}'`));
    // fetch what editing needs: docstatus, child row names, currency fields for Currency columns
    sel.push(sqlCol(["docstatus", doctype]));
    for (const cdt of childDts) sel.push(`\`tab${cdt}\`.\`name\` as '${cdt}:name'`);
    for (const { col, df } of viewCols) if (df.fieldtype === "Currency" && typeof df.options === "string" && metaOf(col[1])?.fields?.some((f) => f.fieldname === df.options)) sel.push(col[1] === doctype ? sqlCol([df.options, doctype]) : `${sqlCol([df.options, col[1]])} as '${col[1]}:${df.options}'`);
    return {
      doctype,
      fields: JSON.stringify([...new Set(sel)]),
      filters: JSON.stringify(filters),
      order_by: settings.order_by,
      page_length: settings.page_length,
      view: "Report",
      with_comment_count: 0,
    };
  }, [settings, meta, groupBy, fields, filters, childDts, viewCols, metaOf, doctype]);

  const rowsQuery = useQuery<Row[]>({
    queryKey: ["report-view", queryArgs],
    enabled: !!queryArgs,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { env } = await deskCall("frappe.desk.reportview.get", queryArgs!);
      const msg = env.message as { keys?: string[]; values?: unknown[][] } | Row[] | undefined;
      if (Array.isArray(msg)) return msg;
      const keys = msg?.keys ?? [];
      return (msg?.values ?? []).map((v) => Object.fromEntries(keys.map((k, i) => [k, v[i]])) as Row);
    },
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

  // ── editing ───────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<{ i: number; k: string } | null>(null);
  const canEdit = (r: Row, col: Col, df: DocField) => {
    if (groupBy || Number(r.docstatus ?? 0) !== 0 || col[0] === "name" || STD[col[0]]) return false;
    if (df.read_only || df.fetch_from || !EDITABLE.has(df.fieldtype)) return false;
    if (col[1] !== doctype && !r[`${col[1]}:name`]) return false;
    return ctx?.perms?.can_write ? ctx.perms.can_write.includes(doctype) : true;
  };
  const commit = async (r: Row, i: number, col: Col, value: unknown) => {
    setEditing(null);
    const k = key(col, doctype);
    if (value === (cellValue(r, i, k) ?? "")) return;
    setEdits((e) => ({ ...e, [`${i}|${k}`]: value }));
    try {
      const child = col[1] !== doctype;
      await deskCall("frappe.client.set_value", { doctype: col[1], name: child ? r[`${col[1]}:name`] : r.name, fieldname: col[0], value });
      toast.success(`Updated ${dfOf(col).label ?? col[0]}`);
    } catch (e) {
      setEdits((x) => {
        const n = { ...x };
        delete n[`${i}|${k}`];
        return n;
      });
      toast.error(e instanceof Error ? e.message : "Could not update", { duration: 8000 });
    }
  };

  // ── column ops ────────────────────────────────────────────────────────────
  const sortOn = (col: Col, dir: "asc" | "desc") => update({ order_by: `${sqlCol(col)} ${dir}` });
  const sortState = settings?.order_by?.match(/`tab(.+?)`\.`(.+?)` (asc|desc)/i);
  const removeCol = (col: Col) => update({ fields: fields.filter((c) => !(c[0] === col[0] && c[1] === col[1])) });
  const moveCol = (col: Col, d: -1 | 1) => {
    const i = fields.findIndex((c) => c[0] === col[0] && c[1] === col[1]);
    const j = i + d;
    if (i < 0 || j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    update({ fields: next });
  };
  const [picker, setPicker] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [saveAs, setSaveAs] = useState<string | null>(null);

  const saveReport = async (name: string) => {
    if (!settings) return;
    try {
      const { env } = await deskCall("frappe.desk.reportview.save_report", { name, doctype, report_settings: JSON.stringify({ ...settings, column_widths: {} }) });
      toast.success(`Report ${String(env.message)} saved`);
      setSaveAs(null);
      if (!reportName || reportName !== env.message) router.push(`/desk/doctype/${enc(doctype)}/view/report/${enc(String(env.message))}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save report", { duration: 8000 });
    }
  };

  const exportCsv = () => {
    const cols = viewCols.map(({ df, k }) => ({ fieldname: k, label: String(df.label ?? k), fieldtype: df.fieldtype }));
    const blob = new Blob([toCsv(rows, cols)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName ?? doctype}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (metaError) return <p className="p-6 text-sm text-red-600">{(metaError as Error).message}</p>;
  if (!meta || !settings) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;

  const total = countQuery.data ?? rows.length;
  const editableReport = !report || report.is_standard !== "Yes";

  return (
    <div className="space-y-3 p-4">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`/desk/doctype/${enc(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / Report"}
          </div>
          <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{reportName ?? `${doctype} Report`}</h1>
        </div>
        <nav aria-label="Views" className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
          <Link href={`/desk/doctype/${enc(doctype)}${meta.is_tree ? "?view=list" : ""}`} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            List
          </Link>
          <span aria-current="page" className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            Report
          </span>
        </nav>
        <button type="button" className={btn} onClick={refresh} aria-label="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${rowsQuery.isFetching ? "animate-spin" : ""}`} aria-hidden />
        </button>
        {reportName && editableReport ? (
          <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900" onClick={() => saveReport(reportName)}>
            <Save className="h-3.5 w-3.5" aria-hidden /> Save
          </button>
        ) : (
          <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900" onClick={() => setSaveAs("")}>
            <Save className="h-3.5 w-3.5" aria-hidden /> Save As
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={btn} aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setPicker(true)}>Pick Columns</DropdownMenuItem>
            <DropdownMenuItem onClick={() => update({ add_totals_row: settings.add_totals_row ? 0 : 1 })}>{settings.add_totals_row ? "Hide Totals" : "Show Totals"}</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv}>
              <Download className="mr-2 h-3.5 w-3.5" aria-hidden /> Export CSV
            </DropdownMenuItem>
            {reportName && <DropdownMenuItem onClick={() => setSaveAs("")}>Save As…</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/desk/doctype/${enc(doctype)}/new`)}>New {doctype}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger className={btn}>
            <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
            {filters.length > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{filters.length}</span>}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <FilterEditor meta={meta} onAdd={(f) => update({ filters: [...filters.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f] })} />
          </PopoverContent>
        </Popover>
        <Popover open={groupOpen} onOpenChange={setGroupOpen}>
          <PopoverTrigger className={btn}>
            <Layers className="h-3.5 w-3.5" aria-hidden /> {groupBy ? `Grouped by ${dfOf([groupBy.group_by, doctype]).label}` : "Group By"}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <GroupByEditor
              meta={meta}
              value={groupBy}
              onChange={(g) => {
                update({ group_by: g });
                setGroupOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <button type="button" className={btn} onClick={() => setPicker(true)}>
          <Columns3 className="h-3.5 w-3.5" aria-hidden /> Columns
        </button>
        <button type="button" className={btn} aria-pressed={!!settings.add_totals_row} onClick={() => update({ add_totals_row: settings.add_totals_row ? 0 : 1 })}>
          <Sigma className="h-3.5 w-3.5" aria-hidden /> Totals
        </button>
        <span className="ml-auto text-xs text-zinc-500">
          {groupBy || childDts.length ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}` : `${rows.length} of ${total}`}
        </span>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => (
            <span key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
              <span className="font-medium">{fieldLabel(metaOf(f[0]) ?? meta, f[1])}</span>
              <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
              <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
              <button type="button" onClick={() => update({ filters: filters.filter((_, j) => j !== i) })} aria-label={`Remove ${fieldLabel(meta, f[1])} filter`} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => update({ filters: [] })} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Clear all
          </button>
        </div>
      )}

      {/* grid */}
      <div className="overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="w-full border-collapse text-sm" aria-label={`${doctype} report`}>
          <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="w-10 border-b border-r border-zinc-200 px-2 py-2 text-right text-xs font-medium text-zinc-400 dark:border-zinc-800">#</th>
              {viewCols.map(({ col, df, k }) => {
                const sorted = sortState && sortState[1] === col[1] && sortState[2] === col[0] ? (sortState[3].toLowerCase() as "asc" | "desc") : null;
                return (
                  <th key={k} scope="col" className={`group whitespace-nowrap border-b border-r border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 ${NUMERIC.has(df.fieldtype) ? "text-right" : "text-left"}`} style={{ minWidth: 120 }} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
                    <span className="inline-flex items-center gap-1">
                      {col[1] !== doctype && <span className="text-zinc-400">{col[1]}:</span>}
                      {df.label ?? col[0]}
                      {sorted === "asc" && <ArrowUp className="h-3 w-3" aria-hidden />}
                      {sorted === "desc" && <ArrowDown className="h-3 w-3" aria-hidden />}
                      {!groupBy && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded p-0.5 opacity-0 hover:bg-zinc-200 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-700" aria-label={`${df.label ?? col[0]} column menu`}>
                            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => sortOn(col, "asc")}>Sort Ascending</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sortOn(col, "desc")}>Sort Descending</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => moveCol(col, -1)}>Move Left</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveCol(col, 1)}>Move Right</DropdownMenuItem>
                            {col[0] !== "name" && <DropdownMenuItem onClick={() => removeCol(col)}>Remove Column</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.name}|${childDts.map((c) => r[`${c}:name`]).join("|")}|${i}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="border-b border-r border-zinc-100 px-2 py-1 text-right text-xs tabular-nums text-zinc-400 dark:border-zinc-800">{i + 1}</td>
                {viewCols.map(({ col, df, k }) => {
                  const v = cellValue(r, i, k);
                  const isEditing = editing?.i === i && editing.k === k;
                  const editable = canEdit(r, col, df);
                  const cur = df.fieldtype === "Currency" && typeof df.options === "string" ? (r[col[1] === doctype ? df.options : `${col[1]}:${df.options}`] as string | undefined) : undefined;
                  const text = k === "docstatus" ? ["Draft", "Submitted", "Cancelled"][Number(v)] ?? "" : formatCell(v, { ...df, options: cur ?? (df.fieldtype === "Currency" ? "" : df.options) }, r, { currency: cur ?? currency, dateFormat });
                  return (
                    <td
                      key={k}
                      className={`max-w-xs border-b border-r border-zinc-100 px-2 py-1 dark:border-zinc-800 ${NUMERIC.has(df.fieldtype) ? "text-right tabular-nums" : ""} ${editable ? "cursor-text" : ""} ${isEditing ? "p-0 ring-2 ring-inset ring-blue-500" : ""}`}
                      onDoubleClick={() => editable && setEditing({ i, k })}
                      onKeyDown={(e) => editable && !isEditing && e.key === "Enter" && setEditing({ i, k })}
                      tabIndex={editable ? 0 : undefined}
                      aria-label={editable ? `${df.label}: ${text || "empty"} (press Enter to edit)` : undefined}
                    >
                      {isEditing ? (
                        <CellEditor df={df} value={v} onCommit={(nv) => commit(r, i, col, nv)} onCancel={() => setEditing(null)} />
                      ) : col[0] === "name" && col[1] === doctype && !groupBy ? (
                        <Link href={`/desk/doctype/${enc(doctype)}/${enc(r.name)}`} className="whitespace-nowrap font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                          {String(v)}
                        </Link>
                      ) : groupBy && k === groupBy.group_by ? (
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => update({ group_by: null, filters: [...filters, [doctype, groupBy.group_by, v == null ? "is" : "=", v ?? "not set"]] })}
                        >
                          {text || "Not set"}
                        </button>
                      ) : (
                        <span className="block truncate" title={text}>
                          {text}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!rows.length && !rowsQuery.isLoading && (
              <tr>
                <td colSpan={viewCols.length + 1} className="p-10 text-center text-sm text-zinc-500">
                  Nothing to show
                </td>
              </tr>
            )}
          </tbody>
          {totals && (
            <tfoot className="sticky bottom-0 bg-zinc-50 font-semibold dark:bg-zinc-900">
              <tr>
                <td className="border-t border-zinc-200 dark:border-zinc-800" />
                {viewCols.map(({ df, k }, ci) => (
                  <td key={k} className={`whitespace-nowrap border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800 ${NUMERIC.has(df.fieldtype) ? "text-right tabular-nums" : ""}`}>
                    {k in totals ? formatCell(totals[k], { ...df, options: "" }, {}, { currency, dateFormat }) : ci === 0 ? "Total" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center gap-1 text-sm">
        {[20, 100, 500].map((n) => (
          <button key={n} type="button" onClick={() => update({ page_length: n })} aria-pressed={settings.page_length === n} className={`rounded-md border px-2.5 py-1 ${settings.page_length === n ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}>
            {n}
          </button>
        ))}
        {!groupBy && rows.length < total && (
          <button type="button" className="ml-2 text-zinc-600 hover:underline dark:text-zinc-300" onClick={() => update({ page_length: (settings.page_length ?? 20) + 20 })}>
            Load more
          </button>
        )}
      </div>

      <ColumnPicker open={picker} onClose={() => setPicker(false)} meta={meta} childMetas={metas?.children ?? []} value={fields} onChange={(f) => update({ fields: f })} />

      <Dialog open={saveAs !== null} onOpenChange={(o) => !o && setSaveAs(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save As</DialogTitle>
            <DialogDescription>Saves these columns, filters, sort and grouping as a Report Builder report.</DialogDescription>
          </DialogHeader>
          <label htmlFor="report-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Report Name
          </label>
          <input
            id="report-name"
            autoFocus
            value={saveAs ?? ""}
            onChange={(e) => setSaveAs(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveAs?.trim() && saveReport(saveAs.trim())}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <DialogFooter>
            <button type="button" className={btn} onClick={() => setSaveAs(null)}>
              Cancel
            </button>
            <button type="button" disabled={!saveAs?.trim()} onClick={() => saveAs && saveReport(saveAs.trim())} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CellEditor({ df, value, onCommit, onCancel }: { df: DocField; value: unknown; onCommit: (v: unknown) => void; onCancel: () => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const cls = "h-8 w-full bg-white px-2 text-sm outline-none dark:bg-zinc-900";
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter") onCommit(NUMERIC.has(df.fieldtype) ? Number(v) || 0 : v);
  };
  switch (df.fieldtype) {
    case "Check":
      return (
        <label className="flex h-8 items-center justify-center">
          <input type="checkbox" autoFocus aria-label={String(df.label)} defaultChecked={!!Number(value)} onChange={(e) => onCommit(e.target.checked ? 1 : 0)} onBlur={onCancel} onKeyDown={keys} />
        </label>
      );
    case "Select":
      return (
        <select autoFocus aria-label={String(df.label)} value={v} className={cls} onChange={(e) => onCommit(e.target.value)} onBlur={onCancel} onKeyDown={keys}>
          {String(df.options ?? "").split("\n").map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "Link":
      return <LinkInput doctype={String(df.options)} value={v} autoFocus onChange={(nv) => onCommit(nv)} className="[&_input]:h-8 [&_input]:w-full [&_input]:rounded-none [&_input]:border-0" />;
    case "Date":
      return <DatePicker compact value={v} ariaLabel={String(df.label)} onChange={(nv) => onCommit(nv ?? "")} />;
    default:
      return (
        <input
          autoFocus
          aria-label={String(df.label)}
          type={NUMERIC.has(df.fieldtype) ? "number" : "text"}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={keys}
          onBlur={() => onCommit(NUMERIC.has(df.fieldtype) ? Number(v) || 0 : v)}
          className={`${cls} ${NUMERIC.has(df.fieldtype) ? "text-right" : ""}`}
        />
      );
  }
}

function GroupByEditor({ meta, value, onChange }: { meta: DocTypeMeta; value: GroupBySettings | null; onChange: (g: GroupBySettings | null) => void }) {
  const groupable = (meta.fields ?? []).filter((f) => ["Select", "Link", "Data", "Date", "Check"].includes(f.fieldtype) && !f.hidden);
  const numeric = (meta.fields ?? []).filter((f) => NUMERIC.has(f.fieldtype) && !f.hidden);
  const [g, setG] = useState<GroupBySettings>(value ?? { group_by: groupable.find((f) => f.fieldname === "status")?.fieldname ?? groupable[0]?.fieldname ?? "owner", aggregate_function: "count" });
  const sel = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Group By
        <select aria-label="Group by field" className={`${sel} mt-1`} value={g.group_by} onChange={(e) => setG({ ...g, group_by: e.target.value })}>
          <option value="owner">Created By</option>
          {groupable.map((f) => (
            <option key={f.fieldname} value={f.fieldname}>
              {f.label ?? f.fieldname}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Aggregate
        <select aria-label="Aggregate function" className={`${sel} mt-1`} value={g.aggregate_function} onChange={(e) => setG({ ...g, aggregate_function: e.target.value as GroupBySettings["aggregate_function"], aggregate_on: e.target.value === "count" ? undefined : (g.aggregate_on ?? numeric[0]?.fieldname) })}>
          <option value="count">Count</option>
          {numeric.length > 0 && <option value="sum">Sum</option>}
          {numeric.length > 0 && <option value="avg">Average</option>}
        </select>
      </label>
      {g.aggregate_function !== "count" && (
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Of
          <select aria-label="Aggregate on" className={`${sel} mt-1`} value={g.aggregate_on} onChange={(e) => setG({ ...g, aggregate_on: e.target.value })}>
            {numeric.map((f) => (
              <option key={f.fieldname} value={f.fieldname}>
                {f.label ?? f.fieldname}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onChange(g)} className="flex-1 rounded-md bg-zinc-900 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
          Apply
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function ColumnPicker({ open, onClose, meta, childMetas, value, onChange }: { open: boolean; onClose: () => void; meta: DocTypeMeta; childMetas: DocTypeMeta[]; value: Col[]; onChange: (f: Col[]) => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const std: DocField[] = Object.entries(STD).map(([fieldname, d]) => ({ fieldname, ...d }) as DocField);
    const mk = (m: DocTypeMeta, extra: DocField[] = []) => ({ doctype: m.name, fields: [...extra, ...(m.fields ?? []).filter((f) => !NO_VALUE.has(f.fieldtype))] });
    return [mk(meta, std), ...childMetas.map((c) => mk(c))];
  }, [meta, childMetas]);
  const has = (c: Col) => value.some((x) => x[0] === c[0] && x[1] === c[1]);
  const toggle = (c: Col) => onChange(has(c) ? value.filter((x) => !(x[0] === c[0] && x[1] === c[1])) : [...value, c]);
  const needle = q.trim().toLowerCase();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick Columns</DialogTitle>
          <DialogDescription>Child table columns show one row per child record, like Desk.</DialogDescription>
        </DialogHeader>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fields" aria-label="Search fields" className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        <div className="max-h-[55vh] space-y-4 overflow-auto pr-1">
          {groups.map((g) => {
            const fs = g.fields.filter((f) => !needle || String(f.label ?? f.fieldname).toLowerCase().includes(needle) || f.fieldname.includes(needle));
            if (!fs.length) return null;
            return (
              <section key={g.doctype}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">{g.doctype}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {fs.map((f) => (
                    <label key={f.fieldname} className="flex cursor-pointer items-center gap-2 truncate rounded px-1 py-0.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <input type="checkbox" checked={has([f.fieldname, g.doctype])} disabled={f.fieldname === "name" && g.doctype === meta.name} onChange={() => toggle([f.fieldname, g.doctype])} />
                      <span className="truncate">{f.label || f.fieldname}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
