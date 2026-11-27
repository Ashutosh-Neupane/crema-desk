"use client";

/**
 * Visual form builder for DocType (and any meta with a `form_builder` HTML
 * field) — Crema's take on Desk v16's Form Builder:
 *  - left: field types in plain words (click or drag in)
 *  - canvas = tabs → sections → columns → field cards, as the form will render; drag a card onto a column, between
 *    columns (a new column is made), or onto a tab; live checks above it
 *  - right panel: essentials first (label, type, contextual options, move), then common toggles, then advanced
 * Edits are the DocType's `fields` rows (DocField) and save through Frappe.
 */
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { FormController } from "@/lib/form/FormController";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { frappeMethod } from "@/lib/frappe/client";
import { BuilderPalette } from "./BuilderPalette";
import { DragPreview, ProblemList, SectionCard, TabButton } from "./BuilderCanvas";
import { Properties } from "./BuilderProperties";
import { checkRows, checkTargets, linkTargets, type Problem } from "./builderChecks";
import { COMMON_TYPES, LAYOUT, build, collision, type F } from "./builderTree";
import { useBuilderActions } from "./useBuilderActions";

/** live checks (Desk form_builder store.js): local ones every render, Link / Table targets from the server */
function useProblems(rows: F[], off: boolean): Problem[] {
  const targets = linkTargets(rows);
  const found = useQuery({
    queryKey: ["builder-targets", targets],
    enabled: targets.length > 0 && !off,
    staleTime: 30_000,
    queryFn: async () => {
      const list = await frappeMethod<Array<{ name: string; istable: number }>>(
        "frappe.client.get_list",
        {
          doctype: "DocType",
          filters: [["name", "in", targets]],
          fields: ["name", "istable"],
          limit_page_length: 0,
        }
      );
      return new Map((list ?? []).map((d) => [d.name, { istable: !!d.istable }]));
    },
  });
  if (off) return [];
  return [...checkRows(rows), ...(found.data ? checkTargets(rows, found.data) : [])];
}

function EmptyPanel({ count, cdt }: { count: number; cdt: string }) {
  return (
    <div className="space-y-3 text-sm text-zinc-500">
      <p className="font-medium text-zinc-800 dark:text-zinc-100">{count} fields</p>
      <p>
        Select a field to edit its properties. Drag a card to reorder it, onto another column, to
        the edge of a section for a new column beside it, or onto a tab.
      </p>
      <p className="text-xs">
        Saved with the {cdt === "DocField" ? "DocType" : "form"} — press Save (⌘S) when done.
      </p>
    </div>
  );
}

const addBtn =
  "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800";

export default function FormBuilder({
  ctl,
  table = "fields",
  childMeta,
  readOnly,
}: {
  ctl: FormController;
  table?: string;
  childMeta?: DocTypeMeta;
  readOnly?: boolean;
}) {
  const rows = ((ctl.getDoc()[table] as F[]) ?? []).filter(Boolean);
  const tabs = useMemo(() => build(rows), [rows]);
  const [tabIdx, setTabIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const types = useMemo(
    () =>
      String(
        childMeta?.fields?.find((f) => f.fieldname === "fieldtype")?.options ??
          COMMON_TYPES.join("\n")
      )
        .split("\n")
        .filter(Boolean),
    [childMeta]
  );
  const cdt = String(ctl.field(table)?.options ?? "DocField");
  const ti = Math.min(tabIdx, tabs.length - 1);
  const activeTab = tabs[ti];
  const sel = rows.find((r) => r.name === selected) ?? null;
  const act = useBuilderActions({
    ctl,
    table,
    rows,
    tabs,
    tabIdx: ti,
    setTabIdx,
    sel,
    setSelected,
  });
  const problems = useProblems(rows, !!readOnly);

  // read the controller's current rows each time — label + derived fieldname are two
  // writes in one keystroke, and a render-time snapshot would drop the first
  const setProp = (k: string, v: unknown) => {
    if (!sel) return;
    const current = ((ctl.getDoc()[table] as F[]) ?? []).filter(Boolean);
    void ctl.set_value(
      table,
      current.map((r) => (r.name === sel.name ? { ...r, [k]: v } : r))
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={act.onDragStart}
      onDragEnd={act.onDragEnd}
      onDragCancel={act.cancelDrag}
    >
      <div
        className={`grid grid-cols-1 gap-0 ${readOnly ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : "lg:grid-cols-[11.5rem_minmax(0,1fr)_21rem]"}`}
      >
        {!readOnly && (
          <div className="border-zinc-200 p-3 dark:border-zinc-800 lg:border-r">
            <BuilderPalette onAdd={act.addOfType} />
          </div>
        )}
        <div className="min-w-0 border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40 lg:border-r">
          <ProblemList problems={problems} onPick={setSelected} />
          <div className="mb-4 flex flex-wrap items-center gap-1">
            {tabs.map((t, i) => (
              <TabButton
                key={t.brk?.name ?? "default"}
                id={`tab:${i}`}
                active={i === ti}
                label={t.brk?.label || (i === 0 ? "Details" : "Tab")}
                onClick={() => setTabIdx(i)}
                onDoubleClick={() => t.brk && setSelected(t.brk.name)}
              />
            ))}
            {!readOnly && (
              <button type="button" onClick={act.addTab} className={addBtn}>
                <Plus className="h-3.5 w-3.5" /> Tab
              </button>
            )}
            {activeTab?.brk && (
              <button
                type="button"
                onClick={() => setSelected(activeTab.brk!.name)}
                className="ml-auto text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Tab properties
              </button>
            )}
          </div>

          <div className="space-y-4">
            {activeTab?.sections.map((s, si) => (
              <SectionCard
                key={s.brk?.name ?? `sec-${si}`}
                s={s}
                si={si}
                selected={selected}
                dragging={!!act.dragging}
                readOnly={readOnly}
                onSelect={setSelected}
                onAddColumn={() => act.addColumn(si)}
                onAddField={(ci) => act.addField(si, ci)}
                onRemoveColumn={(ci) => act.removeColumn(si, ci)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {act.dragging ? <DragPreview f={act.dragging} /> : null}
          </DragOverlay>
          {!readOnly && (
            <button
              type="button"
              onClick={act.addSection}
              className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-white/60 py-2.5 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-white hover:text-zinc-800 dark:border-zinc-700 dark:bg-transparent dark:hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add section
            </button>
          )}
        </div>

        <aside className="p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          {sel ? (
            <Properties
              key={sel.name}
              f={sel}
              types={types}
              set={setProp}
              onDelete={act.removeSelected}
              onDuplicate={act.duplicateSelected}
              onClose={() => setSelected(null)}
              move={readOnly ? undefined : act.move}
            />
          ) : (
            <EmptyPanel count={rows.filter((r) => !LAYOUT.has(r.fieldtype)).length} cdt={cdt} />
          )}
        </aside>
      </div>
    </DndContext>
  );
}
