"use client";

/**
 * Print Format Builder canvas (docs/GAPS.md § 2.19 B). A sheet of paper (white in dark mode too) with the header
 * zone, body sections and footer zone; columns hold field cards showing a sample record's values. Sections drag by
 * their grip, fields drag within and between columns (dnd-kit). A section's toolbar (columns, page break, remove)
 * shows whenever it is hovered or selected — Desk hides it while previewing a record, which made sections
 * impossible to remove.
 */
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Scissors, X } from "lucide-react";
import FieldBody from "@/components/print-builder/FieldBody";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { columnKey, fieldKey, getSection, parseKey, type PFField, type PFLayout, type PFSection, type SectionKey, type Selection } from "@/lib/print-builder/layout";

export interface CanvasProps {
  layout: PFLayout;
  settings: Record<string, unknown>;
  meta: DocTypeMeta | null;
  sample: Record<string, unknown> | null;
  /** sheet size in mm (default A4) */
  paper?: { width: number; height: number };
  selection: Selection;
  onSelect: (s: Selection) => void;
  onRemoveField: (s: SectionKey, c: number, f: number) => void;
  onRemoveSection: (s: number) => void;
  onColumns: (s: SectionKey, n: number) => void;
  onInsertSection: (at: number) => void;
  onMoveSection: (from: number, to: number) => void;
  onMoveField: (from: { s: SectionKey; c: number; f: number }, to: { s: SectionKey; c: number; at?: number }) => void;
}

const sameSel = (a: Selection, b: Selection) => JSON.stringify(a) === JSON.stringify(b);

/** Enter / Space on a focused card selects it, like a click */
const onActivateKey = (select: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  e.stopPropagation();
  select();
};

