"use client";

/**
 * Loads a query report's meta + JS (frappe.desk.query_report.get_script) into Settings and owns the
 * filter values the report JS reads synchronously (Desk: query_report.js load_report / get_report_settings).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reportHelpers } from "@/lib/desk-runtime/appHelpers";
import { deskCall } from "@/lib/frappe/form";
import { buildSettings, type ReportBridge, type RuntimeContext } from "./buildSettings";
import { enc, initialFilterValues, type FilterValues, type InnerButton, type ReportDocInfo, type ReportFilter, type RunResult, type Settings } from "./queryReportTypes";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

type Loaded = { redirect: string } | { settings: Settings; info: ReportDocInfo; values: FilterValues };

async function loadReport(name: string, ctx: RuntimeContext, bridge: ReportBridge, isCancelled: () => boolean): Promise<Loaded | null> {
  const [s, meta] = await Promise.all([
    deskCall("frappe.desk.query_report.get_script", { report_name: name }),
    deskCall("frappe.client.get_value", { doctype: "Report", filters: { name }, fieldname: ["report_type", "ref_doctype", "reference_report", "is_standard"] }).catch(() => null),
  ]);
  if (isCancelled()) return null;
  const m = (s.env.message ?? {}) as { script?: string; filters?: ReportFilter[] };
  // the app's shared report JS the script builds on (erpnext.financial_statements, erpnext.utils, …)
  const helpers = await reportHelpers(m.script ?? "");
  if (isCancelled()) return null;
  const info = (meta?.env.message ?? {}) as ReportDocInfo;
  if (info.report_type === "Report Builder" && info.ref_doctype) return { redirect: `${doctypeUrl(info.ref_doctype)}/view/report/${enc(name)}` };
  // Desk get_local_report_settings: a Custom Report runs the script of its reference report
  const scriptName = info.report_type === "Custom Report" && info.reference_report ? info.reference_report : name;
  const settings = await buildSettings(name, scriptName, m, ctx, bridge, helpers);
  if (isCancelled()) return null;
  return { settings, info, values: initialFilterValues(settings.filters ?? [], window.location.search) };
}

export function useQueryReportSettings(name: string, ctx: RuntimeContext | undefined) {
  const router = useRouter();
  const [values, setValues] = useState<FilterValues>({});
  const valuesRef = useRef(values);
  const resultRef = useRef<RunResult | null>(null);
  // Desk refresh(have_filters_changed): saved Custom Report filters apply only while the user hasn't edited filters
  const changedRef = useRef(false);
  const [runToken, setRunToken] = useState(0);
  const [innerButtons, setInnerButtons] = useState<InnerButton[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [reportDoc, setReportDoc] = useState<ReportDocInfo>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const setFilterValues = useCallback((patch: FilterValues) => {
    valuesRef.current = { ...valuesRef.current, ...patch };
    setValues(valuesRef.current);
  }, []);
  /** a filter edited by the user: saved Custom Report filters no longer apply */
  const editFilter = useCallback(
    (patch: FilterValues) => {
      changedRef.current = true;
      setFilterValues(patch);
    },
    [setFilterValues],
  );
  const bumpRun = useCallback(() => setRunToken((t) => t + 1), []);

  const bridge = useMemo<ReportBridge>(
    () => ({
      valuesRef,
      resultRef,
      setFilterValues,
      bumpRun,
      addInnerButton: (b) => setInnerButtons((list) => (list.some((x) => x.label === b.label) ? list : [...list, b])),
      navigate: (url) => router.push(url),
    }),
    [setFilterValues, bumpRun, router],
  );

  useEffect(() => {
    if (!ctx) return;
    let cancelled = false;
    const isCancelled = () => cancelled;
    const load = async () => {
      try {
        const loaded = await loadReport(name, ctx, bridge, isCancelled);
        if (cancelled || !loaded) return;
        if ("redirect" in loaded) {
          // a Report Builder report opens in the report view; only the Report doc (fetched here) says so
          // react-doctor-disable-next-line react-doctor/nextjs-no-client-side-redirect -- the report type comes from a client Desk call after mount; there is nothing to redirect on server-side
          router.replace(loaded.redirect);
          return;
        }
        valuesRef.current = loaded.values;
        setValues(loaded.values);
        setInnerButtons([]);
        setReportDoc(loaded.info);
        changedRef.current = false;
        setSettings(loaded.settings);
        try {
          loaded.settings.onload?.(loaded.settings.__report);
        } catch (e) {
          console.warn("[query-report] onload failed", e);
        }
        setRunToken((t) => t + 1);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Failed to load report");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [name, ctx, bridge, router]);

  return { values, valuesRef, resultRef, changedRef, setFilterValues, editFilter, runToken, bumpRun, innerButtons, settings, reportDoc, loadErr };
}
