"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { FieldControlProps } from "./index";
import { searchLink } from "@/lib/frappe/search";
import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";

/**
 * Link field with autocomplete search + Quick Add button.
 *
 * Shows a "+" button next to the input when:
 *   1. The field has a linked DocType (field.options)
 *   2. The field is not read-only / disabled
 *   3. The DocType meta marks quick_entry = 1 (checked at runtime)
 *
 * Quick Add opens QuickEntryDialog for the linked DocType. On creation,
 * it auto-fills this link field with the new document name.
 */

// Lazy-load QuickEntryDialog — not needed on every form render
const QuickEntryDialog = dynamic(
  () =>
    import("@/components/features/quick-entry/QuickEntryDialog").then(
      (m) => m.QuickEntryDialog,
    ),
  { ssr: false },
);

export default function LinkField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const [query, setQuery] = useState(typeof value === "string" ? value : "");
  const [results, setResults] = useState<Array<{ value: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Link preview — fetch the linked document's title/modified on hover
  const currentValue = typeof value === "string" ? value : "";
  const linkedDoctype = field.options || "";
  const { data: previewData } = useQuery<Record<string, unknown> | null>({
    queryKey: ["link-preview", linkedDoctype, currentValue],
    queryFn: async () => {
      const result = await frappeMethod<Record<string, unknown>>("frappe.client.get_value", {
        doctype: linkedDoctype,
        fieldname: ["name", "modified"],
        filters: { name: currentValue },
      });
      return result ?? null;
    },
    enabled: !!linkedDoctype && !!currentValue && previewVisible,
    staleTime: 60_000,
  });

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => setPreviewVisible(true), 300);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setPreviewVisible(false);
  };
  const isDisabled = disabled || !!field.read_only;

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchLink(linkedDoctype, q, undefined);
        setResults(data.map((r) => ({ value: r.value, description: r.description || r.value })));
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [linkedDoctype],
  );

  const handleChange = (val: string) => {
    setQuery(val);
    onChange(val || null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 200);
  };

  const selectResult = (item: { value: string; description: string }) => {
    setQuery(item.value);
    onChange(item.value);
    setShowDropdown(false);
    inputRef.current?.blur();
  };

  const handleQuickCreated = (name: string) => {
    setQuery(name);
    onChange(name);
    setQuickEntryOpen(false);
  };

  return (
    <div className="relative flex gap-1.5" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Search input */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          id={field.fieldname}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query.length >= 1 && doSearch(query)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          disabled={isDisabled}
          placeholder={String(field.placeholder ?? `Search ${linkedDoctype || ""}...`)}
          autoComplete="off"
          role="combobox"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          aria-haspopup="listbox"
          aria-expanded={showDropdown}
          aria-controls={`${field.fieldname}-listbox`}
          className={[
            "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
            error
              ? "border-red-500 focus:ring-red-500/20"
              : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
            "focus:outline-none focus:ring-2",
            isDisabled && "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed",
          ].join(" ")}
        />

        {/* Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          </div>
        )}

        {/* Search results dropdown */}
        {showDropdown && results.length > 0 && (
          <ul
            role="listbox"
            id={`${field.fieldname}-listbox`}
            aria-label={`${linkedDoctype} search results`}
            className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          >
            {results.map((item, i) => (
              <li key={i} role="option" aria-selected={query === item.value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectResult(item)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.value}</span>
                  {item.description !== item.value && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{item.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick Add "+" button — only shown when field has a linked doctype and is editable */}
      {!isDisabled && linkedDoctype && (
        <button
          type="button"
          onClick={() => setQuickEntryOpen(true)}
          aria-label={`Quick add new ${linkedDoctype}`}
          title={`Quick add new ${linkedDoctype}`}
          className="flex-shrink-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          +
        </button>
      )}

      {/* Link Preview tooltip */}
      {previewVisible && currentValue && previewData && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 min-w-[180px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
          role="tooltip"
          aria-label={`Preview: ${currentValue}`}
        >
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{currentValue}</p>
          {typeof previewData.modified === "string" && (
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Modified: {new Date(previewData.modified).toLocaleDateString()}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-zinc-400">{linkedDoctype}</p>
        </div>
      )}

      {/* Quick Entry Dialog — lazy loaded */}
      {quickEntryOpen && linkedDoctype && (
        <QuickEntryDialog
          open={quickEntryOpen}
          onOpenChange={setQuickEntryOpen}
          doctype={linkedDoctype}
          onCreated={handleQuickCreated}
        />
      )}
    </div>
  );
}
