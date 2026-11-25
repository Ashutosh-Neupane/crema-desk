/**
 * Evaluates a query report's JS (frappe.query_reports[name]) in the desk runtime with a
 * frappe.query_report object wired to the page (Desk: query_report.js get_report_settings).
 */
import { createRuntime, lenient } from "@/lib/desk-runtime";
import type { HelperScript } from "@/lib/desk-runtime/appHelpers";
import type { LinkFormatters } from "@/lib/report/columns";
import type { FilterValues, InnerButton, ReportFilter, RunResult, Settings } from "./queryReportTypes";

export interface ReportBridge {
  valuesRef: React.RefObject<FilterValues>;
  resultRef: React.RefObject<RunResult | null>;
  setFilterValues: (patch: FilterValues) => void;
  bumpRun: () => void;
  addInnerButton: (button: InnerButton) => void;
  /** frappe.set_route from the report's JS (open_general_ledger → General Ledger) */
  navigate: (url: string) => void;
}

export interface RuntimeContext {
  user: string;
  full_name: string;
  roles: string[];
  defaults: Record<string, unknown>;
  sysdefaults: Record<string, unknown>;
  perms: Record<string, string[]>;
  developer_mode: boolean;
  boot?: Record<string, unknown>;
  docs?: Record<string, Record<string, Record<string, unknown>>>;
}

interface FilterControlHandle {
  df: ReportFilter;
  get_value: () => unknown;
  set_value: (v: unknown) => Promise<void>;
}

function makeReportApi(name: string, b: ReportBridge, getControls: () => FilterControlHandle[]) {
  return lenient({
    get filters() {
      return getControls();
    },
    report_name: name,
    get_filter_value: (fn: string) => b.valuesRef.current[fn],
    get_filter_values: () => ({ ...b.valuesRef.current }),
    get_values: () => ({ ...b.valuesRef.current }),
    set_filter_value: (fn: string | FilterValues, v?: unknown) => {
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
    refresh: b.bumpRun,
    trigger_refresh: b.bumpRun,
    get data() {
      return b.resultRef.current?.rows ?? [];
    },
    get columns() {
      return b.resultRef.current?.columns ?? [];
    },
    page: lenient({
      add_inner_button: (label: string, action: () => void, group?: string) => b.addInnerButton({ label: String(label).replace(/<[^>]+>/g, ""), action, group }),
      set_title: () => {},
    }),
  });
}

/** Evaluate the report JS with a frappe.query_report object wired to this page */
export async function buildSettings(name: string, scriptName: string, m: { script?: string; filters?: ReportFilter[] }, ctx: RuntimeContext, b: ReportBridge, helpers: HelperScript[] = []): Promise<Settings> {
  const rt = createRuntime({ user: ctx.user, full_name: ctx.full_name, roles: ctx.roles, defaults: ctx.defaults, sysdefaults: ctx.sysdefaults, perms: ctx.perms, developer_mode: ctx.developer_mode, boot: ctx.boot, docs: ctx.docs, navigate: b.navigate });
  let controls: FilterControlHandle[] = [];
  const report = makeReportApi(name, b, () => controls);
  (rt.frappe as Record<string, unknown>).query_report = report;
  // keep Crema's boot-based get_fiscal_year: ERPNext's utils.js falls back to a synchronous request
  const utils = (rt.globals.erpnext as { utils?: Record<string, unknown> } | undefined)?.utils;
  const fiscalYear = utils?.get_fiscal_year;
  for (const h of helpers) rt.evalScript(h.code, h.label);
  if (utils && fiscalYear) utils.get_fiscal_year = fiscalYear;
  rt.evalScript(m.script ?? "", `${name} report js`);
  // query_report.js get_report_settings: frappe.after_ajax before the filters are read
  await Promise.race([rt.afterAjax(), new Promise((r) => setTimeout(r, 8000))]);
  const qr = (rt.frappe as unknown as { query_reports: Record<string, Settings> }).query_reports[scriptName] ?? {};
  const filters = [...(qr.filters ?? []), ...(m.filters ?? [])].filter((f) => f?.fieldname);
  // frappe.query_report.filters: the filter controls (open_general_ledger reads f.df.fieldname / f.get_value())
  controls = filters.map((df) => ({
    df,
    get_value: () => b.valuesRef.current[df.fieldname],
    set_value: (v: unknown) => {
      b.setFilterValues({ [df.fieldname]: v });
      return Promise.resolve();
    },
  }));
  return {
    ...qr,
    filters,
    __report: report,
    __eval: (code: string) => rt.evalExpr(code, `${name} link_onclick`),
    __linkFormatters: (rt.frappe as unknown as { form: { link_formatters: LinkFormatters } }).form.link_formatters,
  };
}
