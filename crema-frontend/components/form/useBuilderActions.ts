"use client";

/**
 * Edits the form builder makes on the DocType's rows: add / move / remove fields, columns, sections and tabs.
 * Every edit works on a copy of the tree and writes the flattened rows back through the form controller.
 */
import { useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { FormController } from "@/lib/form/FormController";
import { freshFieldname, paletteLabel } from "./builderChecks";
import {
  cloneTabs,
  flatten,
  insertAfter,
  insertBefore,
  insertColumn,
  locate,
  scrub,
  takeOut,
  type F,
  type Tab,
} from "./builderTree";
import type { MoveActions } from "./BuilderProperties";

const PALETTE = "palette:";
const emptySection = (brk: F | null) => ({ brk, columns: [{ brk: null, fields: [] as F[] }] });

export function useBuilderActions({
  ctl,
  table,
  rows,
  tabs,
  tabIdx,
  setTabIdx,
  sel,
  setSelected,
}: {
  ctl: FormController;
  table: string;
  rows: F[];
  tabs: Tab[];
  tabIdx: number;
  setTabIdx: (i: number) => void;
  sel: F | null;
  setSelected: (n: string | null) => void;
}) {
  const [dragging, setDragging] = useState<F | null>(null);
  const commit = (next: Tab[]) =>
    void ctl.set_value(
      table,
      flatten(next).map((r) => ({ ...r }))
    );
  const newRow = (fieldtype: string, label = ""): F =>
    ({ ...ctl.makeRow(table, { fieldtype, label, fieldname: label ? scrub(label) : "" }) }) as F;
  const colBreak = () => newRow("Column Break");
  /** a new field with a label and an unused field name */
  const freshField = (type: string, label = paletteLabel(type)): F => {
    const f = newRow(type, label);
    f.fieldname = freshFieldname(label, new Set(rows.map((r) => r.fieldname)));
    return f;
  };
  const edit = (fn: (next: Tab[]) => boolean | void) => {
    const next = cloneTabs(tabs);
    if (fn(next) !== false) commit(next);
  };

  const addField = (si: number, ci: number) => {
    const f = freshField("Data", "New Field");
    edit((next) => void next[tabIdx].sections[si].columns[ci].fields.push(f));
    setSelected(f.name);
  };
  const addColumn = (si: number) =>
    edit((next) => void next[tabIdx].sections[si].columns.push({ brk: colBreak(), fields: [] }));
  const addSection = () =>
    edit((next) => void next[tabIdx].sections.push(emptySection(newRow("Section Break"))));
  const addTab = () => {
    edit((next) => {
      if (!next[0].brk) next[0].brk = newRow("Tab Break", "Details");
      next.push({
        brk: newRow("Tab Break", "New Tab"),
        sections: [emptySection(newRow("Section Break"))],
      });
    });
    setTabIdx(tabs.length);
  };
  const removeColumn = (si: number, ci: number) =>
    edit((next) => {
      const cols = next[tabIdx].sections[si].columns;
      if (cols[ci].fields.length || cols.length < 2) return false;
      cols.splice(ci, 1);
      if (ci === 0) cols[0] = { ...cols[0], brk: null };
    });
  const removeSelected = () => {
    if (!sel) return;
    void ctl.set_value(
      table,
      rows.filter((r) => r.name !== sel.name)
    );
    setSelected(null);
  };
  const duplicateSelected = () => {
    if (!sel) return;
    const copy = newRow(sel.fieldtype, `${sel.label ?? ""} copy`);
    const skip = new Set([
      "name",
      "idx",
      "fieldname",
      "label",
      "__islocal",
      "creation",
      "modified",
    ]);
    Object.assign(copy, Object.fromEntries(Object.entries(sel).filter(([k]) => !skip.has(k))));
    const next = [...rows];
    next.splice(rows.findIndex((r) => r.name === sel.name) + 1, 0, copy);
    void ctl.set_value(table, next);
    setSelected(copy.name);
  };

  /** palette click: after the selected field, else at the end of the tab */
  const addOfType = (type: string) => {
    if (type === "Section Break") return addSection();
    const f = freshField(type);
    edit((next) => insertAfter(next[tabIdx], sel?.name ?? null, f));
    setSelected(f.name);
  };

  /** drop `id` (a field, or palette:<type>) on `target` (see the drop target ids in BuilderCanvas) */
  const moveTo = (id: string, target: string) => {
    if (id === `${PALETTE}Section Break`) return addSection();
    const [kind, a, b] = target.split(":");
    const fromPalette = id.startsWith(PALETTE);
    edit((next) => {
      const field = fromPalette ? freshField(id.slice(PALETTE.length)) : takeOut(next, id);
      if (!field) return false;
      if (fromPalette) setSelected(field.name);
      if (kind === "col") next[tabIdx].sections[Number(a)].columns[Number(b)].fields.push(field);
      else if (kind === "newcol")
        insertColumn(next[tabIdx].sections[Number(a)].columns, Number(b), field, colBreak);
      else if (kind === "tab") {
        next[Number(a)].sections[0].columns[0].fields.push(field);
        setTabIdx(Number(a));
      } else return insertBefore(next[tabIdx], target, field);
    });
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const type = id.startsWith(PALETTE) ? id.slice(PALETTE.length) : null;
    setDragging(
      type
        ? ({ name: id, fieldtype: type, label: paletteLabel(type) } as F)
        : (rows.find((r) => r.name === id) ?? null)
    );
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (e.over && e.active.id !== e.over.id) moveTo(String(e.active.id), String(e.over.id));
  };

  // keyboard / panel alternative to dragging (WCAG 2.5.7)
  const at = sel ? locate(tabs[tabIdx], sel.name) : null;
  const move: MoveActions | undefined =
    sel && at
      ? {
          left: at.ci > 0 ? () => moveTo(sel.name, `col:${at.si}:${at.ci - 1}`) : undefined,
          right:
            at.ci < at.count - 1 ? () => moveTo(sel.name, `col:${at.si}:${at.ci + 1}`) : undefined,
          newColumn: () => moveTo(sel.name, `newcol:${at.si}:${at.ci + 1}`),
        }
      : undefined;

  return {
    dragging,
    cancelDrag: () => setDragging(null),
    onDragStart,
    onDragEnd,
    addField,
    addColumn,
    addSection,
    addTab,
    removeColumn,
    removeSelected,
    duplicateSelected,
    addOfType,
    move,
  };
}
