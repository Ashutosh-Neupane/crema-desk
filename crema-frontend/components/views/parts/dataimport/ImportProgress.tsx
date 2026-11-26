"use client";

import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { DONE, contentKeys, enc, strip, type LogRow, type Status } from "./shared";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

/** "Row 2, 3" from the log's JSON row_indexes */
function rowLabel(l: LogRow) {
  try {
    return (JSON.parse(l.row_indexes || "[]") as number[]).join(", ");
  } catch {
    return l.row_indexes;
  }
}

/** the log's messages (a JSON string of a JSON list), or the last line of its traceback */
function logMessages(l: LogRow): string[] {
  try {
    const parsed = JSON.parse(JSON.parse(l.messages || '"[]"')) as Array<{ message?: string; title?: string }>;
    return parsed.map((m) => strip(m.message ?? m.title ?? ""));
  } catch {
    return l.exception ? [l.exception.split("\n").filter(Boolean).pop() ?? ""] : [];
  }
}

function StatusIcon({ status }: { status: string }) {
  if (!DONE.has(status)) return <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-hidden />;
  if (status === "Success") return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
  return <XCircle className="h-4 w-4 text-red-600" aria-hidden />;
}

/** step 4: progress while the background job runs, then the failures and created records */
export function ImportProgress({ status, logs, doctype, di }: { status: Status; logs: LogRow[]; doctype: string; di: string | null }) {
  const done = DONE.has(status.status);
  const pct = status.total_records ? Math.round(((status.processed_records ?? 0) / status.total_records) * 100) : 0;
  const failedLogs = logs.filter((l) => !l.success);
  const failedKeys = contentKeys(failedLogs, (l) => l.row_indexes ?? "");
  const created = logs.filter((l) => l.success && l.docname).slice(0, 10);
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon status={status.status} />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Import status: {status.status}</span>
        <span className="text-zinc-500">
          {status.success ?? 0} imported{status.failed ? `, ${status.failed} failed` : ""}
          {status.total_records ? ` of ${status.total_records}` : ""}
        </span>
        {done && doctype && (
          <Link href={`${doctypeUrl(doctype)}`} className="ml-auto text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
            Open {doctype} list
          </Link>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Import progress">
        <div className={`h-full transition-all ${status.failed ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${done ? 100 : pct}%` }} />
      </div>
      {failedLogs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {failedLogs.map((l, i) => (
            <li key={failedKeys[i]} className="rounded-md bg-red-50 px-3 py-1.5 text-red-800 dark:bg-red-950/40 dark:text-red-300">
              Row {rowLabel(l)}: {logMessages(l).join("; ") || "Failed"}
            </li>
          ))}
        </ul>
      )}
      {logs.some((l) => l.success) && (
        <p className="text-xs text-zinc-500">
          Created:{" "}
          {created.map((l, i) => (
            <span key={l.docname}>
              <Link href={`${doctypeUrl(doctype)}/${enc(String(l.docname))}`} className="underline">
                {l.docname}
              </Link>
              {i < created.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}
      {di && (
        <Link href={`/desk/data-import/${enc(di)}`} className="text-xs text-zinc-500 underline">
          View Data Import record
        </Link>
      )}
    </section>
  );
}