function FieldCard({ id, f, sel, onSelect, onRemove, meta, sample, colon }: { id: string; f: PFField; sel: boolean; onSelect: () => void; onRemove: () => void; meta: DocTypeMeta | null; sample: Record<string, unknown> | null; colon: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: "field" } });
  const name = String(f.label ?? f.fieldname);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      data-pfb-field={f.fieldname}
      className="group/field relative"
    >
      {/* the card itself is the selectable option; its tools sit beside it so they keep their own button semantics */}
      <div
        role="option"
        tabIndex={0}
        aria-label={`Field ${name}`}
        aria-selected={sel}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onKeyDown={onActivateKey(onSelect)}
        className={`rounded-md px-1.5 py-1 outline-offset-1 ${sel ? "outline outline-2 outline-blue-500" : "hover:outline hover:outline-1 hover:outline-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300"}`}
      >
        <FieldBody f={f} meta={meta} sample={sample} colon={colon} />
      </div>
      <div className={`absolute -top-2.5 right-1 z-10 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-0.5 shadow-sm ${sel ? "flex" : "hidden group-hover/field:flex group-focus-within/field:flex"}`}>
        <button type="button" {...attributes} {...listeners} onClick={stop(onSelect)} aria-label={`Drag ${name}`} className="cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-700">
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${name}`}
          className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function ColumnDrop({ id, children, empty }: { id: string; children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column" } });
  return (
    <div ref={setNodeRef} className={`flex min-h-10 flex-col gap-1 rounded-md p-1 ${isOver ? "bg-blue-50" : ""} ${empty ? "border border-dashed border-zinc-300" : ""}`}>
      {children}
      {empty && <span className="m-auto py-2 text-[11px] text-zinc-400">Add fields from the left, or drag one here</span>}
    </div>
  );
}

type Handle = { attributes: object; listeners?: object };
const stop = (fn: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  fn();
};

/** a section's hover / selected toolbar: drag grip, title, column count, remove */
function SectionToolbar({ s, sec, sel, zone, handle, props }: { s: SectionKey; sec: PFSection; sel: boolean; zone?: "Header" | "Footer"; handle?: Handle; props: CanvasProps }) {
  const n = sec.columns.length;
  const title = zone ?? (sec.page_break ? "Page break" : sec.label || "Section");
  return (
    <div role="toolbar" aria-label={zone ? `${zone} zone tools` : `Section ${Number(s) + 1} tools`} className={`absolute -top-3.5 left-2 z-20 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-[11px] text-zinc-600 shadow-sm ${sel ? "flex" : "hidden group-hover/sec:flex"}`}>
      {handle && (
        <button type="button" {...handle.attributes} {...handle.listeners} aria-label="Drag section" className="cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-700">
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <span className="px-0.5 font-medium">{title}</span>
      <span className="mx-0.5 h-3 w-px bg-zinc-200" />
      {[1, 2, 3, 4].map((k) => (
        <button key={k} type="button" onClick={stop(() => props.onColumns(s, k))} aria-label={`${k} column${k > 1 ? "s" : ""}`} aria-pressed={n === k} className={`h-5 w-5 rounded ${n === k ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
          {k}
        </button>
      ))}
      {typeof s === "number" && (
        <>
          <span className="mx-0.5 h-3 w-px bg-zinc-200" />
          <button type="button" onClick={stop(() => props.onRemoveSection(s))} aria-label="Remove section" title="Remove section" className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
            <X className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

/** a section's columns of field cards */
function SectionColumns({ s, sec, props }: { s: SectionKey; sec: PFSection; props: CanvasProps }) {
  const colon = !!Number(props.settings.show_label_colon);
  return (
    <div className="grid gap-3 p-2" style={{ gridTemplateColumns: `repeat(${sec.columns.length}, minmax(0, 1fr))` }}>
      {sec.columns.map((col, c) => {
        const id = columnKey(s, c);
        return (
          <SortableContext key={id} items={col.fields.map((_, f) => fieldKey(s, c, f))} strategy={verticalListSortingStrategy}>
            <ColumnDrop id={id} empty={col.fields.length === 0}>
              {col.fields.map((f, fi) => (
                <FieldCard
                  key={`${f.fieldname}-${fi}`}
                  id={fieldKey(s, c, fi)}
                  f={f}
                  sel={sameSel(props.selection, { kind: "field", s, c, f: fi })}
                  onSelect={() => props.onSelect({ kind: "field", s, c, f: fi })}
                  onRemove={() => props.onRemoveField(s, c, fi)}
                  meta={props.meta}
                  sample={props.sample}
                  colon={colon}
                />
              ))}
            </ColumnDrop>
          </SortableContext>
        );
      })}
    </div>
  );
}

/**
 * One section or zone. A click anywhere in it that no card or tool took selects it; that click is handled once
 * on the sheet (Canvas), which finds the section from `data-pfb-section`.
 */
function SectionBox({ s, sec, props, handle, zone }: { s: SectionKey; sec: PFSection; props: CanvasProps; handle?: Handle; zone?: "Header" | "Footer" }) {
  const sel = sameSel(props.selection, { kind: "section", s });
  const fieldsEmpty = sec.columns.every((c) => c.fields.length === 0);
  const border = sel ? "border-blue-500 ring-2 ring-blue-500/20" : zone ? "border-dashed border-zinc-300 hover:border-blue-300" : "border-transparent hover:border-blue-300";
  return (
    <div data-pfb-section={String(s)} aria-label={zone ? `${zone} zone` : `Section ${Number(s) + 1}${sec.label ? ` ${sec.label}` : ""}`} className={`group/sec relative rounded-lg border ${border}`}>
      <SectionToolbar s={s} sec={sec} sel={sel} zone={zone} handle={handle} props={props} />
      {sec.page_break && (
        <div className="flex items-center gap-1.5 px-2 pt-2 text-[10px] uppercase tracking-wide text-zinc-400">
          <Scissors className="h-3 w-3" /> new page starts here
        </div>
      )}
      {sec.label && sec.show_label !== "hide" && <div className="px-2 pt-2 text-[1.05em] font-semibold">{sec.label}</div>}
      {zone && fieldsEmpty && !sel ? <div className="px-2 py-2 text-[11px] text-zinc-400">{zone}: fields here repeat on every page (optional)</div> : <SectionColumns s={s} sec={sec} props={props} />}
    </div>
  );
}

function SortableSection({ i, sec, props }: { i: number; sec: PFSection; props: CanvasProps }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `s|${i}`, data: { type: "section" } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <SectionBox s={i} sec={sec} props={props} handle={{ attributes, listeners }} />
    </div>
  );
}

function InsertLine({ onInsert }: { onInsert: () => void }) {
  return (
    <div className="group/ins relative flex h-3 items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInsert();
        }}
        aria-label="Add section here"
        className="z-10 hidden h-5 items-center gap-1 rounded-full border border-blue-300 bg-white px-2 text-[10px] text-blue-600 shadow-sm group-hover/ins:flex focus:flex"
      >
        <Plus className="h-3 w-3" /> Section
      </button>
      <span className="absolute inset-x-0 top-1/2 hidden h-px bg-blue-300 group-hover/ins:block" />
    </div>
  );
}

