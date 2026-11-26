"use client";

/** Report view spreadsheet: column menus, inline-editable cells, group drill-down, totals (Desk: report_view.js setup_datatable). */
import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, MoreHorizontal } from "lucide-react";
import { formatCell } from "@/lib/list/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import type { GroupBy } from "@/lib/report/groupBy";
import CellEditor from "./CellEditor";
import { NUMERIC, enc, type Col, type Row, type ViewCol } from "./shared";
import type { ReportViewData } from "./useReportViewData";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

type SortDir = "asc" | "desc";
const DOCSTATUS = ["Draft", "Submitted", "Cancelled"];
const numCls = (fieldtype: string) => (NUMERIC.has(fieldtype) ? "text-right tabular-nums" : "");

export interface GridProps {
  doctype: string;
  data: ReportViewData;
  groupBy: GroupBy | null;
  groupKey: string;
  orderBy?: string;
  currency?: string;
  dateFormat: string;
  onSort: (col: Col, dir: SortDir) => void;
  onMove: (col: Col, d: -1 | 1) => void;
  onRemove: (col: Col) => void;
  /** drill down: the rows of this group, ungrouped */
  onDrill: (value: unknown) => void;
}

function HeaderCell({ vc, doctype, sorted, grouped, p }: { vc: ViewCol; doctype: string; sorted: SortDir | null; grouped: boolean; p: GridProps }) {
  const { col, df } = vc;
  const label = df.label ?? col[0];
  return (
    <th scope="col" className={`group whitespace-nowrap border-b border-r border-zinc-200 px-2 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 ${NUMERIC.has(df.fieldtype) ? "text-right" : "text-left"}`} style={{ minWidth: 120 }} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
      <span className="inline-flex items-center gap-1">
        {col[1] !== doctype && <span className="text-zinc-400">{col[1]}:</span>}
        {label}
        {sorted === "asc" && <ArrowUp className="h-3 w-3" aria-hidden />}
        {sorted === "desc" && <ArrowDown className="h-3 w-3" aria-hidden />}
        {!grouped && (
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded p-0.5 opacity-0 hover:bg-zinc-200 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-700" aria-label={`${label} column menu`}>
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => p.onSort(col, "asc")}>Sort Ascending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onSort(col, "desc")}>Sort Descending</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => p.onMove(col, -1)}>Move Left</DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onMove(col, 1)}>Move Right</DropdownMenuItem>
              {col[0] !== "name" && <DropdownMenuItem onClick={() => p.onRemove(col)}>Remove Column</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    </th>
  );
}

/** the cell's display text, formatted like the list (Currency uses the row's currency field) */
function cellText(vc: ViewCol, v: unknown, r: Row, doctype: string, currency: string | undefined, dateFormat: string) {
  const { col, df, k } = vc;
  if (k === "docstatus") return DOCSTATUS[Number(v)] ?? "";
  const cur = df.fieldtype === "Currency" && typeof df.options === "string" ? (r[col[1] === doctype ? df.options : `${col[1]}:${df.options}`] as string | undefined) : undefined;
  return formatCell(v, { ...df, options: cur ?? (df.fieldtype === "Currency" ? "" : df.options) }, r, { currency: cur ?? currency, dateFormat });
}

function CellContent({ vc, v, text, r, p }: { vc: ViewCol; v: unknown; text: string; r: Row; p: GridProps }) {
  const { col, k } = vc;
  if (col[0] === "name" && col[1] === p.doctype && !p.groupBy) {
    return (
      <Link href={`${doctypeUrl(p.doctype)}/${enc(r.name)}`} className="whitespace-nowrap font-medium text-zinc-900 hover:underline dark:text-zinc-100">
        {String(v)}
      </Link>
    );
  }
  if (p.groupBy && k === p.groupKey) {
    return (
      <button type="button" className="hover:underline" onClick={() => p.onDrill(v)}>
        {text || "Not set"}
      </button>
    );
  }
  return (
    <span className="block truncate" title={text}>
      {text}
    </span>
  );
}

