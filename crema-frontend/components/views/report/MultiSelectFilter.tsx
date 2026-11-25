"use client";

/** MultiSelectList filter: chips + a combobox searching the filter's get_data or the Link doctype (Desk: multiselect_list.js). */
import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { deskCall } from "@/lib/frappe/form";
import { selectOptions, type ReportFilter } from "./queryReportTypes";

type Option = { value: string; description?: string };

async function fetchOptions(f: ReportFilter, text: string): Promise<Option[]> {
  let res: unknown;
  if (f.get_data) res = await f.get_data(text);
  else if (f.fieldtype === "MultiSelect" || !f.options) res = selectOptions(f.options).filter((o) => o.value.toLowerCase().includes(text.toLowerCase()));
  else res = (await deskCall("frappe.desk.search.search_link", { doctype: String(f.options), txt: text, page_length: 20 })).env.message;
  const list = (Array.isArray(res) ? res : []).map((o) => (typeof o === "string" ? { value: o } : (o as Option)));
  return list.filter((o) => o?.value);
}

function useOptions(f: ReportFilter, text: string, open: boolean) {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(() => {
      fetchOptions(f, text).then(
        (list) => {
          if (!cancelled) setOptions(list);
        },
        () => {
          if (!cancelled) setOptions([]);
        },
      );
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, text, f]);
  return options;
}

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return (value as string[]).filter(Boolean);
  return value ? String(value).split(",").filter(Boolean) : [];
};

export default function MultiSelectFilter({ id, f, value, onChange }: { id: string; f: ReportFilter; value: unknown; onChange: (v: unknown) => void }) {
  const selected = toList(value);
  const chosen = new Set(selected);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useOptions(f, text, open);
  const listId = `${useId()}-options`;
  const shown = open && options.length > 0;

  const toggle = (v: string) => onChange(chosen.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, options.length - 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
    else if (e.key === "Enter" && shown && options[active]) toggle(options[active].value);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="relative">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-1 dark:border-zinc-700 dark:bg-zinc-900">
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {s}
            <button type="button" aria-label={`Remove ${s}`} onClick={() => toggle(s)}>
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown && options[active] ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="min-w-16 flex-1 bg-transparent text-sm outline-none"
          placeholder={selected.length ? "" : String(f.label ?? "")}
        />
      </div>
      {shown && (
        <ul id={listId} role="listbox" aria-multiselectable className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={chosen.has(o.value)}
              onMouseDown={(e) => {
                e.preventDefault();
                toggle(o.value);
              }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              <span aria-hidden className={`inline-block h-3.5 w-3.5 shrink-0 rounded-sm border ${chosen.has(o.value) ? "border-blue-600 bg-blue-600" : "border-zinc-400"}`} />
              <span className="truncate">{o.value}</span>
              {o.description && <span className="ml-auto truncate text-xs text-zinc-500">{o.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
