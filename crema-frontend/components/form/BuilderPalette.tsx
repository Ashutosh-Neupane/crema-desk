"use client";

/**
 * Field types in plain words for the form builder: click to add after the selected field (or at the end of the
 * tab), or drag onto a column, a gap between columns, or another field. Desk: form_builder/components/Sidebar.vue.
 */
import { useDraggable } from "@dnd-kit/core";
import { AlignLeft, Calendar, CalendarClock, CheckSquare, Coins, Hash, Image as ImageIcon, LayoutPanelTop, Link2, List, ListChecks, Paperclip, Phone, Sigma, Table2, Type } from "lucide-react";
import { PALETTE } from "./builderChecks";

const ICONS: Record<string, typeof Type> = {
  Data: Type,
  "Small Text": AlignLeft,
  Int: Hash,
  Float: Sigma,
  Currency: Coins,
  Date: Calendar,
  Datetime: CalendarClock,
  Select: List,
  Check: CheckSquare,
  Link: Link2,
  Table: Table2,
  Attach: Paperclip,
  "Attach Image": ImageIcon,
  "Text Editor": ListChecks,
  Phone,
  "Section Break": LayoutPanelTop,
};

function Item({ type, label, hint, onAdd }: { type: string; label: string; hint: string; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  const Icon = ICONS[type] ?? Type;
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        onClick={onAdd}
        title={`${hint} (${type})`}
        aria-label={`Add ${label}`}
        {...attributes}
        {...listeners}
        className={`crema-lift flex w-full touch-none items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-sm text-zinc-700 hover:border-zinc-200 hover:bg-white dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 ${isDragging ? "opacity-50" : ""}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

export function BuilderPalette({ onAdd }: { onAdd: (type: string) => void }) {
  return (
    <nav aria-label="Add a field" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
      <p className="mb-2 px-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Add</p>
      <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {PALETTE.map((p) => (
          <Item key={p.type} {...p} onAdd={() => onAdd(p.type)} />
        ))}
      </ul>
      <p className="mt-2 hidden px-2 text-xs text-zinc-500 lg:block">Click to add, or drag into the form. Every type is in the field&apos;s Type list.</p>
    </nav>
  );
}
