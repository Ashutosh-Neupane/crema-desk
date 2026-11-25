"use client";

import { AlertTriangle } from "lucide-react";
import { contentKeys, strip, type Preview } from "./shared";

/** step 3: the parsed file with its column mapping and warnings */
export function ImportPreview({ preview, canStart, onStart }: { preview: Preview; canStart: boolean; onStart: () => void }) {
  const errors = preview.warnings.filter((w) => w.type !== "info").slice(0, 20);
  const errorKeys = contentKeys(errors, (w) => `${w.row ?? ""}|${w.col ?? ""}|${w.message}`);
  const colKeys = contentKeys(preview.columns, (c) => c.header_title);
  const rows = preview.data.slice(0, 50);
  const rowKeys = contentKeys(rows, (row) => String(row[0] ?? ""));
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Preview</h2>
        <span className="text-xs text-zinc-500">
          {preview.total_number_of_rows} {preview.total_number_of_rows === 1 ? "row" : "rows"} · {preview.columns.filter((c) => !c.skip_import).length} columns
        </span>
        {canStart && (
          <button type="button" onClick={onStart} disabled={preview.total_number_of_rows === 0} className="ml-auto h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            Start Import
          </button>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {errors.map((w, i) => (
            <li key={errorKeys[i]} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                {w.row ? `Row ${w.row}: ` : ""}
                {strip(w.message)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="max-h-96 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm" aria-label="Import preview">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
            <tr>
              {preview.columns.map((c, i) => (
                <th key={colKeys[i]} scope="col" className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium dark:border-zinc-800 ${c.skip_import ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                  {c.header_title}
                  {!c.skip_import && c.df?.fieldname && <span className="block font-normal text-zinc-400">→ {c.df.label ?? c.df.fieldname}</span>}
                  {c.warnings?.length ? <span className="block font-normal text-amber-600">{strip(c.warnings[0].message)}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={rowKeys[ri]} className="border-b border-zinc-100 dark:border-zinc-800">
                {row.map((v, ci) => (
                  <td key={colKeys[ci] ?? `extra${ci}`} className={`whitespace-nowrap px-3 py-1.5 ${preview.columns[ci]?.skip_import ? "text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                    {v == null ? "" : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
