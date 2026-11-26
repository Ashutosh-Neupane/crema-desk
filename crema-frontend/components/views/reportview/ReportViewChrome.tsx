"use client";

/** Report view header, toolbar, filter pills, page sizes and Save As dialog (Desk: report_view.js setup_menu / setup_sort_selector). */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Columns3, Download, Filter as FilterIcon, Layers, ListFilter, MoreHorizontal, RefreshCw, Save, Sigma, X } from "lucide-react";
import type { Filter } from "@/lib/list/api";
import { FilterEditor, OPERATORS, describeValue, fieldLabel } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import type { DocTypeMeta } from "@/lib/frappe/types";
import type { GroupBy } from "@/lib/report/groupBy";
import GroupByEditor from "./GroupByEditor";
import { btn, primaryBtn } from "./shared";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

export function ReportViewHeader({
  doctype,
  meta,
  reportName,
  canSaveInPlace,
  fetching,
  totalsOn,
  onRefresh,
  onSave,
  onSaveAs,
  onPickColumns,
  onToggleTotals,
  onExport,
}: {
  doctype: string;
  meta: DocTypeMeta;
  reportName?: string;
  canSaveInPlace: boolean;
  fetching: boolean;
  totalsOn: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPickColumns: () => void;
  onToggleTotals: () => void;
  onExport: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-zinc-500">
          <Link href={`${doctypeUrl(doctype)}`} className="hover:underline">
            {doctype}
          </Link>
          {" / Report"}
        </div>
        <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{reportName ?? `${doctype} Report`}</h1>
      </div>
      <nav aria-label="Views" className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
        <Link href={`${doctypeUrl(doctype)}${meta.is_tree ? "?view=list" : ""}`} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
          List
        </Link>
        <span aria-current="page" className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
          Report
        </span>
      </nav>
      <button type="button" className={btn} onClick={onRefresh} aria-label="Refresh">
        <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} aria-hidden />
      </button>
      <button type="button" className={primaryBtn} onClick={canSaveInPlace ? onSave : onSaveAs}>
        <Save className="h-3.5 w-3.5" aria-hidden /> {canSaveInPlace ? "Save" : "Save As"}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className={btn} aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onPickColumns}>Pick Columns</DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleTotals}>{totalsOn ? "Hide Totals" : "Show Totals"}</DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="mr-2 h-3.5 w-3.5" aria-hidden /> Export CSV
          </DropdownMenuItem>
          {reportName && <DropdownMenuItem onClick={onSaveAs}>Save As…</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`${doctypeUrl(doctype)}/new`)}>New {doctype}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ReportViewToolbar({
  meta,
  childMetas,
  filters,
  groupBy,
  groupLabel,
  totalsOn,
  countText,
  onAddFilter,
  onGroupBy,
  onPickColumns,
  onToggleTotals,
}: {
  meta: DocTypeMeta;
  childMetas: DocTypeMeta[];
  filters: Filter[];
  groupBy: GroupBy | null;
  groupLabel?: string;
  totalsOn: boolean;
  countText: string;
  onAddFilter: (f: Filter) => void;
  onGroupBy: (g: GroupBy | null) => void;
  onPickColumns: () => void;
  onToggleTotals: () => void;
}) {
  const [groupOpen, setGroupOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger className={btn}>
          <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
          {filters.length > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{filters.length}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <FilterEditor meta={meta} onAdd={onAddFilter} />
        </PopoverContent>
      </Popover>
      <Popover open={groupOpen} onOpenChange={setGroupOpen}>
        <PopoverTrigger className={btn}>
          <Layers className="h-3.5 w-3.5" aria-hidden />{" "}
          {groupBy ? (
            <>
              Grouped by <b>{groupLabel ?? groupBy.field}</b>
            </>
          ) : (
            "Add Group"
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <GroupByEditor meta={meta} childMetas={childMetas} value={groupBy} onChange={onGroupBy} />
        </PopoverContent>
      </Popover>
      <button type="button" className={btn} onClick={onPickColumns}>
        <Columns3 className="h-3.5 w-3.5" aria-hidden /> Columns
      </button>
      <button type="button" className={btn} aria-pressed={totalsOn} onClick={onToggleTotals}>
        <Sigma className="h-3.5 w-3.5" aria-hidden /> Totals
      </button>
      <span className="ml-auto text-xs text-zinc-500">{countText}</span>
    </div>
  );
}

const filterKey = (f: Filter) => `${f[1]}|${f[2]}|${JSON.stringify(f[3])}`;

export function ReportFilterPills({ meta, filters, metaOf, onChange }: { meta: DocTypeMeta; filters: Filter[]; metaOf: (dt: string) => DocTypeMeta | undefined; onChange: (filters: Filter[]) => void }) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => {
        const k = filterKey(f);
        return (
          <span key={k} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
            <span className="font-medium">{fieldLabel(metaOf(f[0]) ?? meta, f[1])}</span>
            <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
            <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
            <button type="button" onClick={() => onChange(filters.filter((x) => filterKey(x) !== k))} aria-label={`Remove ${fieldLabel(meta, f[1])} filter`} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={() => onChange([])} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        Clear all
      </button>
    </div>
  );
}

export function PageSizes({ pageLength, canLoadMore, onChange }: { pageLength?: number; canLoadMore: boolean; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {[20, 100, 500].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={pageLength === n} className={`rounded-md border px-2.5 py-1 ${pageLength === n ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}>
          {n}
        </button>
      ))}
      {canLoadMore && (
        <button type="button" className="ml-2 text-zinc-600 hover:underline dark:text-zinc-300" onClick={() => onChange((pageLength ?? 20) + 20)}>
          Load more
        </button>
      )}
    </div>
  );
}

export function SaveAsDialog({ value, onChange, onSave }: { value: string | null; onChange: (v: string | null) => void; onSave: (name: string) => void }) {
  return (
    <Dialog open={value !== null} onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save As</DialogTitle>
          <DialogDescription>Saves these columns, filters, sort and grouping as a Report Builder report.</DialogDescription>
        </DialogHeader>
        <label htmlFor="report-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Report Name
        </label>
        <input
          id="report-name"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && value?.trim() && onSave(value.trim())}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <DialogFooter>
          <button type="button" className={btn} onClick={() => onChange(null)}>
            Cancel
          </button>
          <button type="button" disabled={!value?.trim()} onClick={() => value && onSave(value.trim())} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            Save
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
