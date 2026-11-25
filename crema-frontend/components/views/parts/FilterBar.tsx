"use client";

/**
 * Filter button + removable filter pills shared by the Calendar, Gantt, Kanban and Image views
 * (Desk: frappe/public/js/frappe/ui/filters/filter_list.js). Adding a filter replaces one on the same
 * field and operator, like the list view.
 */
import type { Dispatch, SetStateAction } from "react";
import { Filter as FilterIcon, ListFilter, X } from "lucide-react";
import type { Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { FilterEditor, OPERATORS, describeValue, fieldLabel } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

interface FilterProps {
  meta: DocTypeMeta;
  filters: Filter[];
  setFilters: Dispatch<SetStateAction<Filter[]>>;
}

const filterKey = (f: Filter) => `${f[1]}|${f[2]}|${JSON.stringify(f[3])}`;

export function FilterButton({ meta, filters, setFilters, className }: FilterProps & { className: string }) {
  return (
    <Popover>
      <PopoverTrigger className={className}>
        <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
        {filters.length > 0 && (
          <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {filters.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <FilterEditor
          meta={meta}
          onAdd={(f) => setFilters((fs) => [...fs.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f])}
        />
      </PopoverContent>
    </Popover>
  );
}

export function FilterPills({ meta, filters, setFilters }: FilterProps) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => {
        const key = filterKey(f);
        const label = fieldLabel(meta, f[1]);
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
            <span className="font-medium">{label}</span>
            <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
            <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
            <button
              type="button"
              onClick={() => setFilters((fs) => fs.filter((x) => filterKey(x) !== key))}
              aria-label={`Remove ${label} filter`}
              className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        );
      })}
    </div>
  );
}
