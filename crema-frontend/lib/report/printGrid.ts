/**
 * Query report PDF (Desk: query_report.js pdf_report / get_filters_html_for_print / get_data_for_print,
 * views/reports/print_grid.html, public/html/print_template.html → frappe.utils.print_format.report_to_pdf).
 */
import { formatCell } from "@/lib/list/format";
import { NUMERIC, type ReportColumn, type ReportRow } from "@/lib/report/columns";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const strip = (s: string) => s.replace(/<[^>]+>/g, "");

export interface PrintFilter {
  label: string;
  value: unknown;
  fieldtype?: string;
}

export interface PrintGridInput {
  title: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** server-computed total row (rendered last, bold, first column "Total") */
  totals?: ReportRow | null;
  filters?: PrintFilter[];
  includeFilters?: boolean;
  landscape: boolean;
  fmt: { currency?: string; dateFormat?: string };
}

// a trimmed stand-in for print.bundle.css: bordered table, small type
const CSS = `
body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 12px; color: #1f272e; margin: 0; }
.print-format { padding: 0.25in; }
.print-format.landscape { width: 100%; }
h2.text-center { text-align: center; margin: 0 0 8px; font-size: 18px; }
hr { border: 0; border-top: 1px solid #d1d8dd; margin: 8px 0; }
.filter-row { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #d1d8dd; padding: 4px 6px; vertical-align: top; }
th { background: #f5f7fa; text-align: left; }
.text-right { text-align: right; }
.overflow-wrap-anywhere { overflow-wrap: anywhere; }
`;

/** Desk get_filters_html_for_print */
export function filtersHtml(filters: PrintFilter[], fmt: { currency?: string; dateFormat?: string }): string {
  return filters
    .filter((f) => f.value != null && f.value !== "" && !(Array.isArray(f.value) && !f.value.length))
    .map((f) => {
      const v = f.fieldtype === "Check" ? (Number(f.value) ? "Yes" : "No") : Array.isArray(f.value) ? f.value.join(", ") : formatCell(f.value, { fieldtype: f.fieldtype ?? "Data" }, {}, fmt);
      return `<div class="filter-row"><strong>${esc(f.label)}:</strong> ${esc(v)}</div>`;
    })
    .join("");
}

/** print_grid.html rendered inside print_template.html */
export function buildReportHtml(p: PrintGridInput): string {
  const cols = p.columns.filter((c) => !c.hidden);
  const subtitle = p.includeFilters && p.filters?.length ? filtersHtml(p.filters, p.fmt) : "";
  const all: Array<{ row: ReportRow; total: boolean }> = p.rows.map((row) => ({ row, total: false }));
  if (p.totals) all.push({ row: p.totals, total: true });
  const head = cols.map((c) => `<th${NUMERIC.has(c.fieldtype) ? ' class="text-right"' : ""}${c.width ? ` style="min-width: ${Math.round(c.width)}px"` : ""}>${esc(strip(c.label))}</th>`).join("");
  const body = all
    .map(({ row, total }, i) => {
      const bold = row.bold === 1 || total ? ' style="font-weight: bold"' : "";
      const cells = cols
        .map((c, ci) => {
          const value = row[c.fieldname];
          let text: string;
          if (total && ci === 0) text = "Total";
          else if (c.fieldtype === "Check") text = Number(value) === 1 ? "✓" : "✗";
          else if (typeof value === "string" && /^'.+'$/.test(value)) text = value.slice(1, -1);
          else text = strip(formatCell(value, c as never, total && ["Currency", "Float"].includes(c.fieldtype) ? (p.rows[0] ?? row) : row, p.fmt));
          const longest = String(value ?? "").split(" ").reduce((a, w) => (w.length > a.length ? w : a), "");
          const cls = [NUMERIC.has(c.fieldtype) ? "text-right" : "", longest.length > 45 ? "overflow-wrap-anywhere" : ""].filter(Boolean).join(" ");
          const pad = ci === 0 && row.indent ? ` style="padding-left: ${Number(row.indent) * 2}em"` : "";
          return `<td${cls ? ` class="${cls}"` : ""}${bold}><span${pad}>${esc(text)}</span></td>`;
        })
        .join("");
      return `<tr style="height: 30px"><td${bold}><span>${total ? "" : i + 1}</span></td>${cells}</tr>`;
    })
    .join("");
  const small = cols.length > 20 ? ' style="font-size: 4pt"' : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>${CSS}</style></head><body><div class="print-format-gutter"><div class="print-format${p.landscape ? " landscape" : ""}"${small}><h2 class="text-center">${esc(p.title)}</h2><hr>${subtitle ? `${subtitle}<hr>` : ""}<table class="table table-bordered"><thead><tr><th> # </th>${head}</tr></thead><tbody>${body}</tbody></table></div></div></body></html>`;
}

/** Desk frappe.render_pdf: POST html + orientation to report_to_pdf, save the returned PDF */
export async function downloadReportPdf(html: string, orientation: "Landscape" | "Portrait", filename: string): Promise<void> {
  const res = await fetch("/api/frappe/api/method/frappe.utils.print_format.report_to_pdf", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, orientation }),
  });
  if (!res.ok || !res.headers.get("content-type")?.includes("pdf")) {
    const body = await res.text().catch(() => "");
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(body) as { exception?: string; exc_type?: string };
      msg = j.exception ?? j.exc_type ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
