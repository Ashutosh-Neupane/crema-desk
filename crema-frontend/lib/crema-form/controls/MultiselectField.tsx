"use client";

/**
 * MultiSelect and MultiSelect Pills (Desk: form/controls/multiselect.js, multiselect_pills.js): pick several options
 * (lines, a list, { label, value } items, or `get_data(txt)`). Values as Desk returns them: MultiSelect a
 * comma-separated string of values ("a, b"); MultiSelect Pills an array. Picked values show as pills, the box
 * suggests the rest (Enter takes the highlighted one, Backspace in the empty box removes the last).
 */
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import type { FieldControlProps } from "./index";
import { multiValues, useMultiOptions } from "./multiOptions";

function boxClass(readOnly: boolean, error: unknown) {
  if (readOnly) return "border-transparent bg-zinc-100 dark:bg-zinc-800/70";
  return error ? "border-red-500" : "border-zinc-300 focus-within:border-zinc-500 dark:border-zinc-700";
}

function Pill({ value, label, onRemove }: { value: string; label: string; onRemove?: () => void }) {
  return (
    <span data-pill={value} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      {label}
      {onRemove && (
        <button type="button" aria-label={`Remove ${label}`} onClick={onRemove} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

type KeyActions = { count: number; setActive: (f: (a: number) => number) => void; pick: () => void; removeLast: () => void; close: () => void };

// the suggestion box's keys (Desk awesomplete): arrows move, Enter takes, Backspace in the empty box drops the last pill
function onSuggestKey(e: React.KeyboardEvent<HTMLInputElement>, k: KeyActions) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") e.preventDefault();
  if (e.key === "ArrowDown") k.setActive((a) => Math.min(a + 1, k.count - 1));
  else if (e.key === "ArrowUp") k.setActive((a) => Math.max(a - 1, 0));
  else if (e.key === "Enter") k.pick();
  else if (e.key === "Backspace" && !e.currentTarget.value) k.removeLast();
  else if (e.key === "Escape") k.close();
}

export default function MultiselectField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const pills = field.fieldtype === "MultiSelect Pills";
  const selected = multiValues(value);
  const [txt, setTxt] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useMultiOptions(field, txt);
  const anchor = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const pos = useAnchoredPosition(anchor, list, open, { matchWidth: true });
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const q = txt.toLowerCase();
  const picked = new Set(selected);
  const offered = options.filter((o) => !picked.has(o.value) && (!q || `${o.label}${o.value}${o.description ?? ""}`.toLowerCase().includes(q)));

  const emit = (vals: string[]) => onChange(pills ? vals : vals.length ? vals.join(", ") : null);
  const add = (v: string) => {
    setTxt("");
    setActive(0);
    if (v && !selected.includes(v)) emit([...selected, v]);
  };

  return (
    <div
      ref={anchor}
      data-fieldname={field.fieldname}
      className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 ${boxClass(readOnly, error)} bg-white dark:bg-zinc-900`}
    >
      {selected.map((v) => (
        <Pill key={v} value={v} label={labelOf(v)} onRemove={readOnly ? undefined : () => emit(selected.filter((s) => s !== v))} />
      ))}
      {readOnly && !selected.length && <span className="text-sm text-zinc-400">—</span>}
      {!readOnly && (
        <input
          id={inputId ?? field.fieldname}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`${field.fieldname}-ms`}
          aria-autocomplete="list"
          aria-invalid={!!error}
          autoComplete="off"
          value={txt}
          placeholder={selected.length ? "" : String(field.placeholder ?? "")}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setTxt(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) =>
            onSuggestKey(e, {
              count: offered.length,
              setActive,
              pick: () => offered[active] && add(offered[active].value),
              removeLast: () => selected.length && emit(selected.slice(0, -1)),
              close: () => setOpen(false),
            })
          }
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
        />
      )}
      {open && !readOnly && offered.length > 0 && (
        <ul
          ref={list}
          id={`${field.fieldname}-ms`}
          role="listbox"
          aria-label={`${label} options`}
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width }}
          className="z-50 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {offered.map((o, k) => (
            // the input owns the keyboard; options are picked with the pointer
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={o.value}
              role="option"
              aria-selected={k === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(k)}
              onClick={() => add(o.value)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${k === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              <span className="text-zinc-900 dark:text-zinc-100">{o.label}</span>
              {o.description && <span className="block text-xs text-zinc-500">{o.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
