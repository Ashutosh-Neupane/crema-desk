"use client";

/**
 * Link control, Desk-style (frappe/public/js/frappe/form/controls/link.js):
 *  - value commits on select / Enter / blur (not per keystroke), so fetch_from
 *    and script events fire once; re-syncs when a script sets the value
 *  - suggestions on focus (search_link with the field's set_query filters)
 *  - "Filtered by: …" (set_query / link_filters in words), "+ Create a new <DocType>" (only with create permission,
 *    not for only_select fields) → quick entry (or full form), "Advanced Search" → the link selector dialog
 *  - link_filters (Customize Form → Filters) applied to the search (apply_link_field_filters)
 *  - DocTypes with "Show Title in Link Fields" (boot.link_title_doctypes) show the title, store the name
 *    (set_link_title / title_value_map, frappe.desk.search.get_link_title)
 *  - arrow to open the linked document
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FieldControlProps } from "./index";
import { searchLink } from "@/lib/frappe/search";
import { frappeMethod } from "@/lib/frappe/client";
import { applyLinkFilters, describeFilters } from "@/lib/frappe/filterDescription";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import QuickEntry, { canQuickEntry } from "@/components/form/QuickEntry";
import AddMultipleDialog from "@/components/form/AddMultipleDialog";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

function safeQuery(getQuery: FieldControlProps["getQuery"]) {
  try {
    return getQuery?.() ?? undefined;
  } catch {
    return undefined;
  }
}

/** the "Filtered by: …" line; mounted only while the list is open (it loads the linked DocType's labels) */
function FilterNote({ doctype, filters, text }: { doctype: string; filters: unknown; text?: string }) {
  const { data: meta } = useDoctype(text ? "" : doctype);
  const note = text || describeFilters(doctype, filters, meta);
  if (!note) return null;
  return <li role="note" className="border-t border-zinc-100 px-3 py-1.5 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800">{note}</li>;
}

function CreateLinked({ doctype, initial, onDone, onClose }: { doctype: string; initial: string; onDone: (name: string) => void; onClose: () => void }) {
  const { data: meta } = useDoctype(doctype);
  const opened = useRef(false);
  useEffect(() => {
    // no quick entry for this DocType → full form in a new tab (Desk routes away; a tab keeps this form)
    if (meta && !canQuickEntry(meta) && !opened.current) {
      opened.current = true;
      window.open(`${doctypeUrl(doctype)}/new`, "_blank");
      onClose();
    }
  }, [meta, doctype, onClose]);
  if (!meta || !canQuickEntry(meta)) return null;
  const titleField = typeof meta.title_field === "string" && meta.title_field ? meta.title_field : null;
  const nameish = titleField ?? (meta.fields ?? []).find((f) => f.reqd && f.fieldtype === "Data")?.fieldname;
  return (
    <QuickEntry
      meta={meta}
      initial={initial && nameish ? { [nameish]: initial } : undefined}
      onClose={onClose}
      onCreated={(name) => onDone(name)}
    />
  );
}

