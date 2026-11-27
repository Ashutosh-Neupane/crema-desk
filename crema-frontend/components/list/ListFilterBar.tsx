"use client";

/**
 * The list's filter row (list_view.js + ui/filters/filter_area.js): ID / title search, inline standard filters,
 * the filter editor, group-by counts, sidebar stats and sort; then the removable filter chips.
 */
import { useState } from "react";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Filter as FilterIcon,
  Layers,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import type { Filter } from "@/lib/list/api";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import LinkInput from "@/components/list/LinkInput";
import FilterEditor from "@/components/list/FilterEditor";
import GroupBy from "@/components/list/GroupBy";
import ListSidebar from "@/components/list/ListSidebar";
import DatePicker from "@/components/form/DatePicker";
import { OPERATORS, describeValue, fieldLabel } from "@/components/list/filterModel";
import { sortableFields, type Sort } from "@/components/list/listModel";

const controlCls =
  "h-8 rounded-md border border-zinc-200 bg-white text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
const triggerCls =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

/** one in_standard_filter field shown inline (an equality filter) */
function StandardFilter({
  f,
  value,
  onChange,
}: {
  f: DocField;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = f.label ?? f.fieldname;
  if (f.fieldtype === "Link")
    return (
      <LinkInput
        doctype={String(f.options)}
        value={value}
        onChange={onChange}
        placeholder={label}
        className="w-40"
      />
    );
  if (f.fieldtype === "Select")
    return (
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-40 px-2 ${controlCls}`}
      >
        <option value="">{f.label}</option>
        {String(f.options ?? "")
          .split("\n")
          .filter(Boolean)
          .map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
      </select>
    );
  if (f.fieldtype === "Check")
    return (
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-36 px-2 ${controlCls}`}
      >
        <option value="">{f.label}</option>
        <option value="1">Yes</option>
        <option value="0">No</option>
      </select>
    );
  if (f.fieldtype === "Date")
    return (
      <div className="w-40">
        <DatePicker
          compact
          value={value || null}
          onChange={(v) => onChange(v ?? "")}
          ariaLabel={label}
        />
      </div>
    );
  return (
    <input
      type="text"
      defaultValue={value}
      title={label}
      aria-label={label}
      onBlur={(e) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onChange((e.target as HTMLInputElement).value)}
      placeholder={label}
      className="h-8 w-40 rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}

function SortControl({
  meta,
  sort,
  setSort,
}: {
  meta: DocTypeMeta;
  sort: Sort;
  setSort: (s: Sort) => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-1">
      <select
        value={sort.field}
        onChange={(e) => setSort({ field: e.target.value, order: sort.order })}
        aria-label="Sort by"
        className={`px-2 ${controlCls}`}
      >
        {sortableFields(meta).map((s) => (
          <option key={s.fieldname} value={s.fieldname}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setSort({ field: sort.field, order: sort.order === "asc" ? "desc" : "asc" })}
        aria-label={sort.order === "asc" ? "Ascending" : "Descending"}
        className="rounded-md border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {sort.order === "asc" ? (
          <ArrowUpNarrowWide className="h-4 w-4" />
        ) : (
          <ArrowDownNarrowWide className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export function ListFilterBar({
  doctype,
  meta,
  user,
  phone,
  standardFilters,
  showSidebar,
  search,
  setSearch,
  subjectLabel,
  filters,
  allFilters,
  setFilters,
  addFilter,
  sort,
  setSort,
}: {
  doctype: string;
  meta: DocTypeMeta;
  user: string;
  phone: boolean;
  standardFilters: DocField[];
  showSidebar: boolean;
  search: string;
  setSearch: (v: string) => void;
  subjectLabel: string;
  filters: Filter[];
  allFilters: Filter[];
  setFilters: (f: Filter[]) => void;
  addFilter: (f: Filter) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
}) {
  // phones: standard filters, Group by and sidebar stats fold behind "More filters"
  const [moreFilters, setMoreFilters] = useState(false);
  const expanded = !phone || moreFilters;
  const setStandard = (fieldname: string, v: string) =>
    setFilters(
      v
        ? [...filters.filter((x) => x[1] !== fieldname), [doctype, fieldname, "=", v]]
        : filters.filter((x) => x[1] !== fieldname)
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${subjectLabel}`}
          className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      {phone && (standardFilters.length > 0 || showSidebar) && (
        <button
          type="button"
          onClick={() => setMoreFilters((v) => !v)}
          aria-expanded={moreFilters}
          className={triggerCls}
        >
          <ListFilter className="h-3.5 w-3.5" /> {moreFilters ? "Fewer filters" : "More filters"}
        </button>
      )}
      {expanded &&
        standardFilters.map((f) => {
          const current = filters.find((x) => x[1] === f.fieldname && x[2] === "=");
          return (
            <StandardFilter
              key={f.fieldname}
              f={f}
              value={current ? String(current[3]) : ""}
              onChange={(v) => setStandard(f.fieldname, v)}
            />
          );
        })}

      <Popover>
        <PopoverTrigger className={triggerCls}>
          <FilterIcon className="h-3.5 w-3.5" /> Filter
          {filters.length > 0 && (
            <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              {filters.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <FilterEditor meta={meta} onAdd={addFilter} />
        </PopoverContent>
      </Popover>

      {expanded && (
        <Popover>
          <PopoverTrigger className={triggerCls}>
            <Layers className="h-3.5 w-3.5" /> Group by
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <GroupBy meta={meta} filters={allFilters} onPick={addFilter} />
          </PopoverContent>
        </Popover>
      )}

      {expanded && showSidebar && (
        <ListSidebar meta={meta} filters={filters} setFilters={setFilters} user={user} />
      )}

      <SortControl meta={meta} sort={sort} setSort={setSort} />
    </div>
  );
}

export function ActiveFilters({
  meta,
  filters,
  setFilters,
}: {
  meta: DocTypeMeta;
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f, i) => (
        <span
          key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
        >
          <ListFilter className="h-3 w-3 text-zinc-400" />
          <span className="font-medium">{fieldLabel(meta, f[1])}</span>
          <span className="text-zinc-400">
            {OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}
          </span>
          <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
          <button
            type="button"
            onClick={() => setFilters(filters.filter((_, j) => j !== i))}
            aria-label={`Remove ${fieldLabel(meta, f[1])} filter`}
            className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => setFilters([])}
        className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        Clear all
      </button>
    </div>
  );
}
