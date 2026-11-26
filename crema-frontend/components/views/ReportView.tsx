"use client";

/**
 * Report view (Desk: frappe/public/js/frappe/views/reports/report_view.js) — a spreadsheet
 * over frappe.desk.reportview.get:
 *  - pick columns from the DocType and its child tables (child rows fan out like Desk)
 *  - inline edit of draft documents (frappe.client.set_value, child rows by `<cdt>:name`)
 *  - filters, sort per column, group by with count/sum/avg, totals row, page size
 *  - settings remembered per user (user_settings "Report"); Save / Save As → Report Builder report
 */
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useFormMetas } from "@/lib/hooks/useFormMetas";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { deskCall } from "@/lib/frappe/form";
import { toCsv } from "@/lib/report/columns";
import { groupToParam, parseGroupBy, toSettings, type GroupBy } from "@/lib/report/groupBy";
import ColumnPicker from "./reportview/ColumnPicker";
import ReportGrid from "./reportview/ReportGrid";
import { PageSizes, ReportFilterPills, ReportViewHeader, ReportViewToolbar, SaveAsDialog } from "./reportview/ReportViewChrome";
import { colKey, enc, sameCol, sqlCol, type Col, type ReportSettings, type Row, type ViewCol } from "./reportview/shared";
import { useDocfields, useReportViewData } from "./reportview/useReportViewData";
import { useReportViewSettings } from "./reportview/useReportViewSettings";

function downloadCsv(fileName: string, rows: Row[], viewCols: ViewCol[]) {
  const cols = viewCols.map(({ df, k }) => ({ fieldname: k, label: String(df.label ?? k), fieldtype: df.fieldtype }));
  const blob = new Blob([toCsv(rows, cols)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** column reorder / removal over the settings' field list */
function moved(fields: Col[], col: Col, d: -1 | 1): Col[] | null {
  const i = fields.findIndex((c) => sameCol(c, col));
  const j = i + d;
  if (i < 0 || j < 0 || j >= fields.length) return null;
  const next = [...fields];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function ReportView({ doctype, reportName }: { doctype: string; reportName?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: metas, error: metaError } = useFormMetas(doctype);
  const { data: ctx } = useDeskContext();
  const meta = metas?.meta;
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const currency = ctx?.sysdefaults?.currency as string | undefined;

  const docfields = useDocfields(doctype, metas);
  const { settings, report, update } = useReportViewSettings(doctype, reportName, meta, params);
  const children = useMemo(() => metas?.children ?? [], [metas]);
  const groupBy = useMemo(() => (meta ? parseGroupBy(settings?.group_by, meta, children) : null), [meta, settings?.group_by, children]);
  const data = useReportViewData({ doctype, meta, settings, groupBy, docfields, canWrite: ctx?.perms?.can_write });
  const { fields, filters, rows, viewCols } = data;

  const [picker, setPicker] = useState(false);
  const [saveAs, setSaveAs] = useState<string | null>(null);

  const setGroupBy = (g: GroupBy | null) => {
    const next = toSettings(g);
    update({ group_by: next });
    // get_search_params: the grouping travels in the URL so the view can be shared
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("_group_by", groupToParam(next));
    else sp.delete("_group_by");
    router.replace(`${window.location.pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

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

  if (metaError) return <p className="p-6 text-sm text-red-600">{(metaError as Error).message}</p>;
  if (!meta || !settings) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;

  const toggleTotals = () => update({ add_totals_row: settings.add_totals_row ? 0 : 1 });
  const countText = groupBy || data.childDts.length ? `${rows.length} ${rows.length === 1 ? "row" : "rows"}` : `${rows.length} of ${data.total}`;
  const patch = (p: Partial<ReportSettings>) => update(p);

  return (
    <div className="space-y-3 p-4">
      <ReportViewHeader
        doctype={doctype}
        meta={meta}
        reportName={reportName}
        canSaveInPlace={!!reportName && (!report || report.is_standard !== "Yes")}
        fetching={data.fetching}
        totalsOn={!!settings.add_totals_row}
        onRefresh={data.refresh}
        onSave={() => reportName && void saveReport(reportName)}
        onSaveAs={() => setSaveAs("")}
        onPickColumns={() => setPicker(true)}
        onToggleTotals={toggleTotals}
        onExport={() => downloadCsv(reportName ?? doctype, rows, viewCols)}
      />

      <ReportViewToolbar
        meta={meta}
        childMetas={children}
        filters={filters}
        groupBy={groupBy}
        groupLabel={viewCols[0]?.df.label ?? undefined}
        totalsOn={!!settings.add_totals_row}
        countText={countText}
        onAddFilter={(f) => patch({ filters: [...filters.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f] })}
        onGroupBy={setGroupBy}
        onPickColumns={() => setPicker(true)}
        onToggleTotals={toggleTotals}
      />

      <ReportFilterPills meta={meta} filters={filters} metaOf={docfields.metaOf} onChange={(f) => patch({ filters: f })} />

      <ReportGrid
        doctype={doctype}
        data={data}
        groupBy={groupBy}
        groupKey={groupBy ? colKey([groupBy.field, groupBy.doctype], doctype) : ""}
        orderBy={settings.order_by}
        currency={currency}
        dateFormat={dateFormat}
        onSort={(col, dir) => patch({ order_by: `${sqlCol(col)} ${dir}` })}
        onMove={(col, d) => {
          const next = moved(fields, col, d);
          if (next) patch({ fields: next });
        }}
        onRemove={(col) => patch({ fields: fields.filter((c) => !sameCol(c, col)) })}
        onDrill={(v) => {
          if (!groupBy) return;
          patch({ filters: [...filters, [groupBy.doctype, groupBy.field, v == null ? "is" : "=", v ?? "not set"]] });
          setGroupBy(null);
        }}
      />

      <PageSizes pageLength={settings.page_length} canLoadMore={!groupBy && rows.length < data.total} onChange={(n) => patch({ page_length: n })} />

      <ColumnPicker open={picker} onClose={() => setPicker(false)} meta={meta} childMetas={children} value={fields} onChange={(f) => patch({ fields: f })} />
      <SaveAsDialog value={saveAs} onChange={setSaveAs} onSave={(n) => void saveReport(n)} />
    </div>
  );
}
