"use client";

/**
 * Query / Script report page (Desk: frappe/public/js/frappe/views/reports/query_report.js).
 * The report's own JS (frappe.query_reports[name] via query_report.get_script) supplies
 * filters, formatter, onload, get_chart_data and tree settings; data comes from
 * frappe.desk.query_report.run. Prepared reports are generated in the background
 * and polled until ready.
 */
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import DeskChart from "@/components/desk/DeskChart";
import { defaultFormatter, sanitizeHtml, toCsv, type ReportColumn, type ReportRow } from "@/lib/report/columns";
import { buildReportHtml, downloadReportPdf } from "@/lib/report/printGrid";
import { PdfSettingsDialog, SaveReportDialog, type PdfSettings } from "@/components/views/ReportDialogs";
import FilterControl from "./report/FilterControl";
import QueryReportHeader from "./report/QueryReportHeader";
import QueryReportTable from "./report/QueryReportTable";
import { QueryReportNotices, ReportSummary } from "./report/QueryReportStatus";
import { useQueryReportRun } from "./report/useQueryReportRun";
import { useQueryReportSettings } from "./report/useQueryReportSettings";
import { useReportTable, type ReportTableState } from "./report/useReportTable";
import { SKIP, cleanFilters, enc, filterActive, isEmpty, pdfFileName, type FilterValues, type ReportFilter, type RunResult, type Settings } from "./report/queryReportTypes";

const noopSubscribe = () => () => {};