/** the section a click on the sheet landed in, from its `data-pfb-section` */
function sectionAt(target: EventTarget): Selection {
  const key = target instanceof Element ? target.closest<HTMLElement>("[data-pfb-section]")?.dataset.pfbSection : undefined;
  if (key === undefined) return null;
  return { kind: "section", s: key === "header" || key === "footer" ? key : Number(key) };
}

export default function Canvas(props: CanvasProps) {
  const { layout, settings } = props;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [dragging, setDragging] = useState<string | null>(null);

  // sections only collide with sections; fields with fields and columns (pointer inside wins)
  const collision: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const pool = args.droppableContainers.filter((d) => (type === "section" ? d.data.current?.type === "section" : d.data.current?.type !== "section"));
    if (type === "section") return closestCenter({ ...args, droppableContainers: pool });
    const within = pointerWithin({ ...args, droppableContainers: pool });
    const field = within.find((c) => String(c.id).startsWith("f|"));
    return field ? [field] : within.length ? within : closestCenter({ ...args, droppableContainers: pool });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    const a = String(e.active.id);
    const o = String(e.over.id);
    if (a.startsWith("s|") && o.startsWith("s|")) {
      props.onMoveSection(Number(a.split("|")[1]), Number(o.split("|")[1]));
      return;
    }
    if (!a.startsWith("f|")) return;
    const from = parseKey(a);
    const over = parseKey(o);
    if (over.kind === "f") props.onMoveField(from, { s: over.s, c: over.c, at: over.f });
    else if (over.kind === "c") props.onMoveField(from, { s: over.s, c: over.c });
  };

  const draggedField = dragging?.startsWith("f|") ? (() => { const k = parseKey(dragging); return getSection(layout, k.s)?.columns[k.c]?.fields[k.f]; })() : null;
  const m = (k: string, d: number) => `${Number(settings[k] ?? d)}mm`;

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div
        role="document"
        aria-label="Print layout"
        // one click handler for the whole sheet: the section under the click, else nothing (cards and tools stop it)
        onClick={(e) => props.onSelect(sectionAt(e.target))}
        onKeyDown={(e) => e.key === "Escape" && props.onSelect(null)}
        // paper stays white in dark mode, like printed output
        className="mx-auto w-full bg-white text-zinc-900 shadow-lg ring-1 ring-black/5"
        style={{ padding: `${m("margin_top", 15)} ${m("margin_right", 15)} ${m("margin_bottom", 15)} ${m("margin_left", 15)}`, fontSize: `${Number(settings.font_size || 14)}px`, maxWidth: `${props.paper?.width ?? 210}mm`, minHeight: `${props.paper?.height ?? 297}mm`, colorScheme: "light" }}
      >
        <div className="mb-3">{layout.header && <SectionBox s="header" sec={layout.header} props={props} zone="Header" />}</div>
        <SortableContext items={layout.sections.map((_, i) => `s|${i}`)} strategy={verticalListSortingStrategy}>
          <InsertLine onInsert={() => props.onInsertSection(0)} />
          {layout.sections.map((sec, i) => (
            // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- format_data sections carry no id (Desk's JSON); dnd-kit ids are positional (`s|i`) too
            <div key={i}>
              <SortableSection i={i} sec={sec} props={props} />
              <InsertLine onInsert={() => props.onInsertSection(i + 1)} />
            </div>
          ))}
        </SortableContext>
        {layout.sections.length === 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); props.onInsertSection(0); }} className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-zinc-300 py-10 text-sm text-zinc-500 hover:border-blue-300 hover:text-blue-600">
            <Plus className="h-5 w-5" /> Add a section
            <span className="text-xs text-zinc-400">Sections hold the columns and fields of your document</span>
          </button>
        )}
        <div className="mt-3">{layout.footer && <SectionBox s="footer" sec={layout.footer} props={props} zone="Footer" />}</div>
      </div>
      <DragOverlay>{draggedField ? <div className="rounded-md bg-white px-2 py-1 text-xs shadow-lg ring-1 ring-blue-400">{String(draggedField.label ?? draggedField.fieldname)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
