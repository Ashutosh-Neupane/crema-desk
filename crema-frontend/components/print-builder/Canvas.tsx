"use client";

/**
 * Print Format Builder canvas (docs/GAPS.md § 2.19 B). A sheet of paper (white in dark mode too) with the header
 * zone, body sections and footer zone; columns hold field cards showing a sample record's values. Sections drag by
 * their grip, fields drag within and between columns (dnd-kit). A section's toolbar (columns, page break, remove)
 * shows whenever it is hovered or selected — Desk hides it while previewing a record, which made sections
 * impossible to remove.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
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
import { formatCell } from "@/lib/list/format";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { columnKey, fieldKey, getSection, parseKey, type PFField, type PFLayout, type PFSection, type SectionKey, type Selection } from "@/lib/print-builder/layout";
import { sanitizeHtml } from "@/lib/report/columns";

export interface CanvasProps {
  layout: PFLayout;
  settings: Record<string, unknown>;
  meta: DocTypeMeta | null;
  sample: Record<string, unknown> | null;
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

/** what a field card shows: the sample record's value, formatted like the list does */
function sampleValue(f: PFField, meta: DocTypeMeta | null, sample: Record<string, unknown> | null): string {
  if (!sample) return "";
  const df = meta?.fields?.find((x) => x.fieldname === f.fieldname);
  const v = sample[f.fieldname] ?? (f.fieldname === "name" ? sample.name : undefined);
  if (v == null || v === "") return "";
  return formatCell(v, { fieldtype: df?.fieldtype ?? f.fieldtype, options: df?.options ?? (f.options as string | undefined) }, sample);
}

