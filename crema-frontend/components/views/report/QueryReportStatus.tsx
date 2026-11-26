"use client";

/** Query report notices (loading, missing filters, errors, prepared report status) and the report summary strip. */
import { Loader2 } from "lucide-react";
import { sanitizeHtml } from "@/lib/report/columns";
import { summaryValue, type PreparedState, type ReportFilter, type SummaryItem } from "./queryReportTypes";

const SUMMARY_TONE: Record<string, string> = {
  green: "text-emerald-700 dark:text-emerald-400",
  red: "text-red-700 dark:text-red-400",
  blue: "text-blue-700 dark:text-blue-400",
  orange: "text-amber-700 dark:text-amber-400",
};
const tone = (c: unknown, fallback: string) => SUMMARY_TONE[String(c ?? "").toLowerCase()] ?? fallback;

function PreparedNotice({ prepared }: { prepared: PreparedState }) {
  const { status } = prepared;
  let body: React.ReactNode = "This report runs in the background. Click Generate New Report to build it for the current filters.";
  if (status === "Queued" || status === "Started") {
    body = (
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> This is a prepared report — generating in the background ({status})…
      </span>
    );
  } else if (status === "Error" || status === "Failed") body = "Report generation failed. Rebuild to try again.";
  return <div className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{body}</div>;
}

export function QueryReportNotices({ loading, missing, runErr, prepared, message }: { loading: boolean; missing: ReportFilter[] | null; runErr: string | null; prepared: PreparedState | null; message?: string }) {
  return (
    <>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading report…
        </div>
      )}
      {missing && missing.length > 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Set {missing.map((f) => f.label ?? f.fieldname).join(", ")} to run this report.
        </div>
      )}
      {runErr && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{runErr}</div>}
      {prepared && prepared.status !== "Completed" && <PreparedNotice prepared={prepared} />}
      {message && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" dangerouslySetInnerHTML={{ __html: sanitizeHtml(message) }} />}
    </>
  );
}

/** utils.js build_summary_item: separators ("-", "=") between figures; values formatted like cells */
export function ReportSummary({ summary, currency, dateFormat }: { summary: SummaryItem[]; currency?: string; dateFormat: string }) {
  if (!summary.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {summary.map((s, i, all) =>
        s.type === "separator" ? (
          <div key={`after-${String(all[i - 1]?.label ?? "start")}`} data-summary-separator className={`self-center text-lg font-semibold ${tone(s.color, "text-zinc-400")}`}>
            {String(s.value ?? "")}
          </div>
        ) : (
          <div key={String(s.label)} data-summary-item className="min-w-40 flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs text-zinc-500">{String(s.label).replace(/<[^>]+>/g, "")}</div>
            <div className={`mt-1 text-lg font-semibold tabular-nums ${tone(s.indicator ?? s.color, "text-zinc-900 dark:text-zinc-100")}`}>{summaryValue(s, currency, dateFormat)}</div>
          </div>
        ),
      )}
    </div>
  );
}
