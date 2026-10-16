"use client";

/**
 * Visual form builder for DocType (and any meta with a `form_builder` HTML
 * field) — Trevo's take on Desk v16's Form Builder:
 *  - canvas = tabs → sections → columns → field cards, as the form will render
 *  - drag fields within / across columns; add field / column / section / tab in place
 *  - right panel: essentials first (label, type, contextual options), then
 *    common toggles, then advanced (fetch, depends_on, length, …)
 * Edits are the DocType's `fields` rows (DocField) and save through Frappe.
 */
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, Columns3, Copy, EyeOff, GripVertical, LayoutPanelTop, Plus, Trash2, X } from "lucide-react";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocTypeMeta } from "@/lib/frappe/types";
import LinkInput from "@/components/list/LinkInput";

type F = Row & { fieldtype: string; label?: string; fieldname?: string };
interface Column { brk: F | null; fields: F[] }
interface Section { brk: F | null; columns: Column[] }
interface Tab { brk: F | null; sections: Section[] }

const LAYOUT = new Set(["Tab Break", "Section Break", "Column Break"]);
const COMMON_TYPES = ["Data", "Link", "Select", "Int", "Float", "Currency", "Check", "Date", "Datetime", "Small Text", "Text Editor", "Table", "Attach", "Attach Image"];

const scrub = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 61) || "field";

/** flat DocField rows → tabs/sections/columns */
function build(rows: F[]): Tab[] {
  const tabs: Tab[] = [{ brk: null, sections: [{ brk: null, columns: [{ brk: null, fields: [] }] }] }];
  const tab = () => tabs[tabs.length - 1];
  const sec = () => tab().sections[tab().sections.length - 1];
  const col = () => sec().columns[sec().columns.length - 1];
  for (const r of rows) {
    if (r.fieldtype === "Tab Break") {
      // a leading Tab Break replaces the implicit first tab when it's still empty
      const t = tab();
      if (tabs.length === 1 && !t.brk && t.sections.every((s) => s.columns.every((c) => !c.fields.length))) t.brk = r;
      else tabs.push({ brk: r, sections: [{ brk: null, columns: [{ brk: null, fields: [] }] }] });
    } else if (r.fieldtype === "Section Break") {
      const t = tab();
      const only = t.sections.length === 1 && !t.sections[0].brk && t.sections[0].columns.every((c) => !c.fields.length);
      if (only) t.sections[0].brk = r;
      else t.sections.push({ brk: r, columns: [{ brk: null, fields: [] }] });
    } else if (r.fieldtype === "Column Break") {
      sec().columns.push({ brk: r, fields: [] });
    } else col().fields.push(r);
  }
  return tabs;
}

function flatten(tabs: Tab[]): F[] {
  const out: F[] = [];
  for (const t of tabs) {
    if (t.brk) out.push(t.brk);
    for (const s of t.sections) {
      if (s.brk) out.push(s.brk);
      s.columns.forEach((c, i) => {
        if (i > 0 && c.brk) out.push(c.brk);
        out.push(...c.fields);
      });
    }
  }
  return out;
}

function FieldCard({ f, selected, onSelect }: { f: F; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.name });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 rounded-lg border bg-white px-2 py-2 text-sm transition-colors dark:bg-zinc-900 ${selected ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"} ${isDragging ? "z-10 opacity-70 shadow-lg" : ""}`}
    >
      <button type="button" aria-label={`Drag ${f.label || f.fieldname}`} className="cursor-grab touch-none text-zinc-300 hover:text-zinc-500 dark:text-zinc-600" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`truncate ${f.hidden ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-100"}`}>
          {f.label || f.fieldname || "Untitled"}
          {!!f.reqd && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </span>
        {!!f.hidden && <EyeOff className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
        <span className="ml-auto shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{f.fieldtype}</span>
      </button>
    </div>
  );
}

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1 text-sm text-zinc-700 dark:text-zinc-200" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-zinc-100" />
      <span>{label}</span>
    </label>
  );
}

