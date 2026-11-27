"use client";

/**
 * The list's filters pane on wide screens (docs/PHASE2_DESIGN.md § 3.8 "List at 1920"): Desk's sidebar group-by
 * counts (list_sidebar_group_by.js) shown open as checkable facets — Status first when the DocType has one, then the
 * user's quick filters, Assigned To, Created By and Tags. It writes the same filters as the filter bar.
 */
import { useState } from "react";
import { Check, PanelLeftClose } from "lucide-react";
import type { Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { toggleGroupFilter, useGroupByFields, useGroupCounts } from "./groupCounts";

const SHOW = 6;

function Facet({ doctype, fieldname, label, fieldtype, filters, setFilters, user }: { doctype: string; fieldname: string; label: string; fieldtype?: string; filters: Filter[]; setFilters: (f: Filter[]) => void; user: string }) {
  const [all, setAll] = useState(false);
  const { data, isLoading, isApplied } = useGroupCounts({ doctype, fieldname, fieldtype, filters, user, enabled: true });
  const items = data ?? [];
  if (!isLoading && !items.length) return null;
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <section aria-label={label} className="space-y-1">
      <h3 className="px-2 text-xs font-medium tracking-wide text-[var(--ink-muted)] uppercase">{label}</h3>
      {isLoading && <div className="mx-2 h-16 animate-pulse rounded-md bg-[var(--surface-sunken)]" />}
      <ul>
        {shown.map((i) => {
          const sel = isApplied(i.key);
          return (
            <li key={i.key || "__none"}>
              <button
                type="button"
                aria-pressed={sel}
                onClick={() => setFilters(toggleGroupFilter(doctype, filters, fieldname, i.key, sel))}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-[var(--surface-hover)] ${sel ? "bg-[var(--surface-selected)] font-medium text-[var(--ink-default)]" : "text-[var(--ink-default)]"}`}
              >
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${sel ? "border-[var(--focus-color)] bg-[var(--focus-color)] text-white" : "border-[var(--outline-strong)]"}`}>{sel && <Check className="h-2.5 w-2.5" aria-hidden="true" />}</span>
                <span className="min-w-0 flex-1 truncate">{i.label}</span>
                <span className="tabular text-xs text-[var(--ink-muted)]">{i.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {items.length > SHOW && (
        <button type="button" onClick={() => setAll((a) => !a)} className="px-2 text-xs text-[var(--ink-link)] hover:underline">
          {all ? "Show less" : `Show ${items.length - SHOW} more`}
        </button>
      )}
    </section>
  );
}

export function ListFacetsPane({ meta, filters, setFilters, user, onClose }: { meta: DocTypeMeta; filters: Filter[]; setFilters: (f: Filter[]) => void; user: string; onClose: () => void }) {
  const { fields, fieldtypeOf } = useGroupByFields(meta);
  const status = meta.fields?.find((f) => f.fieldname === "status" && f.fieldtype === "Select");
  const facets = [...(status ? [{ fieldname: "status", label: status.label ?? "Status" }] : []), ...fields.filter((f) => f.fieldname !== "status")];
  return (
    <aside data-pane="list-filters" aria-label="Filters" className="crema-fade space-y-4 self-start rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] p-2 lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto">
      <div className="flex items-center px-2 pt-1">
        <h2 className="text-sm font-semibold text-[var(--ink-default)]">Filters</h2>
        <button type="button" onClick={onClose} aria-label="Hide filters pane" className="ml-auto rounded p-1 text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]">
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {facets.map((f) => (
        <Facet key={f.fieldname} doctype={meta.name} fieldname={f.fieldname} label={f.label} fieldtype={fieldtypeOf(f.fieldname)} filters={filters} setFilters={setFilters} user={user} />
      ))}
    </aside>
  );
}
