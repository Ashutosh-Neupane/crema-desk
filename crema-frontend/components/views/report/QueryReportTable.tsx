"use client";

/** Query report grid: search / tree / column toolbar, sortable head, tree rows, totals footer (Desk: DataTable in query_report.js). */
import { ChevronDown, ChevronRight, Loader2, Search, Settings2 } from "lucide-react";
import { useState } from "react";
import { NUMERIC, type ReportColumn, type ReportRow } from "@/lib/report/columns";
import { PAGE, type RunResult } from "./queryReportTypes";
import type { ReportTableState, TableRow } from "./useReportTable";

export type CellRenderer = (value: unknown, column: ReportColumn, row: ReportRow) => string;

const ghost = "inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";
const numCls = (c: ReportColumn) => (NUMERIC.has(c.fieldtype) ? "text-right tabular-nums" : "");

function ColumnMenu({ columns, hidden, onToggle }: { columns: ReportColumn[]; hidden: Set<string>; onToggle: (fieldname: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" className={`${ghost} gap-1`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Settings2 className="h-3.5 w-3.5" aria-hidden /> Columns
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {columns
            .filter((c) => !c.hidden)
            .map((c) => (
              <label key={c.fieldname} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <input type="checkbox" checked={!hidden.has(c.fieldname)} onChange={() => onToggle(c.fieldname)} />
                {c.label}
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

function TableToolbar({ t, result, running }: { t: ReportTableState; result: RunResult; running: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input value={t.query} onChange={(e) => t.setQuery(e.target.value)} placeholder="Search in report" aria-label="Search in report" className="h-8 w-56 rounded-md border border-zinc-200 bg-transparent pl-7 pr-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700" />
      </div>
      {t.isTree && (
        <>
          <button type="button" className={ghost} onClick={t.expandAll}>
            Expand all
          </button>
          <button type="button" className={ghost} onClick={t.collapseAll}>
            Collapse all
          </button>
        </>
      )}
      <span className="ml-auto text-xs text-zinc-500">
        {t.rows.length} {t.rows.length === 1 ? "row" : "rows"}
        {running && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" aria-hidden />}
      </span>
      <ColumnMenu columns={result.columns} hidden={t.hiddenCols} onToggle={t.toggleColumn} />
    </div>
  );
}

function HeaderCell({ c, t }: { c: ReportColumn; t: ReportTableState }) {
  const active = t.sort?.field === c.fieldname;
  const dir = active ? t.sort?.dir : undefined;
  return (
    <th
      scope="col"
      style={{ minWidth: Math.max(80, c.width ?? 120) }}
      className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 ${NUMERIC.has(c.fieldtype) ? "text-right" : "text-left"}`}
      aria-sort={dir ? (dir === 1 ? "ascending" : "descending") : undefined}
    >
      <button type="button" disabled={t.isTree} className="inline-flex items-center gap-1 hover:text-zinc-900 disabled:cursor-default dark:hover:text-zinc-100" onClick={() => t.toggleSort(c.fieldname)}>
        {c.label}
        {dir && (dir === 1 ? "↑" : "↓")}
      </button>
    </th>
  );
}

function TreeCell({ item, t, children }: { item: TableRow; t: ReportTableState; children: React.ReactNode }) {
  const isCollapsed = t.collapsed.has(item.i);
  return (
    <span className="flex items-center gap-1" style={{ paddingLeft: (item.row.indent ?? 0) * 18 }}>
      {item.parent ? (
        <button type="button" aria-label={isCollapsed ? "Expand" : "Collapse"} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700" onClick={() => t.toggleCollapsed(item.i)}>
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
        </button>
      ) : (
        <span className="w-[18px]" />
      )}
      {children}
    </span>
  );
}

function BodyRow({ item, n, t, render }: { item: TableRow; n: number; t: ReportTableState; render: CellRenderer }) {
  return (
    <tr className={`border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/40 ${item.parent ? "font-medium" : ""}`}>
      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-zinc-400">{n + 1}</td>
      {t.columns.map((c, ci) => {
        // render() runs the report formatter and sanitises its HTML (sanitizeHtml)
        const cell = <span dangerouslySetInnerHTML={{ __html: render(item.row[c.fieldname], c, item.row) }} />;
        return (
          <td key={c.fieldname} className={`whitespace-nowrap px-3 py-1.5 align-top ${numCls(c)}`}>
            {ci === 0 && t.isTree ? (
              <TreeCell item={item} t={t}>
                {cell}
              </TreeCell>
            ) : (
              cell
            )}
          </td>
        );
      })}
    </tr>
  );
}

function TotalsRow({ total, columns, render }: { total: ReportRow; columns: ReportColumn[]; render: CellRenderer }) {
  return (
    <tfoot className="sticky bottom-0 bg-zinc-50 font-semibold dark:bg-zinc-900">
      <tr>
        <td className="border-t border-zinc-200 dark:border-zinc-800" />
        {columns.map((c) => (
          <td key={c.fieldname} className={`whitespace-nowrap border-t border-zinc-200 px-3 py-2 dark:border-zinc-800 ${numCls(c)}`}>
            <span dangerouslySetInnerHTML={{ __html: total[c.fieldname] === "Total" ? "Total" : render(total[c.fieldname], c, total) }} />
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

function ReportGrid({ t, render, onTableClick }: { t: ReportTableState; render: CellRenderer; onTableClick: (e: React.MouseEvent) => void }) {
  const remaining = t.rows.length - t.limit;
  // links rendered by report formatters (HTML strings) are focusable <a>s, so Enter on them already
  // fires this delegated click; the wrapper itself needs no keyboard handler or role
  /* eslint-disable jsx-a11y/click-events-have-key-events */
  return (
    // react-doctor-disable-next-line react-doctor/click-events-have-key-events, react-doctor/no-static-element-interactions -- delegated click for formatter-rendered links
    <div className="max-h-[70vh] overflow-auto" onClick={onTableClick}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="w-10 border-b border-zinc-200 px-2 py-2 text-right text-xs font-medium text-zinc-400 dark:border-zinc-800">#</th>
            {t.columns.map((c) => (
              <HeaderCell key={c.fieldname} c={c} t={t} />
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.slice(0, t.limit).map((item, n) => (
            <BodyRow key={item.i} item={item} n={n} t={t} render={render} />
          ))}
        </tbody>
        {t.total && !t.query && <TotalsRow total={t.total} columns={t.columns} render={render} />}
      </table>
      {remaining > 0 && (
        <div className="p-3 text-center">
          <button type="button" className="inline-flex items-center justify-center rounded-lg font-medium disabled:opacity-50 h-8 border border-zinc-200 bg-white px-3 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800" onClick={t.showMore}>
            Show {Math.min(PAGE, remaining)} more of {remaining}
          </button>
        </div>
      )}
    </div>
  );
  /* eslint-enable jsx-a11y/click-events-have-key-events */
}

export default function QueryReportTable({ t, result, running, render, onTableClick }: { t: ReportTableState; result: RunResult; running: boolean; render: CellRenderer; onTableClick: (e: React.MouseEvent) => void }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <TableToolbar t={t} result={result} running={running} />
      {result.rows.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">Nothing to show</div> : <ReportGrid t={t} render={render} onTableClick={onTableClick} />}
    </div>
  );
}