/** a cell's HTML: the report JS formatter over Desk's default formatter, sanitised */
function makeRenderer(settings: Settings | null, fmtCtx: { currency?: string; dateFormat: string }) {
  const ctx = { ...fmtCtx, linkFormatters: settings?.__linkFormatters };
  return (value: unknown, column: ReportColumn, row: ReportRow) => {
    const base = (v: unknown, _r?: unknown, c?: ReportColumn, d?: ReportRow) => defaultFormatter(v, c ?? column, d ?? row, ctx);
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
}

/** A Desk link (`/app/<slug>/<name>`, Desk's old prefix) → the same Desk URL under /desk, which Crema serves */
function deskHref(href: string): string | null {
  if (href.startsWith("/desk/")) return href;
  const m = href.match(/^\/app\/(.+)$/);
  return m ? `/desk/${m[1]}` : null;
}

function downloadCsv(name: string, rows: ReportRow[], columns: ReportColumn[]) {
  const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Save As (query_report.save_report) and PDF (Desk menu: Save, PDF) */
function useReportActions(name: string, filters: ReportFilter[], valuesRef: React.RefObject<FilterValues>, t: ReportTableState, fmt: { currency?: string; dateFormat: string }) {
  const router = useRouter();
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
        columns: JSON.stringify(t.columns),
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
    setBusy(true);
    try {
      const picked = s.columns ? new Set(s.columns) : null;
      const applied = cleanFilters(valuesRef.current);
      const html = buildReportHtml({
        title: name,
        columns: picked ? t.columns.filter((c) => picked.has(c.fieldname)) : t.columns,
        rows: t.rows.map((r) => r.row),
        totals: t.total,
        filters: filters.filter((f) => f.fieldname in applied && !SKIP.has(f.fieldtype)).map((f) => ({ label: String(f.label ?? f.fieldname), value: applied[f.fieldname], fieldtype: f.fieldtype })),
        includeFilters: s.includeFilters,
        landscape: s.orientation === "Landscape",
        fmt,
      });
      await downloadReportPdf(html, s.orientation, pdfFileName(name, applied));
      setPdfOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? `PDF failed: ${e.message}` : "PDF failed", { duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  return { saveOpen, setSaveOpen, pdfOpen, setPdfOpen, busy, saveReport, pdfReport };
}

/** the filters shown, and the required ones still empty (depends_on decides both) */
function filterState(settings: Settings | null, values: FilterValues) {
  const filters = settings?.filters ?? [];
  return {
    filters,
    visibleFilters: filters.filter((f) => !f.hidden && !SKIP.has(f.fieldtype) && filterActive(f, values)),
    missing: filters.filter((f) => f.reqd && !f.hidden && isEmpty(values[f.fieldname]) && filterActive(f, values)),
  };
}

/** Save As is for Report Managers (Desk: query_report.js add_menu_items) */
function useIsReportManager(ctx: { user: string; roles: string[] } | undefined) {
  // role-dependent, from the client-side desk context: shown only after hydration so server and client markup match
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated && !!ctx && (ctx.user === "Administrator" || ctx.roles.includes("System Manager") || ctx.roles.includes("Report Manager"));
}

/** in-app navigation for links produced by formatters */
function useFormatterLinks(settings: Settings | null) {
  const router = useRouter();
  return (e: React.MouseEvent) => {
    // a column's link_onclick (Desk formatters.js: <a onclick="…; return false">) runs in the report's runtime
    const onclick = (e.target as HTMLElement).closest("a[data-link-onclick]")?.getAttribute("data-link-onclick");
    if (onclick) {
      e.preventDefault();
      settings?.__eval?.(onclick);
      return;
    }
    const href = (e.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href || e.metaKey || e.ctrlKey) return;
    const to = deskHref(href);
    if (!to) return;
    e.preventDefault();
    router.push(to);
  };
}

export default function QueryReport({ name }: { name: string }) {
  const { data: ctx } = useDeskContext();
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const currency = (ctx?.sysdefaults?.currency as string | undefined) ?? undefined;

  const s = useQueryReportSettings(name, ctx);
  const { settings, values } = s;
  const { filters, visibleFilters, missing } = filterState(settings, values);

  const r = useQueryReportRun({ name, settings, valuesRef: s.valuesRef, resultRef: s.resultRef, changedRef: s.changedRef, setFilterValues: s.setFilterValues, bumpRun: s.bumpRun, runToken: s.runToken, values, blocked: missing.length > 0 });
  const t = useReportTable(r.result, settings?.initial_depth);
  const actions = useReportActions(name, filters, s.valuesRef, t, { currency, dateFormat });
  const [showChart, setShowChart] = useState(true);

  const isReportManager = useIsReportManager(ctx);

  const changeFilter = (f: ReportFilter, v: unknown) => {
    s.editFilter({ [f.fieldname]: v });
    try {
      f.on_change?.(settings?.__report);
    } catch (e) {
      console.warn("[query-report] on_change failed", e);
    }
  };

  const onTableClick = useFormatterLinks(settings);

  if (s.loadErr) return <div className="p-6 text-sm text-red-600">{s.loadErr}</div>;

  const shown: RunResult | null = missing.length ? null : r.result;
  const render = makeRenderer(settings, { currency, dateFormat });

  return (
    <div className="flex min-h-full flex-col">
      <QueryReportHeader
        name={name}
        refDoctype={s.reportDoc.ref_doctype}
        innerButtons={s.innerButtons}
        hasChart={!!shown?.chart}
        showChart={showChart}
        onToggleChart={() => setShowChart((x) => !x)}
        hasRows={!!shown?.rows.length}
        canSave={!!shown}
        showSave={isReportManager}
        onExport={() => r.result && downloadCsv(name, r.result.rows, t.columns)}
        onPdf={() => actions.setPdfOpen(true)}
        onSave={() => actions.setSaveOpen(true)}
        prepared={r.prepared}
        running={r.running}
        onGenerate={() => void r.generatePrepared()}
        onRefresh={s.bumpRun}
      />

      {actions.saveOpen && <SaveReportDialog open onClose={() => actions.setSaveOpen(false)} defaultName={s.reportDoc.is_standard === "No" ? name : ""} busy={actions.busy} onSave={(n) => void actions.saveReport(n)} />}
      {actions.pdfOpen && r.result && <PdfSettingsDialog open onClose={() => actions.setPdfOpen(false)} columns={t.columns} busy={actions.busy} onSubmit={(x) => void actions.pdfReport(x)} />}

      {visibleFilters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          {visibleFilters.map((f) => (
            <FilterControl key={f.fieldname} f={f} value={values[f.fieldname]} values={values} onChange={(v) => changeFilter(f, v)} />
          ))}
        </div>
      )}

      <div className="flex-1 space-y-4 p-4">
        <QueryReportNotices loading={!settings} missing={settings ? missing : null} runErr={r.runErr} prepared={r.prepared} message={shown?.message} />
        {shown && <ReportSummary summary={shown.summary} currency={currency} dateFormat={dateFormat} />}
        {shown?.chart && showChart && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <DeskChart data={shown.chart} currency={currency} />
          </div>
        )}
        {shown && <QueryReportTable t={t} result={shown} running={r.running} render={render} onTableClick={onTableClick} />}
      </div>
    </div>
  );
}
