"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FieldControlProps } from "./index";

/**
 * Autocomplete field — maps to Frappe fieldtype "Autocomplete".
 * Free-text input with a filterable dropdown from field.options (newline-separated).
 * Allows values not in the list (unlike Select which enforces the list).
 */
export default function AutocompleteField({ field, value, onChange, disabled, error }: FieldControlProps) {
  const options = String(field.options ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const str = typeof value === "string" ? value : "";
  const [inputVal, setInputVal] = useState(str);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || !!field.read_only;

  const filtered = inputVal
    ? options.filter((o) => o.toLowerCase().includes(inputVal.toLowerCase()))
    : options;

  const handleInput = useCallback(
    (v: string) => {
      setInputVal(v);
      onChange(v);
      setOpen(true);
    },
    [onChange],
  );

  const select = useCallback(
    (opt: string) => {
      setInputVal(opt);
      onChange(opt);
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside click
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
      <input
        type="text"
        id={field.fieldname}
        value={inputVal}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => options.length > 0 && setOpen(true)}
        disabled={isDisabled}
        placeholder={String(field.placeholder ?? "Type or select…")}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${field.fieldname}-autocomplete-listbox`}
        aria-autocomplete="list"
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        className={[
          "w-full rounded-lg border px-3 py-2 text-sm transition-colors",
          error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
          isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
        ].join(" ")}
      />

      {open && filtered.length > 0 && (
        <ul
          id={`${field.fieldname}-autocomplete-listbox`}
          role="listbox"
          aria-label={`${field.label || field.fieldname} suggestions`}
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {filtered.map((opt) => (
            <li key={opt} role="option" aria-selected={inputVal === opt}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(opt)}
                className={[
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  inputVal === opt
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100",
                ].join(" ")}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
