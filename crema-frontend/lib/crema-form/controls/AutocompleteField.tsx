"use client";

/**
 * Autocomplete (Desk: form/controls/autocomplete.js). Options: lines, a JSON list, or (set_df_property) an array of
 * strings / { label, value, description }; "Installed Applications" loads the site's apps; set_query / get_query
 * names a method called with { txt, ...params } as you type. The box shows the label, the value is stored; the value
 * is set on pick or blur, and must be one of the options unless the field has `ignore_validation`
 * (an empty list accepts anything).
 */
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import type { FieldControlProps } from "./index";

interface AcItem {
  label: string;
  value: string;
  description?: string;
}

/** autocomplete.js parse_options */
function parseAcOptions(options: unknown): AcItem[] {
  let o: unknown = options;
  if (typeof o === "string" && o.trim().startsWith("[")) {
    try {
      o = JSON.parse(o);
    } catch {
      /* lines */
    }
  }
  if (typeof o === "string") o = o.split("\n");
  if (!Array.isArray(o)) return [];
  return o
    .filter((x) => x != null && x !== "")
    .map((x) => {
      if (typeof x !== "object") return { label: String(x), value: String(x) };
      const r = x as Record<string, unknown>;
      const value = String(r.value ?? "");
      return { label: String(r.label ?? "") || value, value, description: r.description ? String(r.description) : undefined };
    });
}

/** the options: the field's own, the site's apps, or what get_query returned for the typed text (execute_query_if_exists) */
function useAcItems({ field, getQuery, doc }: Pick<FieldControlProps, "field" | "getQuery" | "doc">) {
  const installed = field.options === "Installed Applications";
  const { data: apps } = useQuery({
    queryKey: ["installed-apps"],
    queryFn: () => frappeMethod<unknown[]>("frappe.desk.desktop.get_installed_apps", {}),
    enabled: installed,
    staleTime: Infinity,
  });
  const [queried, setQueried] = useState<AcItem[] | null>(null);
  const items = queried ?? parseAcOptions(installed ? (apps ?? []) : field.options);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const runQuery = (txt: string) => {
    let gq: ReturnType<NonNullable<FieldControlProps["getQuery"]>>;
    try {
      gq = getQuery?.();
    } catch {
      gq = undefined;
    }
    const method = typeof gq === "string" ? gq : gq?.query;
    if (!method) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = typeof gq === "object" ? (gq?.params ?? {}) : {};
      void frappeMethod<unknown[]>(method, { txt, ...params, doc })
        .then((r) => setQueried(parseAcOptions(r ?? [])))
        .catch(() => setQueried([]));
    }, 150);
  };
  return { items, runQuery };
}

interface AcKeyCtx {
  open: boolean;
  count: number;
  setOpen: (o: boolean) => void;
  setActive: (fn: (a: number) => number) => void;
  pickActive: () => boolean;
  commitTyped: () => void;
  cancel: () => void;
}

/** ↑ / ↓ move, Enter takes the highlighted suggestion (autoFirst) or the typed text, Escape cancels */
function acKeyDown(e: KeyboardEvent<HTMLInputElement>, { open, count, setOpen, setActive, pickActive, commitTyped, cancel }: AcKeyCtx) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setOpen(true);
    setActive((a) => Math.min(a + 1, count - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActive((a) => Math.max(a - 1, 0));
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (!(open && pickActive())) commitTyped();
  } else if (e.key === "Escape") cancel();
}

interface ListProps {
  listRef: RefObject<HTMLUListElement | null>;
  id: string;
  label: string;
  pos: { top: number; left: number; width?: number } | null;
  items: AcItem[];
  active: number;
  setActive: (k: number) => void;
  onPick: (v: string) => void;
}

function AcList({ listRef, id, label, pos, items, active, setActive, onPick }: ListProps) {
  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={`${label} suggestions`}
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width }}
      className="z-50 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      {items.map((i, k) => (
        // the input owns the keyboard (aria-activedescendant style); options are picked with the pointer
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <li
          key={i.value}
          role="option"
          aria-selected={k === active}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(k)}
          onClick={() => onPick(i.value)}
          className={`cursor-pointer px-3 py-1.5 text-sm ${k === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
        >
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{i.label}</span>
          {i.description && <span className="block text-xs text-zinc-500">{i.description}</span>}
        </li>
      ))}
    </ul>
  );
}

const inputClass = (error: unknown) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"}`;

export default function AutocompleteField(props: FieldControlProps) {
  const { field, value, disabled } = props;
  const current = value == null ? "" : String(value);
  const { items, runQuery } = useAcItems(props);
  const labelOf = (v: string) => items.find((i) => i.value === v)?.label ?? v;
  if (disabled || field.read_only) {
    return <div className="min-h-[38px] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/70 dark:text-zinc-200">{current ? labelOf(current) : "—"}</div>;
  }
  return <AcEditor {...props} current={current} items={items} runQuery={runQuery} labelOf={labelOf} />;
}

type EditorProps = FieldControlProps & { current: string; items: AcItem[]; runQuery: (txt: string) => void; labelOf: (v: string) => string };

function AcEditor({ field, inputId, onChange, error, current, items, runQuery, labelOf }: EditorProps) {
  const [text, setText] = useState<string | null>(null); // null = not editing
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const pos = useAnchoredPosition(anchor, list, open, { matchWidth: true });
  const shown = text ?? labelOf(current);
  const maxItems = Number(field.max_items) || 99;
  const lid = `${inputId ?? field.fieldname}-ac`;
  const label = field.label || field.fieldname;

  // Awesomplete.FILTER_CONTAINS over label + description + value, list order kept
  const q = (text ?? "").toLowerCase();
  const filtered = items.filter((i) => !q || `${i.label}${i.description ?? ""}${i.value}`.toLowerCase().includes(q)).slice(0, maxItems);

  // validate: one of the options (by value) unless ignore_validation; no options → anything
  const set = (v: string) => {
    setText(null);
    setOpen(false);
    const ok = field.ignore_validation || !items.length || items.some((i) => i.value === v) ? v : "";
    if (ok !== current) onChange(ok || null);
  };
  // get_input_value: a typed label maps to its value
  const commitTyped = () => {
    if (text === null) return;
    const t = text;
    set(items.find((i) => i.label === t)?.value ?? t);
  };
  const keyCtx: AcKeyCtx = {
    open,
    count: filtered.length,
    setOpen,
    setActive,
    pickActive: () => {
      const hit = filtered[active];
      if (hit) set(hit.value);
      return !!hit;
    },
    commitTyped,
    cancel: () => {
      setText(null);
      setOpen(false);
    },
  };

  return (
    <div ref={anchor} className="relative">
      <input
        type="text"
        id={inputId ?? field.fieldname}
        value={shown}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={lid}
        aria-autocomplete="list"
        aria-label={label}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        placeholder={String(field.placeholder ?? "")}
        onFocus={() => {
          setOpen(true);
          setActive(0);
          runQuery(text ?? "");
        }}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          runQuery(e.target.value);
        }}
        onBlur={() => setTimeout(commitTyped, 120)}
        onKeyDown={(e) => acKeyDown(e, keyCtx)}
        className={inputClass(error)}
      />
      {open && filtered.length > 0 && <AcList listRef={list} id={lid} label={label} pos={pos} items={filtered} active={active} setActive={setActive} onPick={set} />}
    </div>
  );
}
