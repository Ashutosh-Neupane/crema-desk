"use client";

/**
 * Icon (Desk: form/controls/icon.js + icon_picker/): the value is a Desk icon name; the picker lists every symbol in
 * Desk's sprites (frappe.symbols — lucide + timeless) with search, the box shows the chosen icon ("folder" when
 * empty, as get_icon does). Not ported: options "Emojis" (icon_picker include_emoji).
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadDeskIcons } from "@/lib/frappe/icons";
import type { FieldControlProps } from "./index";

export function DeskIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg className={`${className} fill-none stroke-current`} aria-hidden="true" strokeWidth={1.5}>
      <use href={`#icon-${name}`} />
    </svg>
  );
}

function IconOptions({ icons, filtered, current, onPick }: { icons: string[]; filtered: string[]; current: string; onPick: (n: string) => void }) {
  return (
    <div role="listbox" aria-label="Icon options" className="absolute left-0 top-full z-40 mt-1 grid max-h-64 w-full grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-lg sm:grid-cols-10 dark:border-zinc-700 dark:bg-zinc-900">
      {filtered.map((n) => (
        <button
          key={n}
          type="button"
          role="option"
          aria-selected={n === current}
          aria-label={n}
          title={n}
          onClick={() => onPick(n)}
          className={`flex h-8 items-center justify-center rounded text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 ${n === current ? "bg-zinc-100 ring-1 ring-zinc-400 dark:bg-zinc-800" : ""}`}
        >
          <DeskIcon name={n} />
        </button>
      ))}
      {!filtered.length && <p className="col-span-full py-2 text-center text-xs text-zinc-500">{icons.length ? "No icons match" : "Loading icons…"}</p>}
    </div>
  );
}

/** closes the popover on a mousedown outside `box` */
function useOutsideClose(box: React.RefObject<HTMLElement | null>, open: boolean, setOpen: (o: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [box, open, setOpen]);
}

const boxClass = (error: unknown, readOnly: boolean) =>
  `flex items-center gap-2 rounded-lg border px-3 py-2 ${error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"} ${readOnly ? "bg-zinc-100 dark:bg-zinc-800/70" : "bg-white dark:bg-zinc-900"}`;

export default function IconField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const current = typeof value === "string" ? value : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const { data: icons = [] } = useQuery({ queryKey: ["desk-icons"], queryFn: loadDeskIcons, staleTime: Infinity });
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;
  const filtered = (query ? icons.filter((n) => n.includes(query.toLowerCase().trim())) : icons).slice(0, 300);
  const shownIcon = current || "folder";
  useOutsideClose(box, open, setOpen);

  const pick = (n: string) => {
    setOpen(false);
    setQuery("");
    if (n !== current) onChange(n || null);
  };

  return (
    <div ref={box} className="relative">
      <div className={boxClass(error, readOnly)}>
        <span data-icon={shownIcon} className={current ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-300"}>
          <DeskIcon name={shownIcon} />
        </span>
        <input
          id={inputId ?? field.fieldname}
          type="text"
          aria-label={label}
          aria-haspopup="listbox"
          aria-invalid={!!error}
          value={open ? query : current}
          placeholder={String(field.placeholder || "Choose an icon")}
          readOnly={readOnly}
          onFocus={() => !readOnly && setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (filtered[0]) pick(filtered[0]);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 focus:outline-none dark:text-zinc-100"
        />
        {current && !readOnly && (
          <button type="button" aria-label={`Clear ${label}`} onClick={() => pick("")} className="text-xs text-zinc-400 hover:text-zinc-700">
            ✕
          </button>
        )}
      </div>
      {open && <IconOptions icons={icons} filtered={filtered} current={current} onPick={pick} />}
    </div>
  );
}
