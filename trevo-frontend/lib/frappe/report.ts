/**
 * Report execution.
 */
import { frappeMethod, frappeGet } from "./client";

export interface ReportResult {
  result: unknown[];
  columns: unknown[];
  chart?: Record<string, unknown>;
}

export async function runReport(
  report_name: string,
  filters?: Record<string, unknown>,
): Promise<ReportResult> {
  const args: Record<string, unknown> = { report_name };
  if (filters) args.filters = typeof filters === "string" ? filters : JSON.stringify(filters);
  return frappeMethod<ReportResult>("frappe.desk.query_report.run", args);
}

export async function fetchReportMeta(report_name: string) {
  return frappeGet<Record<string, unknown>>(`Report/${encodeURIComponent(report_name)}`);
}