function Cell({ vc, r, i, editing, setEditing, p }: { vc: ViewCol; r: Row; i: number; editing: boolean; setEditing: (e: { i: number; k: string } | null) => void; p: GridProps }) {
  const { col, df, k } = vc;
  const v = p.data.cellValue(r, i, k);
  const editable = p.data.canEdit(r, col, df);
  const text = cellText(vc, v, r, p.doctype, p.currency, p.dateFormat);
  return (
    <td
      className={`max-w-xs border-b border-r border-zinc-100 px-2 py-1 dark:border-zinc-800 ${numCls(df.fieldtype)} ${editable ? "cursor-text" : ""} ${editing ? "p-0 ring-2 ring-inset ring-blue-500" : ""}`}
      onDoubleClick={() => editable && setEditing({ i, k })}
      onKeyDown={(e) => editable && !editing && e.key === "Enter" && setEditing({ i, k })}
      tabIndex={editable ? 0 : undefined}
      aria-label={editable ? `${df.label}: ${text || "empty"} (press Enter to edit)` : undefined}
    >
      {editing ? (
        <CellEditor
          df={df}
          value={v}
          onCommit={(nv) => {
            setEditing(null);
            void p.data.commit(r, i, col, nv);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <CellContent vc={vc} v={v} text={text} r={r} p={p} />
      )}
    </td>
  );
}

function TotalsRow({ totals, viewCols, currency, dateFormat }: { totals: Record<string, number>; viewCols: ViewCol[]; currency?: string; dateFormat: string }) {
  return (
    <tfoot className="sticky bottom-0 bg-zinc-50 font-semibold dark:bg-zinc-900">
      <tr>
        <td className="border-t border-zinc-200 dark:border-zinc-800" />
        {viewCols.map(({ df, k }, ci) => (
          <td key={k} className={`whitespace-nowrap border-t border-zinc-200 px-2 py-1.5 dark:border-zinc-800 ${numCls(df.fieldtype)}`}>
            {k in totals ? formatCell(totals[k], { ...df, options: "" }, {}, { currency, dateFormat }) : ci === 0 ? "Total" : ""}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}

export default function ReportGrid(p: GridProps) {
  const { doctype, data } = p;
  const { viewCols, rows, childDts } = data;
  const [editing, setEditing] = useState<{ i: number; k: string } | null>(null);
  const sortState = p.orderBy?.match(/`tab(.+?)`\.`(.+?)` (asc|desc)/i);
  const sortedOf = (col: Col) => (sortState && sortState[1] === col[1] && sortState[2] === col[0] ? (sortState[3].toLowerCase() as SortDir) : null);

  return (
    <div className="overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" style={{ maxHeight: "calc(100vh - 260px)" }}>
      <table className="w-full border-collapse text-sm" aria-label={`${doctype} report`}>
        <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="w-10 border-b border-r border-zinc-200 px-2 py-2 text-right text-xs font-medium text-zinc-400 dark:border-zinc-800">#</th>
            {viewCols.map((vc) => (
              <HeaderCell key={vc.k} vc={vc} doctype={doctype} sorted={sortedOf(vc.col)} grouped={!!p.groupBy} p={p} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.name}|${childDts.map((c) => r[`${c}:name`]).join("|")}|${i}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
              <td className="border-b border-r border-zinc-100 px-2 py-1 text-right text-xs tabular-nums text-zinc-400 dark:border-zinc-800">{i + 1}</td>
              {viewCols.map((vc) => (
                <Cell key={vc.k} vc={vc} r={r} i={i} editing={editing?.i === i && editing.k === vc.k} setEditing={setEditing} p={p} />
              ))}
            </tr>
          ))}
          {!rows.length && !data.loading && (
            <tr>
              <td colSpan={viewCols.length + 1} className="p-10 text-center text-sm text-zinc-500">
                Nothing to show
              </td>
            </tr>
          )}
        </tbody>
        {data.totals && <TotalsRow totals={data.totals} viewCols={viewCols} currency={p.currency} dateFormat={p.dateFormat} />}
      </table>
    </div>
  );
}