export default function LinkField({ field, inputId, value, onChange, disabled, error, getQuery, compact, doc, exclude, clearOnPick }: FieldControlProps) {
  const current = typeof value === "string" ? value : value == null ? "" : String(value);
  const doctype = String(field.options ?? "");
  const qc = useQueryClient();
  const { data: ctx } = useDeskContext();
  const isTitleLink = ((ctx?.boot?.link_title_doctypes as string[] | undefined) ?? []).includes(doctype);
  const { data: title } = useQuery({
    queryKey: ["link-title", doctype, current],
    queryFn: () => frappeMethod<string>("frappe.desk.search.get_link_title", { doctype, docname: current }).catch(() => current),
    enabled: isTitleLink && !!current,
    staleTime: 5 * 60 * 1000,
  });
  // what the box shows for the stored value: the title for title-link DocTypes, else the name
  const display = isTitleLink && current ? title || current : current;
  const [text, setText] = useState(display);
  const [prev, setPrev] = useState(display);
  if (prev !== display) {
    setPrev(display);
    setText(display);
  }
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Array<{ value: string; description?: string; label?: string }>>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pos = useAnchoredPosition(anchorRef, listRef, open, { matchWidth: true });
  const isDisabled = disabled || !!field.read_only;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // set_query plus the field's link_filters (Desk set_custom_query)
  const query = () => {
    const q = safeQuery(getQuery);
    const filters = applyLinkFilters(doctype, q?.filters, field.link_filters, doc);
    return filters ? { ...q, filters } : q;
  };
  const search = (q: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchLink(doctype, q, { ...query(), page_length: 10 });
        setResults(exclude?.length ? found.filter((r) => !exclude.includes(r.value)) : found);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setActive(-1);
      }
    }, 150);
  };

  const commit = (v: string, label?: string) => {
    if (isTitleLink && v && label) qc.setQueryData(["link-title", doctype, v], label);
    setText(clearOnPick ? "" : isTitleLink && v && label ? label : v);
    setOpen(false);
    if (v !== current) onChange(v || null);
  };
  // typed text → value: unchanged title keeps the value; a title from the results maps to its name (title_value_map)
  const commitTyped = (t: string) => {
    if (t === display) return commit(current);
    const hit = isTitleLink ? results.find((r) => r.label === t) : undefined;
    commit(hit ? hit.value : t, hit?.label);
  };
  const onlySelect = !!field.only_select;
  const canCreate = !onlySelect && (ctx?.perms?.can_create ?? []).includes(doctype);
  const extras: Array<{ key: string; label: string; icon: typeof Plus; run: () => void }> = onlySelect
    ? []
    : [
        ...(canCreate ? [{ key: "create", label: `Create a new ${doctype}`, icon: Plus, run: () => setCreating(true) }] : []),
        { key: "advanced", label: "Advanced Search", icon: Search, run: () => (setOpen(false), setAdvanced(true)) },
      ];

  if (isDisabled) {
    return (
      <div className="flex min-h-[38px] items-center gap-1 rounded-lg border border-transparent bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">
        {current ? (
          <Link href={`${doctypeUrl(doctype)}/${encodeURIComponent(current)}`} title={display !== current ? current : undefined} className="truncate hover:underline">
            {display}
          </Link>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="group relative">
      <input
        id={inputId ?? field.fieldname}
        type="text"
        value={text}
        autoComplete="off"
        role="combobox"
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        aria-expanded={open}
        aria-controls={`${field.fieldname}-listbox`}
        placeholder={String(field.placeholder ?? "")}
        onFocus={() => {
          setOpen(true);
          search(text);
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          search(e.target.value);
        }}
        onBlur={() => setTimeout(() => (setOpen(false), text !== display && commitTyped(text.trim())), 150)}
        onKeyDown={(e) => {
          const n = results.length + extras.length;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => (a + 1) % n);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? n - 1 : a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (active >= results.length) extras[active - results.length]?.run();
            else if (active >= 0) commit(results[active].value, results[active].label);
            else commitTyped(text.trim());
          } else if (e.key === "Escape") {
            setText(display);
            setOpen(false);
          }
        }}
        className={[
          "w-full bg-white pr-8 text-sm text-zinc-900 transition-colors focus:outline-none dark:bg-zinc-900 dark:text-zinc-100",
          compact
            ? `h-8 rounded-md border bg-transparent px-2 focus:bg-white dark:bg-transparent dark:focus:bg-zinc-900 ${error ? "border-red-400" : "border-transparent hover:border-zinc-200 focus:border-zinc-400 dark:hover:border-zinc-700"}`
            : `rounded-lg border px-3 py-2 focus:ring-2 ${error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"}`,
        ].join(" ")}
      />
      {current && !open && (
        <Link
          href={`${doctypeUrl(doctype)}/${encodeURIComponent(current)}`}
          aria-label={`Open ${current}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 opacity-0 transition-opacity hover:text-zinc-700 group-hover:opacity-100 dark:hover:text-zinc-200"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}
      {loading && open && <div className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" aria-hidden="true" />}

      {open && typeof document !== "undefined" && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          id={`${field.fieldname}-listbox`}
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width }}
          className="z-[70] max-h-72 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.map((r, i) => (
            <li key={r.value} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(r.value, r.label)}
                className={`block w-full px-3 py-1.5 text-left text-sm ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}
              >
                <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{r.label || r.value}</span>
                {r.description && r.description !== r.value && <span className="block truncate text-xs text-zinc-500">{r.description}</span>}
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && <li className="px-3 py-1.5 text-sm text-zinc-400">No {doctype} found</li>}
          <FilterNote doctype={doctype} filters={query()?.filters} text={typeof field.filter_description === "string" ? field.filter_description : undefined} />
          {extras.map((x, k) => {
            const on = active === results.length + k;
            const Icon = x.icon;
            return (
              <li key={x.key} role="option" aria-selected={on} className={k === 0 ? "border-t border-zinc-100 dark:border-zinc-800" : ""}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={x.run}
                  className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm text-zinc-700 dark:text-zinc-200 ${on ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {x.label}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}

      {advanced && (
        <AddMultipleDialog
          single
          doctype={doctype}
          initialTxt={text.trim() === display ? "" : text.trim()}
          getQuery={() => query() as Record<string, unknown> | undefined}
          onPick={async (v, _qty, label) => commit(v, label)}
          onClose={() => setAdvanced(false)}
        />
      )}
      {creating && (
        <CreateLinked
          doctype={doctype}
          initial={text.trim()}
          onClose={() => setCreating(false)}
          onDone={(name) => {
            setCreating(false);
            commit(name);
          }}
        />
      )}
    </div>
  );
}