const inputCls = "h-8 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function Properties({ f, types, set, onDelete, onDuplicate, onClose }: { f: F; types: string[]; set: (k: string, v: unknown) => void; onDelete: () => void; onDuplicate: () => void; onClose: () => void }) {
  const [advanced, setAdvanced] = useState(false);
  const isNewField = String(f.name).startsWith("new-") || !!f.__islocal;
  const layout = LAYOUT.has(f.fieldtype);
  const optionsHelp: Record<string, string> = {
    Select: "One option per line",
    Link: "DocType to link to",
    "Dynamic Link": "Field that holds the DocType",
    Table: "Child DocType",
    "Table MultiSelect": "Child DocType",
    Currency: "Currency field (e.g. currency)",
    Code: "Language: Javascript, Python, HTML, CSS, JSON, SQL",
    Data: "Email, Name, Phone, URL, Barcode, IBAN (optional)",
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{layout ? f.fieldtype : "Field"}</h3>
        <button type="button" onClick={onDuplicate} aria-label="Duplicate field" className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"><Copy className="h-4 w-4" /></button>
        <button type="button" onClick={onDelete} aria-label="Delete field" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /></button>
        <button type="button" onClick={onClose} aria-label="Close properties" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-500">Label</span>
        <input
          autoFocus
          value={String(f.label ?? "")}
          onChange={(e) => {
            set("label", e.target.value);
            // Desk derives the fieldname from the label until the field is saved
            if (isNewField) set("fieldname", scrub(e.target.value));
          }}
          className={inputCls}
        />
      </label>
      {!layout && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Type</span>
            <select value={f.fieldtype} onChange={(e) => set("fieldtype", e.target.value)} className={inputCls}>
              <optgroup label="Common">{COMMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
              <optgroup label="All">{types.filter((t) => !COMMON_TYPES.includes(t) && !LAYOUT.has(t)).map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Field name</span>
            <input value={String(f.fieldname ?? "")} onChange={(e) => set("fieldname", scrub(e.target.value))} readOnly={!isNewField} className={`${inputCls} font-mono text-xs ${isNewField ? "" : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800"}`} />
          </label>
        </div>
      )}

      {!layout && (!!optionsHelp[f.fieldtype] || !!f.options) && (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-500">Options <span className="font-normal text-zinc-400">· {optionsHelp[f.fieldtype] ?? ""}</span></span>
          {["Link", "Table", "Table MultiSelect"].includes(f.fieldtype) ? (
            <LinkInput doctype="DocType" value={String(f.options ?? "")} onChange={(v) => set("options", v || null)} placeholder="DocType" getQuery={() => (f.fieldtype === "Link" ? undefined : { filters: { istable: 1 } })} />
          ) : f.fieldtype === "Select" ? (
            <textarea value={String(f.options ?? "")} onChange={(e) => set("options", e.target.value)} rows={4} className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          ) : (
            <input value={String(f.options ?? "")} onChange={(e) => set("options", e.target.value || null)} className={inputCls} />
          )}
        </label>
      )}

      {f.fieldtype === "Section Break" && <Check label="Collapsible" checked={!!f.collapsible} onChange={(v) => set("collapsible", v ? 1 : 0)} />}

      {!layout && (
        <div className="grid grid-cols-2 gap-x-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
          <Check label="Mandatory" checked={!!f.reqd} onChange={(v) => set("reqd", v ? 1 : 0)} />
          <Check label="In List View" checked={!!f.in_list_view} onChange={(v) => set("in_list_view", v ? 1 : 0)} />
          <Check label="Read Only" checked={!!f.read_only} onChange={(v) => set("read_only", v ? 1 : 0)} />
          <Check label="Standard Filter" checked={!!f.in_standard_filter} onChange={(v) => set("in_standard_filter", v ? 1 : 0)} />
          <Check label="Hidden" checked={!!f.hidden} onChange={(v) => set("hidden", v ? 1 : 0)} />
          <Check label="Unique" checked={!!f.unique} onChange={(v) => set("unique", v ? 1 : 0)} />
          <Check label="Bold" checked={!!f.bold} onChange={(v) => set("bold", v ? 1 : 0)} />
          <Check label="Quick Entry" checked={!!f.allow_in_quick_entry} onChange={(v) => set("allow_in_quick_entry", v ? 1 : 0)} />
        </div>
      )}

      {!layout && (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-zinc-500">Description</span>
          <textarea value={String(f.description ?? "")} onChange={(e) => set("description", e.target.value || null)} rows={2} className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </label>
      )}

      <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex w-full items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advanced ? "" : "-rotate-90"}`} /> Advanced
      </button>
      {advanced && (
        <div className="space-y-3">
          {[
            ["default", "Default"],
            ["depends_on", "Display depends on (JS)"],
            ["mandatory_depends_on", "Mandatory depends on (JS)"],
            ["read_only_depends_on", "Read only depends on (JS)"],
            ...(layout ? [] : [["fetch_from", "Fetch from (link_field.source_field)"], ["placeholder", "Placeholder"]]),
          ].map(([k, label]) => (
            <label key={k} className="block space-y-1">
              <span className="text-xs font-medium text-zinc-500">{label}</span>
              <input value={String(f[k] ?? "")} onChange={(e) => set(k, e.target.value || null)} className={`${inputCls} ${k.includes("depends") ? "font-mono text-xs" : ""}`} placeholder={k.includes("depends") ? "eval:doc.status == 'Open'" : ""} />
            </label>
          ))}
          {!layout && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-500">Length</span>
                <input type="number" value={String(f.length ?? "")} onChange={(e) => set("length", e.target.value ? Number(e.target.value) : 0)} className={inputCls} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-500">Grid columns (1–10)</span>
                <input type="number" min={0} max={10} value={String(f.columns ?? "")} onChange={(e) => set("columns", e.target.value ? Number(e.target.value) : 0)} className={inputCls} />
              </label>
            </div>
          )}
          {!layout && (
            <div className="grid grid-cols-2 gap-x-2">
              <Check label="Allow on Submit" checked={!!f.allow_on_submit} onChange={(v) => set("allow_on_submit", v ? 1 : 0)} />
              <Check label="No Copy" checked={!!f.no_copy} onChange={(v) => set("no_copy", v ? 1 : 0)} />
              <Check label="Set Only Once" checked={!!f.set_only_once} onChange={(v) => set("set_only_once", v ? 1 : 0)} />
              <Check label="Global Search" checked={!!f.in_global_search} onChange={(v) => set("in_global_search", v ? 1 : 0)} />
              <Check label="Fetch if Empty" checked={!!f.fetch_if_empty} onChange={(v) => set("fetch_if_empty", v ? 1 : 0)} />
              <Check label="Print Hide" checked={!!f.print_hide} onChange={(v) => set("print_hide", v ? 1 : 0)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FormBuilder({ ctl, table = "fields", childMeta, readOnly }: { ctl: FormController; table?: string; childMeta?: DocTypeMeta; readOnly?: boolean }) {
  const rows = ((ctl.getDoc()[table] as F[]) ?? []).filter(Boolean);
  const tabs = useMemo(() => build(rows), [rows]);
  const [tabIdx, setTabIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const types = useMemo(() => String(childMeta?.fields?.find((f) => f.fieldname === "fieldtype")?.options ?? COMMON_TYPES.join("\n")).split("\n").filter(Boolean), [childMeta]);
  const cdt = String(ctl.field(table)?.options ?? "DocField");
  const activeTab = tabs[Math.min(tabIdx, tabs.length - 1)];
  const sel = rows.find((r) => r.name === selected) ?? null;

  const commit = (next: Tab[]) => void ctl.set_value(table, flatten(next).map((r) => ({ ...r })));
  const newRow = (fieldtype: string, label = ""): F => ({ ...ctl.makeRow(table, { fieldtype, label, fieldname: label ? scrub(label) : "" }) }) as F;
  const clone = () => tabs.map((t) => ({ ...t, sections: t.sections.map((s) => ({ ...s, columns: s.columns.map((c) => ({ ...c, fields: [...c.fields] })) })) }));

  // read the controller's current rows each time — label + derived fieldname are two
  // writes in one keystroke, and a render-time snapshot would drop the first
  const setProp = (k: string, v: unknown) => {
    if (!sel) return;
    const current = ((ctl.getDoc()[table] as F[]) ?? []).filter(Boolean);
    void ctl.set_value(table, current.map((r) => (r.name === sel.name ? { ...r, [k]: v } : r)));
  };

  const addField = (si: number, ci: number) => {
    const next = clone();
    const f = newRow("Data", "New Field");
    // unique fieldname among existing
    const names = new Set(rows.map((r) => r.fieldname));
    let fn = "new_field";
    for (let i = 2; names.has(fn); i++) fn = `new_field_${i}`;
    f.fieldname = fn;
    next[tabIdx].sections[si].columns[ci].fields.push(f);
    commit(next);
    setSelected(f.name);
  };
  const addColumn = (si: number) => {
    const next = clone();
    next[tabIdx].sections[si].columns.push({ brk: newRow("Column Break"), fields: [] });
    commit(next);
  };
  const addSection = () => {
    const next = clone();
    next[tabIdx].sections.push({ brk: newRow("Section Break"), columns: [{ brk: null, fields: [] }] });
    commit(next);
  };
  const addTab = () => {
    const next = clone();
    if (!next[0].brk) next[0].brk = newRow("Tab Break", "Details");
    next.push({ brk: newRow("Tab Break", "New Tab"), sections: [{ brk: newRow("Section Break"), columns: [{ brk: null, fields: [] }] }] });
    commit(next);
    setTabIdx(next.length - 1);
  };
  const removeSelected = () => {
    if (!sel) return;
    void ctl.set_value(table, rows.filter((r) => r.name !== sel.name));
    setSelected(null);
  };
  const duplicateSelected = () => {
    if (!sel) return;
    const i = rows.findIndex((r) => r.name === sel.name);
    const copy = newRow(sel.fieldtype, `${sel.label ?? ""} copy`);
    Object.assign(copy, Object.fromEntries(Object.entries(sel).filter(([k]) => !["name", "idx", "fieldname", "label", "__islocal", "creation", "modified"].includes(k))));
    const next = [...rows];
    next.splice(i + 1, 0, copy);
    void ctl.set_value(table, next);
    setSelected(copy.name);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = clone();
    const t = next[tabIdx];
    let moving: F | null = null;
    for (const s of t.sections) for (const c of s.columns) {
      const i = c.fields.findIndex((f) => f.name === active.id);
      if (i >= 0) moving = c.fields.splice(i, 1)[0];
    }
    if (!moving) return;
    const overId = String(over.id);
    for (const s of t.sections) for (const c of s.columns) {
      if (overId === `col:${t.sections.indexOf(s)}:${s.columns.indexOf(c)}`) {
        c.fields.push(moving);
        commit(next);
        return;
      }
      const j = c.fields.findIndex((f) => f.name === overId);
      if (j >= 0) {
        c.fields.splice(j, 0, moving);
        commit(next);
        return;
      }
    }
  };

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 border-zinc-200 p-4 dark:border-zinc-800 lg:border-r">
        <div className="mb-4 flex flex-wrap items-center gap-1">
          {tabs.map((t, i) => (
            <button key={t.brk?.name ?? "default"} type="button" onClick={() => setTabIdx(i)} onDoubleClick={() => t.brk && setSelected(t.brk.name)} className={`rounded-md px-3 py-1.5 text-sm ${i === tabIdx ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
              {t.brk?.label || (i === 0 ? "Details" : "Tab")}
            </button>
          ))}
          {!readOnly && (
            <button type="button" onClick={addTab} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Plus className="h-3.5 w-3.5" /> Tab
            </button>
          )}
          {activeTab?.brk && (
            <button type="button" onClick={() => setSelected(activeTab.brk!.name)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">Tab properties</button>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {activeTab?.sections.map((s, si) => (
              <div key={s.brk?.name ?? `sec-${si}`} className="rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center gap-2">
                  <button type="button" onClick={() => s.brk && setSelected(s.brk.name)} className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    <LayoutPanelTop className="h-3.5 w-3.5 text-zinc-400" />
                    {s.brk?.label || <span className="font-normal text-zinc-400">Untitled section</span>}
                  </button>
                  {!readOnly && (
                    <button type="button" onClick={() => addColumn(si)} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Columns3 className="h-3.5 w-3.5" /> Column
                    </button>
                  )}
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${s.columns.length}, minmax(0, 1fr))` }}>
                  {s.columns.map((c, ci) => (
                    <SortableContext key={c.brk?.name ?? `col-${si}-${ci}`} id={`col:${si}:${ci}`} items={c.fields.map((f) => f.name)} strategy={verticalListSortingStrategy}>
                      <div className="flex min-h-16 flex-col gap-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/60">
                        {c.fields.map((f) => (
                          <FieldCard key={f.name} f={f} selected={selected === f.name} onSelect={() => setSelected(f.name)} />
                        ))}
                        {!readOnly && (
                          <button type="button" onClick={() => addField(si, ci)} className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:hover:text-zinc-200">
                            <Plus className="h-3.5 w-3.5" /> Add field
                          </button>
                        )}
                      </div>
                    </SortableContext>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DndContext>
        {!readOnly && (
          <button type="button" onClick={addSection} className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:hover:text-zinc-200">
            <Plus className="h-4 w-4" /> Add section
          </button>
        )}
      </div>

      <aside className="p-4 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
        {sel ? (
          <Properties f={sel} types={types} set={setProp} onDelete={removeSelected} onDuplicate={duplicateSelected} onClose={() => setSelected(null)} />
        ) : (
          <div className="space-y-3 text-sm text-zinc-500">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">{rows.filter((r) => !LAYOUT.has(r.fieldtype)).length} fields</p>
            <p>Select a field to edit its properties, drag cards to reorder, or use <b className="font-medium">Add field</b> in any column.</p>
            <p className="text-xs">Saved with the {cdt === "DocField" ? "DocType" : "form"} — press Save (⌘S) when done.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
