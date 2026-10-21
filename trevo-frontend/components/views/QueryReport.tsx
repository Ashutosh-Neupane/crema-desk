"use client";

/**
 * Query / Script report page (Desk: frappe/public/js/frappe/views/reports/query_report.js).
 * The report's own JS (frappe.query_reports[name] via query_report.get_script) supplies
 * filters, formatter, onload, get_chart_data and tree settings; data comes from
 * frappe.desk.query_report.run. Prepared reports are generated in the background
 * and polled until ready.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronDown, ChevronRight, Download, FileText, Loader2, RefreshCw, Save, Search, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { createRuntime, lenient } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { evalDependsOn } from "@/lib/trevo-form/dependsOn";
import LinkInput from "@/components/list/LinkInput";
import DatePicker from "@/components/form/DatePicker";
import DeskChart from "@/components/desk/DeskChart";
import {
  defaultFormatter,
  normalizeColumns,
  normalizeRows,
  NUMERIC,
  sanitizeHtml,
  toChartResult,
  toCsv,
  type ReportColumn,
  type ReportRow,
} from "@/lib/report/columns";
import { buildReportHtml, downloadReportPdf } from "@/lib/report/printGrid";
import { formatValue } from "@/lib/utils/formatNumber";
import { PdfSettingsDialog, SaveReportDialog, type PdfSettings } from "@/components/views/ReportDialogs";

interface ReportFilter {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: unknown;
  default?: unknown;
  reqd?: unknown;
  hidden?: unknown;
  depends_on?: string;
  on_change?: (report: unknown) => void;
  get_query?: () => unknown;
  get_data?: (txt: string) => unknown;
}

type Settings = Record<string, unknown> & {
  filters?: ReportFilter[];
  formatter?: (value: unknown, row: unknown, column: unknown, data: unknown, default_formatter: unknown) => string;
  onload?: (report: unknown) => void;
  get_chart_data?: (columns: unknown, result: unknown) => unknown;
  tree?: boolean;
  initial_depth?: number;
  __report?: unknown;
};

interface RunResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  chart: ReturnType<typeof toChartResult>;
  summary: Array<{ label: string; value: unknown; datatype?: string; indicator?: string; currency?: string }>;
  message?: string;
  totals: ReportRow | null;
}

const enc = encodeURIComponent;
const PAGE = 500;
const SKIP = new Set(["Section Break", "Column Break", "Break", "Tab Break", "HTML", "Button"]);
const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && (!v.length || v.every((x) => !x)));

const SUMMARY_TONE: Record<string, string> = {
  green: "text-emerald-700 dark:text-emerald-400",
  red: "text-red-700 dark:text-red-400",
  blue: "text-blue-700 dark:text-blue-400",
  orange: "text-amber-700 dark:text-amber-400",
};

export default function QueryReport({ name }: { name: string }) {
  const router = useRouter();
  const { data: ctx } = useDeskContext();
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const currency = (ctx?.sysdefaults?.currency as string | undefined) ?? undefined;

  // ── filter values (ref mirror so report JS reads them synchronously) ─────
  const [values, setValues] = useState<Record<string, unknown>>({});
  const valuesRef = useRef(values);
  const [runToken, setRunToken] = useState(0);
  const [innerButtons, setInnerButtons] = useState<Array<{ label: string; group?: string; action: () => void }>>([]);
  const resultRef = useRef<RunResult | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [refDoctype, setRefDoctype] = useState<string | undefined>();
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reportDoc, setReportDoc] = useState<{ report_type?: string; reference_report?: string; is_standard?: string }>({});
  // Desk refresh(have_filters_changed): saved Custom Report filters apply only while the user hasn't edited filters
  const changedRef = useRef(false);

  const setFilterValues = useCallback((patch: Record<string, unknown>) => {
    valuesRef.current = { ...valuesRef.current, ...patch };
    setValues(valuesRef.current);
  }, []);

  // ── report meta + script → frappe.query_reports[name], defaults, onload ──
  useEffect(() => {
    if (!ctx) return;
    let cancelled = false;
    Promise.all([
      deskCall("frappe.desk.query_report.get_script", { report_name: name }),
      deskCall("frappe.client.get_value", { doctype: "Report", filters: { name }, fieldname: ["report_type", "ref_doctype", "reference_report", "is_standard"] }).catch(() => null),
    ])
      .then(([s, meta]) => {
        if (cancelled) return;
        const m = (s.env.message ?? {}) as { script?: string; filters?: ReportFilter[] };
        const info = (meta?.env.message ?? {}) as { report_type?: string; ref_doctype?: string; reference_report?: string; is_standard?: string };
        if (info.report_type === "Report Builder" && info.ref_doctype) {
          router.replace(`/desk/doctype/${enc(info.ref_doctype)}/view/report/${enc(name)}`);
          return;
        }
        // Desk get_local_report_settings: a Custom Report runs the script of its reference report
        const scriptName = info.report_type === "Custom Report" && info.reference_report ? info.reference_report : name;
        const qs = buildSettings(name, scriptName, m, ctx, { valuesRef, resultRef, setFilterValues, setRunToken, setInnerButtons });
        const init: Record<string, unknown> = {};
        for (const f of qs.filters ?? []) {
          if (f.default != null && f.default !== "" && typeof f.default !== "function") init[f.fieldname] = f.default;
          else if (f.fieldtype === "Check") init[f.fieldname] = 0;
        }
        valuesRef.current = init;
        setValues(init);
        setInnerButtons([]);
        setRefDoctype(info.ref_doctype);
        setReportDoc(info);
        changedRef.current = false;
        setSettings(qs);
        try {
          qs.onload?.(qs.__report);
        } catch (e) {
          console.warn("[query-report] onload failed", e);
        }
        setRunToken((t) => t + 1);
      })
      .catch((e) => !cancelled && setLoadErr(e instanceof Error ? e.message : "Failed to load report"));
    return () => {
      cancelled = true;
    };
  }, [name, router, ctx, setFilterValues]);

  const filters = useMemo(() => settings?.filters ?? [], [settings]);
  const report = settings?.__report;

  const visibleFilters = filters.filter((f) => !f.hidden && !SKIP.has(f.fieldtype) && (!f.depends_on || evalDependsOn(f.depends_on, values)));
  const missing = filters.filter((f) => f.reqd && !f.hidden && isEmpty(values[f.fieldname]) && (!f.depends_on || evalDependsOn(f.depends_on, values)));

  // ── run ───────────────────────────────────────────────────────────────────
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<{ status?: string; name?: string } | null>(null);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    if (!settings) return;
    if (poll.current) clearTimeout(poll.current);
    setRunning(true);
    setRunErr(null);
    try {
      const { env } = await deskCall("frappe.desk.query_report.run", {
        report_name: name,
        filters: JSON.stringify(cleanFilters(valuesRef.current)),
        ignore_prepared_report: 0,
        are_default_filters: !changedRef.current,
      });
      const m = (env.message ?? {}) as Record<string, unknown>;
      // Custom Report: the server swaps in the saved filters on an unmodified run; show them (Desk set_filters)
      const saved = m.custom_filters as Record<string, unknown> | undefined;
      if (saved && typeof saved === "object" && !changedRef.current) {
        changedRef.current = true;
        valuesRef.current = { ...valuesRef.current, ...saved };
        setValues(valuesRef.current);
      }
      if (m.prepared_report) {
        const doc = m.doc as { status?: string; name?: string } | null;
        setPrepared(doc ?? {});
        if (doc && ["Queued", "Started"].includes(String(doc.status))) poll.current = setTimeout(() => setRunToken((t) => t + 1), 3000);
        if (!doc || doc.status !== "Completed") {
          setResult(null);
          return;
        }
      } else setPrepared(null);
      const columns = normalizeColumns((m.columns as unknown[]) ?? []);
      const addTotal = !!m.add_total_row && !m.skip_total_row;
      const all = normalizeRows((m.result as unknown[]) ?? [], columns);
      // v16 appends the total row server-side (query_report.add_total_row) → footer
      const rows = addTotal && all.length > 1 ? all.slice(0, -1) : all;
      const totals = addTotal && all.length > 1 ? all[all.length - 1] : null;
      let chart = m.chart;
      if (settings.get_chart_data && rows.length) {
        try {
          chart = settings.get_chart_data(columns, rows) ?? chart;
        } catch (e) {
          console.warn("[query-report] get_chart_data failed", e);
        }
      }
      const r: RunResult = {
        columns,
        rows,
        chart: toChartResult(chart, name),
        summary: ((m.report_summary as RunResult["summary"]) ?? []).filter(Boolean),
        message: typeof m.message === "string" ? m.message : undefined,
        totals,
      };
      resultRef.current = r;
      setResult(r);
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "Report failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [settings, name]);

  // Desk refreshes on every filter change; debounce bursts from on_change handlers
  useEffect(() => {
    if (!settings || !runToken || missing.length) return;
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- values drive runs; `missing` derives from them
  }, [runToken, values, settings, run]);

  useEffect(() => () => {
    if (poll.current) clearTimeout(poll.current);
  }, []);

  const changeFilter = (f: ReportFilter, v: unknown) => {
    changedRef.current = true;
    setFilterValues({ [f.fieldname]: v });
    if (f.on_change) {
      try {
        f.on_change(report);
      } catch (e) {
        console.warn("[query-report] on_change failed", e);
      }
    }
  };

  const generatePrepared = async () => {
    try {
      await deskCall("frappe.core.doctype.prepared_report.prepared_report.make_prepared_report", {
        report_name: name,
        filters: JSON.stringify(cleanFilters(valuesRef.current)),
      });
      toast.success("Report generation queued");
      setPrepared({ status: "Queued" });
      setRunToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not queue report");
    }
  };

  // ── table state ───────────────────────────────────────────────────────────
  const [showChart, setShowChart] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: 1 | -1 } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colMenu, setColMenu] = useState(false);

  // reset per-result view state when a new result arrives
  const [prevResult, setPrevResult] = useState(result);
  if (prevResult !== result) {
    setPrevResult(result);
    setLimit(PAGE);
    const depth = settings?.initial_depth;
    if (result && typeof depth === "number") {
      const c = new Set<number>();
      result.rows.forEach((r, i) => {
        if ((r.indent ?? 0) >= depth && (result.rows[i + 1]?.indent ?? 0) > (r.indent ?? 0)) c.add(i);
      });
      setCollapsed(c);
    } else setCollapsed(new Set());
  }

  const shown = missing.length ? null : result;
  const isTree = !!result?.rows.some((r) => typeof r.indent === "number");
  const columns = useMemo(() => (result?.columns ?? []).filter((c) => !c.hidden && !hiddenCols.has(c.fieldname)), [result, hiddenCols]);

  const rows = useMemo(() => {
    if (!result) return [] as Array<{ row: ReportRow; i: number; parent: boolean }>;
    let list = result.rows.map((row, i) => ({ row, i, parent: isTree && (result.rows[i + 1]?.indent ?? 0) > (row.indent ?? 0) }));
    if (isTree) {
      // hide descendants of collapsed rows
      const out: typeof list = [];
      let hideBelow: number | null = null;
      for (const item of list) {
        const ind = item.row.indent ?? 0;
        if (hideBelow !== null && ind > hideBelow) continue;
        hideBelow = collapsed.has(item.i) ? ind : null;
        out.push(item);
      }
      list = out;
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter(({ row }) => columns.some((c) => String(row[c.fieldname] ?? "").toLowerCase().includes(q)));
    if (sort && !isTree) {
      const col = columns.find((c) => c.fieldname === sort.field);
      const num = col && NUMERIC.has(col.fieldtype);
      list = [...list].sort((a, b) => {
        const x = a.row[sort.field];
        const y = b.row[sort.field];
        return (num ? (Number(x) || 0) - (Number(y) || 0) : String(x ?? "").localeCompare(String(y ?? ""))) * sort.dir;
      });
    }
    return list;
  }, [result, isTree, collapsed, query, sort, columns]);

  const total = useMemo(() => {
    if (!result?.totals) return null;
    const first = result.columns.find((c) => !c.hidden && !NUMERIC.has(c.fieldtype));
    return first ? { ...result.totals, [first.fieldname]: "Total" } : result.totals;
  }, [result]);

  const render = (value: unknown, column: ReportColumn, row: ReportRow, plain = false) => {
    const fmtCtx = { currency, dateFormat };
    const base = (v: unknown, _r?: unknown, c?: ReportColumn, d?: ReportRow) => defaultFormatter(v, c ?? column, d ?? row, fmtCtx);
    if (plain) return sanitizeHtml(String(value ?? ""));
    let html: string;
    try {
      const out = settings?.formatter ? settings.formatter(value, [], { ...column, docfield: column }, row, base) : undefined;
      // a formatter from a bundle we don't ship (erpnext.financial_statements) is a no-op → default
      html = out == null ? base(value) : String(out);
    } catch {
      html = base(value);
    }
    return sanitizeHtml(html);
  };

  // in-app navigation for links produced by formatters
  const onTableClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!a || !href || e.metaKey || e.ctrlKey) return;
    const desk = href.match(/^\/desk\/|^\/app\/(.+)$/);
    if (!desk) return;
    e.preventDefault();
    if (href.startsWith("/desk/")) router.push(href);
    else {
      // Desk-style /app/<doctype-slug>/<name> links from formatters
      const [slug, ...rest] = (desk[1] ?? "").split("/");
      const dt = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      router.push(`/desk/doctype/${enc(dt)}${rest.length ? `/${rest.join("/")}` : ""}`);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const blob = new Blob([toCsv(result.rows, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save As / PDF (Desk menu: Save, PDF) ───────────────────────────────────
  const isReportManager = !!ctx && (ctx.user === "Administrator" || ctx.roles.includes("System Manager") || ctx.roles.includes("Report Manager"));
  const [saveOpen, setSaveOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveReport = async (reportName: string) => {
    setBusy(true);
    try {
      // Desk posts form-encoded JSON strings (the server embeds them into Report.json verbatim)
      const { env } = await deskCall("frappe.desk.query_report.save_report", {
        reference_report: name,
        report_name: reportName,
        columns: JSON.stringify(columns),
        filters: JSON.stringify(cleanFilters(valuesRef.current)),
      });
      setSaveOpen(false);
      toast.success(`${String(env.message)} saved successfully`);
      router.push(`/desk/query-report/${enc(String(env.message))}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save report");
    } finally {
      setBusy(false);
    }
  };

  const pdfReport = async (s: PdfSettings) => {
    if (!result) return;
    setBusy(true);
    try {
      const fmt = { currency, dateFormat };
      const printCols = s.columns ? columns.filter((c) => s.columns!.includes(c.fieldname)) : columns;
      const applied = cleanFilters(valuesRef.current);
      const html = buildReportHtml({
        title: name,
        columns: printCols,
        rows: rows.map((r) => r.row),
        totals: total,
        filters: filters.filter((f) => f.fieldname in applied && !SKIP.has(f.fieldtype)).map((f) => ({ label: String(f.label ?? f.fieldname), value: applied[f.fieldname], fieldtype: f.fieldtype })),
        includeFilters: s.includeFilters,
        landscape: s.orientation === "Landscape",
        fmt,
      });
      // Desk names the file after the report and its filter values (capped at 200 chars)
      const parts: string[] = [];
      let len = 0;
      for (const v of Object.values(applied)) {
        len += String(v).length;
        if (len > 200) break;
        parts.push(String(v));
      }
      await downloadReportPdf(html, s.orientation, `${name}${parts.length ? `_${parts.join("_")}` : ""}.pdf`);
      setPdfOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? `PDF failed: ${e.message}` : "PDF failed", { duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  if (loadErr) return <div className="p-6 text-sm text-red-600">{loadErr}</div>;

  return (
    <div className="flex min-h-full flex-col">
      {/* header */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href="/desk/reports" className="hover:underline">
              Reports
            </Link>
            {refDoctype && (
              <>
                {" / "}
                <Link href={`/desk/doctype/${enc(refDoctype)}`} className="hover:underline">
                  {refDoctype}
                </Link>
              </>
            )}
          </div>
          <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{name}</h1>
        </div>
        {innerButtons.map((b) => (
          <button key={b.label} type="button" onClick={() => b.action()} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
            {b.label}
          </button>
        ))}
        {shown?.chart && (
          <button type="button" onClick={() => setShowChart((s) => !s)} aria-pressed={showChart} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
            <BarChart3 className="h-4 w-4" aria-hidden /> {showChart ? "Hide chart" : "Show chart"}
          </button>
        )}
        <button type="button" onClick={exportCsv} disabled={!shown?.rows.length} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <Download className="h-4 w-4" aria-hidden /> Export
        </button>
        <button type="button" onClick={() => setPdfOpen(true)} disabled={!shown?.rows.length} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
          <FileText className="h-4 w-4" aria-hidden /> PDF
        </button>
        {isReportManager && (
          <button type="button" onClick={() => setSaveOpen(true)} disabled={!shown} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800">
            <Save className="h-4 w-4" aria-hidden /> Save As
          </button>
        )}
        {prepared ? (
          <button type="button" onClick={generatePrepared} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
            {prepared.name ? "Rebuild" : "Generate New Report"}
          </button>
        ) : (
          <button type="button" onClick={() => setRunToken((t) => t + 1)} className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1.5 bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white" disabled={running}>
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} aria-hidden /> Refresh
          </button>
        )}
      </div>

      {saveOpen && <SaveReportDialog open onClose={() => setSaveOpen(false)} defaultName={reportDoc.is_standard === "No" ? name : ""} busy={busy} onSave={(n) => void saveReport(n)} />}
      {pdfOpen && <PdfSettingsDialog open onClose={() => setPdfOpen(false)} columns={columns} busy={busy} onSubmit={(s) => void pdfReport(s)} />}

      {/* filters */}
      {visibleFilters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          {visibleFilters.map((f) => (
            <FilterControl key={f.fieldname} f={f} value={values[f.fieldname]} values={values} onChange={(v) => changeFilter(f, v)} />
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 p-4">
        {!settings && !loadErr && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading report…
          </div>
        )}
        {settings && missing.length > 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Set {missing.map((f) => f.label ?? f.fieldname).join(", ")} to run this report.
          </div>
        )}
        {runErr && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{runErr}</div>}
        {prepared && prepared.status !== "Completed" && (
          <div className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {prepared.status === "Queued" || prepared.status === "Started" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> This is a prepared report — generating in the background ({prepared.status})…
              </span>
            ) : prepared.status === "Error" || prepared.status === "Failed" ? (
              "Report generation failed. Rebuild to try again."
            ) : (
              "This report runs in the background. Click Generate New Report to build it for the current filters."
            )}
          </div>
        )}
        {shown?.message && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(shown.message) }} />}

        {shown && shown.summary.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {shown.summary.map((s) => (
              <div key={s.label} className="min-w-40 flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs text-zinc-500">{String(s.label).replace(/<[^>]+>/g, "")}</div>
                <div className={`mt-1 text-lg font-semibold tabular-nums ${SUMMARY_TONE[String(s.indicator ?? "").toLowerCase()] ?? "text-zinc-900 dark:text-zinc-100"}`}>
                  {typeof s.value === "number" ? formatValue(s.value, s.datatype, s.currency ?? currency) : String(s.value ?? "")}
                </div>
              </div>
            ))}
          </div>
        )}

        {shown?.chart && showChart && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <DeskChart data={shown.chart} currency={currency} />
          </div>
        )}

        {shown && (
          <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in report" aria-label="Search in report" className="h-8 w-56 rounded-md border border-zinc-200 bg-transparent pl-7 pr-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700" />
              </div>
              {isTree && (
                <>
                  <button type="button" className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => setCollapsed(new Set())}>
                    Expand all
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    onClick={() => setCollapsed(new Set(shown.rows.map((r, i) => ((shown.rows[i + 1]?.indent ?? 0) > (r.indent ?? 0) ? i : -1)).filter((i) => i >= 0)))}
                  >
                    Collapse all
                  </button>
                </>
              )}
              <span className="ml-auto text-xs text-zinc-500">
                {rows.length} {rows.length === 1 ? "row" : "rows"}
                {running && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" aria-hidden />}
              </span>
              <div className="relative">
                <button type="button" className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 gap-1 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => setColMenu((o) => !o)} aria-expanded={colMenu}>
                  <Settings2 className="h-3.5 w-3.5" aria-hidden /> Columns
                </button>
                {colMenu && (
                  <div className="absolute right-0 z-30 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {shown.columns
                      .filter((c) => !c.hidden)
                      .map((c) => (
                        <label key={c.fieldname} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          <input
                            type="checkbox"
                            checked={!hiddenCols.has(c.fieldname)}
                            onChange={() =>
                              setHiddenCols((h) => {
                                const n = new Set(h);
                                if (n.has(c.fieldname)) n.delete(c.fieldname);
                                else n.add(c.fieldname);
                                return n;
                              })
                            }
                          />
                          {c.label}
                        </label>
                      ))}
                  </div>
                )}
              </div>
            </div>
            {shown.rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">Nothing to show</div>
            ) : (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- delegates clicks on formatter links
              <div className="max-h-[70vh] overflow-auto" onClick={onTableClick}>
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
                    <tr>
                      <th className="w-10 border-b border-zinc-200 px-2 py-2 text-right text-xs font-medium text-zinc-400 dark:border-zinc-800">#</th>
                      {columns.map((c) => {
                        const num = NUMERIC.has(c.fieldtype);
                        const active = sort?.field === c.fieldname;
                        return (
                          <th
                            key={c.fieldname}
                            scope="col"
                            style={{ minWidth: Math.max(80, c.width ?? 120) }}
                            className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 ${num ? "text-right" : "text-left"}`}
                            aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                          >
                            <button
                              type="button"
                              disabled={isTree}
                              className="inline-flex items-center gap-1 hover:text-zinc-900 disabled:cursor-default dark:hover:text-zinc-100"
                              onClick={() => setSort((s) => (s?.field === c.fieldname ? (s.dir === 1 ? { field: c.fieldname, dir: -1 } : null) : { field: c.fieldname, dir: 1 }))}
                            >
                              {c.label}
                              {active && (sort.dir === 1 ? "↑" : "↓")}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, limit).map(({ row, i, parent }, n) => (
                      <tr key={i} className={`border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${parent ? "font-medium" : ""}`}>
                        <td className="px-2 py-1.5 text-right text-xs tabular-nums text-zinc-400">{n + 1}</td>
                        {columns.map((c, ci) => (
                          <td key={c.fieldname} className={`whitespace-nowrap px-3 py-1.5 align-top ${NUMERIC.has(c.fieldtype) ? "text-right tabular-nums" : ""}`}>
                            {ci === 0 && isTree ? (
                              <span className="flex items-center gap-1" style={{ paddingLeft: (row.indent ?? 0) * 18 }}>
                                {parent ? (
                                  <button
                                    type="button"
                                    aria-label={collapsed.has(i) ? "Expand" : "Collapse"}
                                    className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    onClick={() =>
                                      setCollapsed((s) => {
                                        const nx = new Set(s);
                                        if (nx.has(i)) nx.delete(i);
                                        else nx.add(i);
                                        return nx;
                                      })
                                    }
                                  >
                                    {collapsed.has(i) ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
                                  </button>
                                ) : (
                                  <span className="w-[18px]" />
                                )}
                                <span dangerouslySetInnerHTML={{ __html: render(row[c.fieldname], c, row) }} />
                              </span>
                            ) : (
                              <span dangerouslySetInnerHTML={{ __html: render(row[c.fieldname], c, row) }} />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {total && !query && (
                    <tfoot className="sticky bottom-0 bg-zinc-50 font-semibold dark:bg-zinc-900">
                      <tr>
                        <td className="border-t border-zinc-200 dark:border-zinc-800" />
                        {columns.map((c) => (
                          <td key={c.fieldname} className={`whitespace-nowrap border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 ${NUMERIC.has(c.fieldtype) ? "text-right tabular-nums" : ""}`}>
                            <span dangerouslySetInnerHTML={{ __html: total[c.fieldname] === "Total" ? "Total" : render(total[c.fieldname], c, total) }} />
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
                {rows.length > limit && (
                  <div className="p-3 text-center">
                    <button type="button" className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800" onClick={() => setLimit((l) => l + PAGE)}>
                      Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Desk get_filter_values: drop empties, MultiSelect lists stay arrays */
function cleanFilters(v: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (!isEmpty(x) || x === 0) out[k] = x;
  return out;
}

function selectOptions(options: unknown): Array<{ value: string; label: string }> {
  const list = Array.isArray(options) ? options : String(options ?? "").split("\n");
  return list.map((o) => (typeof o === "object" && o ? { value: String((o as { value?: unknown }).value ?? ""), label: String((o as { label?: unknown }).label ?? (o as { value?: unknown }).value ?? "") } : { value: String(o), label: String(o) }));
}

function FilterControl({ f, value, values, onChange }: { f: ReportFilter; value: unknown; values: Record<string, unknown>; onChange: (v: unknown) => void }) {
  const label = String(f.label ?? f.fieldname);
  const id = `qr-filter-${f.fieldname}`;
  const wrap = (control: React.ReactNode, wide = false) => (
    <div className={wide ? "min-w-56" : "w-44"}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {f.reqd ? <span className="text-red-500" aria-hidden> *</span> : null}
      </label>
      {control}
    </div>
  );
  const inputCls = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900";
  const getQuery = f.get_query
    ? () => {
        try {
          return f.get_query?.() as { filters?: unknown; query?: string } | undefined;
        } catch {
          return undefined;
        }
      }
    : undefined;

  switch (f.fieldtype) {
    case "Link":
      return wrap(
        <div>
          <LinkInput id={id} doctype={String(f.options ?? "")} value={String(value ?? "")} onChange={(v) => onChange(v)} placeholder={label} getQuery={getQuery} className="[&_input]:h-8 [&_input]:w-full" />
        </div>,
      );
    case "Dynamic Link": {
      const dt = String(values[String(f.options ?? "")] ?? "");
      return wrap(dt ? <LinkInput id={id} doctype={dt} value={String(value ?? "")} onChange={(v) => onChange(v)} placeholder={label} className="[&_input]:h-8 [&_input]:w-full" /> : <input id={id} disabled className={inputCls} placeholder={`Select ${f.options} first`} />);
    }
    case "Date":
      return wrap(<DatePicker id={id} compact value={(value as string) ?? ""} onChange={(v) => onChange(v ?? "")} ariaLabel={label} />);
    case "DateRange": {
      const [from, to] = Array.isArray(value) ? (value as string[]) : ["", ""];
      return wrap(
        <div className="flex gap-1">
          <DatePicker id={id} compact value={from ?? ""} onChange={(v) => onChange([v ?? "", to ?? ""])} ariaLabel={`${label} from`} />
          <DatePicker compact value={to ?? ""} onChange={(v) => onChange([from ?? "", v ?? ""])} ariaLabel={`${label} to`} />
        </div>,
        true,
      );
    }
    case "Select":
      return wrap(
        <select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {selectOptions(f.options).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>,
      );
    case "Check":
      return (
        <label className="flex h-8 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={!!Number(value)} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
          {label}
        </label>
      );
    case "Autocomplete":
      return wrap(
        <>
          <input id={id} list={`${id}-options`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={label} />
          <datalist id={`${id}-options`}>
            {selectOptions(f.options).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </datalist>
        </>,
      );
    case "MultiSelectList":
    case "MultiSelect":
      return wrap(<MultiSelect id={id} f={f} value={value} onChange={onChange} />, true);
    case "Int":
    case "Float":
    case "Currency":
    case "Percent":
      return wrap(<input id={id} type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />);
    default:
      return wrap(<input id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder={label} />);
  }
}

/** MultiSelectList: chips + search via the filter's get_data or the Link doctype */
function MultiSelect({ id, f, value, onChange }: { id: string; f: ReportFilter; value: unknown; onChange: (v: unknown) => void }) {
  const selected = Array.isArray(value) ? (value as string[]).filter(Boolean) : value ? String(value).split(",").filter(Boolean) : [];
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Array<{ value: string; description?: string }>>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        let res: unknown;
        if (f.get_data) res = await f.get_data(text);
        else if (f.fieldtype === "MultiSelect" || !f.options) res = selectOptions(f.options).filter((o) => o.value.toLowerCase().includes(text.toLowerCase()));
        else res = (await deskCall("frappe.desk.search.search_link", { doctype: String(f.options), txt: text, page_length: 20 })).env.message;
        const list = (Array.isArray(res) ? res : []).map((o) => (typeof o === "string" ? { value: o } : (o as { value: string; description?: string })));
        if (!cancelled) setOptions(list.filter((o) => o?.value));
      } catch {
        if (!cancelled) setOptions([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, text, f]);

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div className="relative">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900">
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => toggle(s)}>
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="min-w-16 flex-1 bg-transparent text-sm outline-none"
          placeholder={selected.length ? "" : String(f.label ?? "")}
        />
      </div>
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={selected.includes(o.value)}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <input type="checkbox" readOnly tabIndex={-1} checked={selected.includes(o.value)} />
                <span className="truncate">{o.value}</span>
                {o.description && <span className="ml-auto truncate text-xs text-zinc-500">{o.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ReportBridge {
  valuesRef: React.RefObject<Record<string, unknown>>;
  resultRef: React.RefObject<RunResult | null>;
  setFilterValues: (patch: Record<string, unknown>) => void;
  setRunToken: React.Dispatch<React.SetStateAction<number>>;
  setInnerButtons: React.Dispatch<React.SetStateAction<Array<{ label: string; group?: string; action: () => void }>>>;
}

/** Evaluate the report JS with a frappe.query_report object wired to this page */
function buildSettings(
  name: string,
  scriptName: string,
  m: { script?: string; filters?: ReportFilter[] },
  ctx: { user: string; full_name: string; roles: string[]; defaults: Record<string, unknown>; sysdefaults: Record<string, unknown>; perms: Record<string, string[]>; developer_mode: boolean; boot?: Record<string, unknown> },
  b: ReportBridge,
): Settings {
  const rt = createRuntime({ user: ctx.user, full_name: ctx.full_name, roles: ctx.roles, defaults: ctx.defaults, sysdefaults: ctx.sysdefaults, perms: ctx.perms, developer_mode: ctx.developer_mode, boot: ctx.boot });
  const bump = () => b.setRunToken((t) => t + 1);
  const report = lenient({
    report_name: name,
    get_filter_value: (fn: string) => b.valuesRef.current[fn],
    get_filter_values: () => ({ ...b.valuesRef.current }),
    get_values: () => ({ ...b.valuesRef.current }),
    set_filter_value: (fn: string | Record<string, unknown>, v?: unknown) => {
      b.setFilterValues(typeof fn === "string" ? { [fn]: v } : fn);
      return Promise.resolve();
    },
    get_filter: (fn: string) =>
      lenient({
        df: { fieldname: fn },
        get_value: () => b.valuesRef.current[fn],
        set_value: (v: unknown) => b.setFilterValues({ [fn]: v }),
        set_input: (v: unknown) => b.setFilterValues({ [fn]: v }),
      }),
    refresh: bump,
    trigger_refresh: bump,
    get data() {
      return b.resultRef.current?.rows ?? [];
    },
    get columns() {
      return b.resultRef.current?.columns ?? [];
    },
    page: lenient({
      add_inner_button: (label: string, action: () => void, group?: string) =>
        b.setInnerButtons((list) => (list.some((x) => x.label === label) ? list : [...list, { label: String(label).replace(/<[^>]+>/g, ""), action, group }])),
      set_title: () => {},
    }),
  });
  (rt.frappe as Record<string, unknown>).query_report = report;
  rt.evalScript(m.script ?? "", `${name} report js`);
  const qr = (rt.frappe as unknown as { query_reports: Record<string, Settings> }).query_reports[scriptName] ?? {};
  const filters = [...(qr.filters ?? []), ...(m.filters ?? [])].filter((f) => f?.fieldname);
  return { ...qr, filters, __report: report };
}
