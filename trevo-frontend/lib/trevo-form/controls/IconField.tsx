"use client";

import { useState, useRef, useEffect } from "react";
import type { FieldControlProps } from "./index";

/**
 * Icon field — maps to Frappe fieldtype "Icon".
 * Shows a popover grid of common Frappe/Lucide icon names.
 * Stores the icon name as a plain string.
 */

// A representative subset of icons available in Frappe / standard icon libraries
const ICON_NAMES = [
  "home","user","users","settings","search","star","heart","bell","mail","phone",
  "calendar","clock","file","folder","image","camera","video","music","map","globe",
  "lock","unlock","key","shield","check","x","plus","minus","arrow-right","arrow-left",
  "arrow-up","arrow-down","edit","trash","copy","clipboard","share","download","upload",
  "cloud","database","code","terminal","cpu","monitor","smartphone","tablet","wifi",
  "bluetooth","battery","power","zap","sun","moon","eye","eye-off","bookmark","flag",
  "tag","hash","at-sign","link","paperclip","send","inbox","archive","filter","list",
  "grid","layout","sidebar","bar-chart","pie-chart","trending-up","trending-down",
  "activity","alert-circle","info","help-circle","check-circle","x-circle",
];

export default function IconField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const current = typeof value === "string" ? value : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? ICON_NAMES.filter((n) => n.includes(query.toLowerCase()))
    : ICON_NAMES;

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={field.fieldname}
        disabled={disabled || !!field.read_only}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${field.label || field.fieldname}: ${current || "none selected"}`}
        className={[
          "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors text-left",
          error
            ? "border-red-500 focus:ring-red-500/20"
            : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
          (disabled || !!field.read_only) && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          {current ? (
            <>
              <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{current}</span>
              <span className="text-zinc-500">{current}</span>
            </>
          ) : (
            <span className="text-zinc-400">Select icon…</span>
          )}
        </span>
        <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700">
            <input
              type="text"
              placeholder="Search icons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm focus:outline-none dark:border-zinc-600 dark:text-zinc-100"
              autoFocus
              aria-label="Search icons"
            />
          </div>
          <div
            role="listbox"
            aria-label="Icon options"
            className="grid max-h-52 grid-cols-6 overflow-y-auto p-2 gap-1"
          >
            {/* Clear option */}
            <button
              role="option"
              aria-selected={current === ""}
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
              className="col-span-6 rounded px-2 py-1 text-left text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              — Clear
            </button>
            {filtered.map((name) => (
              <button
                role="option"
                aria-selected={current === name}
                key={name}
                type="button"
                title={name}
                onClick={() => { onChange(name); setOpen(false); setQuery(""); }}
                className={[
                  "flex flex-col items-center justify-center rounded p-1.5 text-center text-xs transition-colors",
                  current === name
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300",
                ].join(" ")}
              >
                <span className="font-mono text-[10px] leading-tight break-all">{name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 py-3 text-center text-xs text-zinc-400">No icons found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
