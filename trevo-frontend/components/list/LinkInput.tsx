"use client";

/** Compact Link autocomplete (frappe.desk.search.search_link) for filters and small forms. */
import { useEffect, useRef, useState } from "react";
import { searchLink } from "@/lib/frappe/search";

export default function LinkInput({
  doctype,
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus,
  getQuery,
}: {
  doctype: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  getQuery?: () => { filters?: unknown; query?: string; params?: Record<string, unknown> } | undefined;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ value: string; description?: string; label?: string }>>([]);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        let opts;
        try {
          opts = getQuery?.();
        } catch {
          opts = undefined;
        }
        setResults((await searchLink(doctype, q, opts)).slice(0, 10));
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 150);
  };

  const pick = (v: string) => {
    setText(v);
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        value={text}
        autoFocus={autoFocus}
        placeholder={placeholder ?? doctype}
        onFocus={() => {
          setOpen(true);
          search(text);
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
          // typed text counts even without picking a suggestion
          if (text !== value) onChange(text);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          search(e.target.value);
          if (!e.target.value) onChange("");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(results[active]?.value ?? text);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((r, i) => (
            <li key={r.value}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r.value);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                <span className="block truncate text-zinc-900 dark:text-zinc-100">{r.label || r.value}</span>
                {r.description && <span className="block truncate text-xs text-zinc-500">{r.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
