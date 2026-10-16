"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { FieldControlProps } from "./index";

/**
 * Address Autocomplete field.
 * Uses the Google Places Autocomplete API when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 * Falls back to a plain text input if the API key is absent.
 *
 * The stored value is the raw address string.
 */

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type PlacePrediction = { description: string; place_id: string };

async function fetchPredictions(input: string): Promise<PlacePrediction[]> {
  if (!MAPS_API_KEY || input.length < 3) return [];
  try {
    // Proxy through BFF to avoid CORS
    const res = await fetch(`/api/frappe/maps-autocomplete?input=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.predictions ?? []) as PlacePrediction[];
  } catch {
    return [];
  }
}

export default function AddressField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" ? value : "";
  const [inputVal, setInputVal] = useState(str);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || !!field.read_only;

  const handleInput = useCallback(
    (v: string) => {
      setInputVal(v);
      onChange(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (MAPS_API_KEY) {
        debounceRef.current = setTimeout(async () => {
          const preds = await fetchPredictions(v);
          setSuggestions(preds);
          setOpen(preds.length > 0);
        }, 300);
      }
    },
    [onChange],
  );

  const select = useCallback(
    (desc: string) => {
      setInputVal(desc);
      onChange(desc);
      setSuggestions([]);
      setOpen(false);
    },
    [onChange],
  );

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
      <div className="relative flex items-center">
        <input
          type="text"
          id={inputId ?? field.fieldname}
          value={inputVal}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          disabled={isDisabled}
          placeholder="Start typing an address…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${field.fieldname}-address-listbox`}
          aria-autocomplete="list"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          className={[
            "w-full rounded-lg border pl-3 pr-9 py-2 text-sm transition-colors",
            error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
            isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
          ].join(" ")}
        />
        {/* Map pin icon */}
        <span className="pointer-events-none absolute right-3 text-zinc-400" aria-hidden="true">📍</span>
      </div>

      {!MAPS_API_KEY && (
        <p className="mt-1 text-xs text-zinc-400">
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> for address autocomplete
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={`${field.fieldname}-address-listbox`}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {suggestions.map((p) => (
            <li key={p.place_id} role="option" aria-selected={inputVal === p.description}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p.description)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              >
                <span className="mt-0.5 text-zinc-400" aria-hidden="true">📍</span>
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
