"use client";

/**
 * "Add Multiple" for a child table (Desk: grid.set_multiple_add(link, qty) → frappe.ui.form.LinkSelector,
 * frappe/public/js/frappe/form/link_selector.js). Search the Link field's doctype with the grid's set_query
 * filters; picking a value asks for a quantity inline (Desk opens a second "Set Quantity" prompt) and either
 * updates the row that already has it or adds a row — so the row's events (ERPNext item_code → rate) run.
 * `single`: a Link field's "Advanced Search" (link.js open_advanced_search) — the same dialog; picking sets the
 * field and closes.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { searchLink } from "@/lib/frappe/search";

type Result = { value: string; description?: string; label?: string };

export default function AddMultipleDialog({
  doctype,
  qtyLabel,
  getQuery,
  onPick,
  onClose,
  single,
  initialTxt = "",
}: {
  doctype: string;
  /** pick one value and close (Advanced Search) */
  single?: boolean;
  /** Desk opens the selector with what was typed in the field */
  initialTxt?: string;
  /** set when the table has a quantity field: picking asks for it */
  qtyLabel?: string;
  getQuery: () => Record<string, unknown> | undefined;
  /** label: the result's title (search_link `label`), for title-link DocTypes */
  onPick: (value: string, qty?: number, label?: string) => Promise<void>;
  onClose: () => void;
}) {
  const PAGE = 10;
  const [txt, setTxt] = useState(initialTxt);
  const [results, setResults] = useState<Result[]>([]);
  const [length, setLength] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<{ value: string; qty: string } | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      let q: Record<string, unknown> | undefined;
      try {
        q = getQuery();
      } catch {
        q = undefined;
      }
      try {
        const r = await searchLink(doctype, txt, { ...(q ?? {}), page_length: length });
        if (live) setResults(r);
      } catch {
        if (live) setResults([]);
      } finally {
        if (live) setLoading(false);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // getQuery is read fresh on each search; re-running on its identity would search on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctype, txt, length]);

  // select the quantity once when a value is picked (not on every keystroke, which would replace each digit)
  const pickedValue = picked?.value;
  useEffect(() => {
    if (pickedValue) qtyRef.current?.select();
  }, [pickedValue]);

  const add = async (value: string, qty?: number) => {
    setBusy(true);
    try {
      await onPick(value, qty);
      setAdded((a) => [...a, qty === undefined ? value : `${value} (${qty})`]);
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };
  const choose = (value: string) => {
    if (single) {
      void onPick(value, undefined, results.find((r) => r.value === value)?.label).then(onClose);
      return;
    }
    if (qtyLabel) setPicked({ value, qty: "1" });
    else void add(value);
  };
  const confirmQty = () => {
    if (!picked) return;
    const n = Number(picked.qty);
    if (!Number.isFinite(n) || picked.qty.trim() === "") return;
    void add(picked.value, n);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select {doctype}</DialogTitle>
          <DialogDescription>
            {single ? `Search ${doctype} and pick one.` : qtyLabel ? `Pick a ${doctype}, enter the ${qtyLabel.toLowerCase()}, press Enter. Repeat for more.` : `Pick each ${doctype} to add a row.`}
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          aria-label="Beginning with"
          placeholder="Beginning with…"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value);
            setLength(PAGE);
          }}
          onKeyDown={(e) => e.key === "Enter" && results[0] && choose(results[0].value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <ul aria-label={`${doctype} results`} className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {results.map((r) => (
            <li key={r.value} className="px-3 py-2">
              {picked?.value === r.value ? (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.value}</span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    {qtyLabel}
                    <input
                      ref={qtyRef}
                      inputMode="decimal"
                      aria-label={qtyLabel}
                      value={picked.qty}
                      onChange={(e) => setPicked({ value: r.value, qty: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmQty();
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setPicked(null);
                        }
                      }}
                      className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </label>
                  <button type="button" disabled={busy} onClick={confirmQty} className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
                  </button>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => choose(r.value)} className="flex w-full items-baseline gap-3 text-left">
                  {/* a title-link DocType leads with its title; the name follows once */}
                  <span className="shrink-0 text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100">{r.label || r.value}</span>
                  {(() => {
                    const rest = [r.label && r.label !== r.value ? r.value : "", ...(r.description ?? "").split(", ")].filter((x, k, all) => x && x !== (r.label || r.value) && all.indexOf(x) === k);
                    return rest.length > 0 && <span className="min-w-0 truncate text-xs text-zinc-500">{rest.join(", ")}</span>;
                  })()}
                </button>
              )}
            </li>
          ))}
          {!loading && results.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-400">No results</li>}
          {loading && results.length === 0 && <li className="px-3 py-6 text-center text-sm text-zinc-400">Searching…</li>}
        </ul>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {results.length >= length && (
            <button type="button" onClick={() => setLength((l) => l + PAGE)} className="rounded-md border border-zinc-200 px-2.5 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              More
            </button>
          )}
          {added.length > 0 && <span aria-live="polite" className="min-w-0 truncate">Added: {added.join(", ")}</span>}
          <button type="button" onClick={onClose} className={`ml-auto ${single ? "hidden" : ""} rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900`}>
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
