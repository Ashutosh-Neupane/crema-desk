"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FieldControlProps } from "./index";

/**
 * MultiSelect Pills field — maps to Frappe fieldtype "MultiSelect".
 * Selected values are shown as dismissible pill badges.
 * Click the input area to open a dropdown of available options.
 * Stored as newline-separated or comma-separated string.
 */
export default function MultiselectPillsField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const options = String(field.options ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Parse current value: supports both "\n" and "," separators
  const parseValue = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    const str = String(v);
    if (str.includes("\n")) return str.split("\n").map((s) => s.trim()).filter(Boolean);
    return str.split(",").map((s) => s.trim()).filter(Boolean);
  };

  const [selected, setSelected] = useState<string[]>(() => parseValue(value));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || !!field.read_only;

  const emit = useCallback(
    (vals: string[]) => {
      setSelected(vals);
      onChange(vals.join("\n"));
    },
    [onChange],
  );

  const add = useCallback(
    (opt: string) => {
      if (!selected.includes(opt)) emit([...selected, opt]);
      setQuery("");
    },
    [selected, emit],
  );

  const remove = useCallback(
    (opt: string) => emit(selected.filter((s) => s !== opt)),
    [selected, emit],
  );

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o))
    : options.filter((o) => !selected.includes(o));

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        role="group"
        tabIndex={isDisabled ? -1 : 0}
        aria-label={field.label || field.fieldname}
        onClick={() => !isDisabled && setOpen(true)}
        onKeyDown={(e) => {
          if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={[
          "min-h-[2.5rem] flex flex-wrap gap-1.5 items-center rounded-lg border px-3 py-2 cursor-text",
          error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700",
          "bg-white dark:bg-zinc-900",
          isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
          open && !error && "ring-2 ring-zinc-900/20 border-zinc-900 dark:border-zinc-500",
        ].join(" ")}
      >
        {/* Selected pills */}
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {s}
            {!isDisabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); remove(s); }}
                aria-label={`Remove ${s}`}
                className="ml-0.5 rounded-full text-blue-500 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 focus:outline-none"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Input */}
        {!isDisabled && (
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length === 0 ? "Select options…" : ""}
            aria-label="Add option"
            className="flex-1 min-w-[6rem] bg-transparent text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
          />
        )}
      </div>

      {open && !isDisabled && (
        <ul
          role="listbox"
          aria-label={`${field.label || field.fieldname} options`}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <li key={opt} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(opt)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                >
                  {opt}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-zinc-400 italic">
              {options.length === 0 ? "No options configured" : "All options selected"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