function FieldBody({ f, meta, sample, colon }: { f: PFField; meta: DocTypeMeta | null; sample: Record<string, unknown> | null; colon: boolean }) {
  const label = f.show_label === "hide" ? null : <span className="text-[0.85em] text-zinc-500">{String(f.label ?? f.fieldname)}{colon && !f.hide_colon ? ":" : ""}</span>;
  const style: CSSProperties = { textAlign: (f.align as CSSProperties["textAlign"]) || undefined, fontWeight: f.bold ? 700 : undefined, fontSize: f.font_size ? `${Number(f.font_size)}px` : undefined };
  switch (f.fieldtype) {
    case "Static Text":
      return <div style={style} className="whitespace-pre-line">{String(f.text ?? "") || <span className="italic text-zinc-400">Empty text</span>}</div>;
    case "HTML":
      return (
        <div>
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400">{String(f.label || "HTML")}</span>
          {String(f.html ?? "").trim() ? (
            // the block's HTML as it will look (sanitized; Jinja tags show as written until the preview fills them)
            <div className="max-h-40 overflow-hidden [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(f.html)) }} />
          ) : (
            <span className="text-[11px] text-zinc-400">Empty HTML block — write it on the right</span>
          )}
        </div>
      );
    case "Spacer":
      return <div style={{ height: `${Number(f.height ?? 10)}px` }} className="rounded border border-dashed border-zinc-300 bg-zinc-50" aria-label="Spacer" />;
    case "Divider":
      return <hr className="my-1.5 border-zinc-400" aria-label="Divider" />;
    case "Image":
      return f.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied URL, not an optimisable asset
        <img src={String(f.image_url)} alt={String(f.label ?? "Image")} style={{ width: f.width ? String(f.width) : undefined }} className="max-h-24 max-w-full object-contain" />
      ) : (
        <div className="flex h-12 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400">Image (set a URL)</div>
      );
    case "Barcode":
      return <div className="flex h-12 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-500">{f.barcode_format === "QR" ? "QR code" : "Barcode"} · {String(f.barcode_field || f.barcode_value || "no value yet")}</div>;
    case "Table":
    case "Table MultiSelect": {
      const cols = (f.table_columns as Array<{ label?: string; fieldname: string; width?: number }> | undefined) ?? [];
      const rows = ((sample?.[f.fieldname] as Array<Record<string, unknown>> | undefined) ?? []).slice(0, 2);
      return (
        <div>
          {label}
          <table className="mt-0.5 w-full border-collapse text-[0.85em]">
            <thead>
              <tr>{cols.map((c) => <th key={c.fieldname} className="border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-left font-medium">{c.label ?? c.fieldname}</th>)}</tr>
            </thead>
            <tbody>
              {(rows.length ? rows : [{}]).map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c.fieldname} className="border border-zinc-300 px-1.5 py-0.5 text-zinc-700">{r[c.fieldname] == null ? "" : String(r[c.fieldname])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default: {
      const v = sampleValue(f, meta, sample);
      return (
        <div style={style} className={f.show_label === "inline" ? "flex gap-2" : ""}>
          {label}
          <div className="min-h-[1.2em] break-words">{v || <span className="text-zinc-300">—</span>}</div>
        </div>
      );
    }
  }
}

function FieldCard({ id, f, sel, onSelect, onRemove, meta, sample, colon }: { id: string; f: PFField; sel: boolean; onSelect: () => void; onRemove: () => void; meta: DocTypeMeta | null; sample: Record<string, unknown> | null; colon: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, data: { type: "field" } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      data-pfb-field={f.fieldname}
      aria-label={`Field ${String(f.label ?? f.fieldname)}`}
      aria-selected={sel}
      role="option"
      className={`group/field relative rounded-md px-1.5 py-1 outline-offset-1 ${sel ? "outline outline-2 outline-blue-500" : "hover:outline hover:outline-1 hover:outline-blue-300"}`}
    >
      <FieldBody f={f} meta={meta} sample={sample} colon={colon} />
      <div className={`absolute -top-2.5 right-1 z-10 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-0.5 shadow-sm ${sel ? "flex" : "hidden group-hover/field:flex"}`}>
        <button type="button" {...attributes} {...listeners} aria-label={`Drag ${String(f.label ?? f.fieldname)}`} className="cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-700">
          <GripVertical className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${String(f.label ?? f.fieldname)}`}
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

function SectionBox({
  s,
  sec,
  props,
  handle,
  zone,
}: {
  s: SectionKey;
  sec: PFSection;
  props: CanvasProps;
  handle?: { attributes: object; listeners?: object };
  zone?: "Header" | "Footer";
}) {
  const sel = sameSel(props.selection, { kind: "section", s });
  const n = sec.columns.length;
  const colon = !!Number(props.settings.show_label_colon);
  const fieldsEmpty = sec.columns.every((c) => c.fields.length === 0);
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect({ kind: "section", s });
      }}
      data-pfb-section={String(s)}
      aria-label={zone ? `${zone} zone` : `Section ${Number(s) + 1}${sec.label ? ` ${sec.label}` : ""}`}
      className={`group/sec relative rounded-lg border ${sel ? "border-blue-500 ring-2 ring-blue-500/20" : zone ? "border-dashed border-zinc-300 hover:border-blue-300" : "border-transparent hover:border-blue-300"}`}
    >
      <div role="toolbar" aria-label={zone ? `${zone} zone tools` : `Section ${Number(s) + 1} tools`} className={`absolute -top-3.5 left-2 z-20 items-center gap-1 rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-[11px] text-zinc-600 shadow-sm ${sel ? "flex" : "hidden group-hover/sec:flex"}`}>
        {handle && (
          <button type="button" {...handle.attributes} {...handle.listeners} aria-label="Drag section" className="cursor-grab rounded p-0.5 text-zinc-400 hover:text-zinc-700">
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span className="px-0.5 font-medium">{zone ?? (sec.page_break ? "Page break" : sec.label || "Section")}</span>
        <span className="mx-0.5 h-3 w-px bg-zinc-200" />
        {[1, 2, 3, 4].map((k) => (
          <button
            key={k}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onColumns(s, k);
            }}
            aria-label={`${k} column${k > 1 ? "s" : ""}`}
            aria-pressed={n === k}
            className={`h-5 w-5 rounded ${n === k ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
          >
            {k}
          </button>
        ))}
        {typeof s === "number" && (
          <>
            <span className="mx-0.5 h-3 w-px bg-zinc-200" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onRemoveSection(s);
              }}
              aria-label="Remove section"
              title="Remove section"
              className="rounded p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
      {sec.page_break && (
        <div className="flex items-center gap-1.5 px-2 pt-2 text-[10px] uppercase tracking-wide text-zinc-400">
          <Scissors className="h-3 w-3" /> new page starts here
        </div>
      )}
      {sec.label && sec.show_label !== "hide" && <div className="px-2 pt-2 text-[1.05em] font-semibold">{sec.label}</div>}
      {zone && fieldsEmpty && !sel ? (
        <div className="px-2 py-2 text-[11px] text-zinc-400">{zone}: fields here repeat on every page (optional)</div>
      ) : (
        <div className="grid gap-3 p-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {sec.columns.map((col, c) => (
            <SortableContext key={c} items={col.fields.map((_, f) => fieldKey(s, c, f))} strategy={verticalListSortingStrategy}>
              <ColumnDrop id={columnKey(s, c)} empty={col.fields.length === 0}>
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
          ))}
        </div>
      )}
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
        onClick={() => props.onSelect(null)}
        // paper stays white in dark mode, like printed output
        className="mx-auto w-full max-w-[210mm] bg-white text-zinc-900 shadow-lg ring-1 ring-black/5"
        style={{ padding: `${m("margin_top", 15)} ${m("margin_right", 15)} ${m("margin_bottom", 15)} ${m("margin_left", 15)}`, fontSize: `${Number(settings.font_size || 14)}px`, minHeight: "297mm", colorScheme: "light" }}
      >
        <div className="mb-3">{layout.header && <SectionBox s="header" sec={layout.header} props={props} zone="Header" />}</div>
        <SortableContext items={layout.sections.map((_, i) => `s|${i}`)} strategy={verticalListSortingStrategy}>
          <InsertLine onInsert={() => props.onInsertSection(0)} />
          {layout.sections.map((sec, i) => (
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
