"use client";

import { useCallback, useRef, useState } from "react";
import type { FieldControlProps } from "./index";
import { searchLink } from "@/lib/frappe/search";

export default function DynamicLinkField({ field, inputId, value, onChange, disabled, ...props }: FieldControlProps & { parentValues?: Record<string, unknown> }) {
  const [query, setQuery] = useState(typeof value === "string" ? value : "");
  const [results, setResults] = useState<Array<{ value: string; description: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const targetDoctype = typeof props.parentValues?.[field.options as string] === "string" ? String(props.parentValues[field.options as string]) : "";

  const doSearch = useCallback(async (q: string) => {
    if (!targetDoctype || q.length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const data = await searchLink(targetDoctype, q, undefined);
      setResults(data.map((r) => ({ value: r.value, description: r.description || r.value })));
      setShowDropdown(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [targetDoctype]);

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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={inputId ?? field.fieldname}
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => query.length >= 1 && doSearch(query)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        disabled={disabled || !!field.read_only || !targetDoctype}
        placeholder={String(field.placeholder ?? `Search ${targetDoctype || "..."}...`)}
        autoComplete="off"
        className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${!targetDoctype ? "bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed opacity-60" : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"} border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500 focus:outline-none focus:ring-2`}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {results.map((item, i) => (
            <button
              key={i}
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
          ))}
        </div>
      )}
    </div>
  );
}
