"use client";

/**
 * Runs a query report (frappe.desk.query_report.run) whenever filters change, polling prepared
 * reports until they're built (Desk: query_report.js refresh / show_prepared_report_status).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { normalizeColumns, normalizeRows, toChartResult } from "@/lib/report/columns";
import { cleanFilters, type FilterValues, type PreparedState, type RunResult, type Settings } from "./queryReportTypes";

/** frappe.desk.query_report.run's message → the rows / totals / chart / summary the page shows */
function parseRunResult(m: Record<string, unknown>, settings: Settings, name: string): RunResult {
  const columns = normalizeColumns((m.columns as unknown[]) ?? []);
  const addTotal = !!m.add_total_row && !m.skip_total_row;
  const all = normalizeRows((m.result as unknown[]) ?? [], columns);
  // v16 appends the total row server-side (query_report.add_total_row) → footer
  const split = addTotal && all.length > 1;
  const rows = split ? all.slice(0, -1) : all;
  let chart = m.chart;
  if (settings.get_chart_data && rows.length) {
    try {
      chart = settings.get_chart_data(columns, rows) ?? chart;
    } catch (e) {
      console.warn("[query-report] get_chart_data failed", e);
    }
  }
  return {
    columns,
    rows,
    chart: toChartResult(chart, name),
    summary: ((m.report_summary as RunResult["summary"]) ?? []).filter(Boolean),
    message: typeof m.message === "string" ? m.message : undefined,
    totals: split ? all[all.length - 1] : null,
  };
}

const isPending = (doc: PreparedState | null) => !!doc && ["Queued", "Started"].includes(String(doc.status));

interface RunDeps {
  name: string;
  settings: Settings | null;
  valuesRef: React.RefObject<FilterValues>;
  resultRef: React.RefObject<RunResult | null>;
  changedRef: React.RefObject<boolean>;
  setFilterValues: (patch: FilterValues) => void;
  bumpRun: () => void;
  runToken: number;
  values: FilterValues;
  blocked: boolean;
}

export function useQueryReportRun({ name, settings, valuesRef, resultRef, changedRef, setFilterValues, bumpRun, runToken, values, blocked }: RunDeps) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runErr, setRunErr] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedState | null>(null);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** prepared report: keep polling while queued; true when there's a finished result to show */
  const handlePrepared = useCallback(
    (m: Record<string, unknown>) => {
      if (!m.prepared_report) {
        setPrepared(null);
        return true;
      }
      const doc = m.doc as PreparedState | null;
      setPrepared(doc ?? {});
      if (isPending(doc)) poll.current = setTimeout(bumpRun, 3000);
      return doc?.status === "Completed";
    },
    [bumpRun],
  );

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
      const saved = m.custom_filters as FilterValues | undefined;
      if (saved && typeof saved === "object" && !changedRef.current) {
        changedRef.current = true;
        setFilterValues(saved);
      }
      if (!handlePrepared(m)) {
        setResult(null);
        return;
      }
      const r = parseRunResult(m, settings, name);
      resultRef.current = r;
      setResult(r);
    } catch (e) {
      setRunErr(e instanceof Error ? e.message : "Report failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [settings, name, valuesRef, changedRef, resultRef, setFilterValues, handlePrepared]);

  // Desk refreshes on every filter change; debounce bursts from on_change handlers
  useEffect(() => {
    if (!settings || !runToken || blocked) return;
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [runToken, values, settings, run, blocked]);

  useEffect(
    () => () => {
      if (poll.current) clearTimeout(poll.current);
    },
    [],
  );

  const generatePrepared = async () => {
    try {
      await deskCall("frappe.core.doctype.prepared_report.prepared_report.make_prepared_report", {
        report_name: name,
        filters: JSON.stringify(cleanFilters(valuesRef.current)),
      });
      toast.success("Report generation queued");
      setPrepared({ status: "Queued" });
      bumpRun();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not queue report");
    }
  };

  return { result, running, runErr, prepared, generatePrepared };
}
