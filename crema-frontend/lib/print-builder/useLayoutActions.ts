"use client";

/**
 * The Print Format Builder's edits to the layout (docs/GAPS.md § 2.19 B), each one a single undoable step:
 * add a field or block after the selection, remove (with Undo in the toast), duplicate, move, insert sections.
 * Also the builder's keyboard: Delete / Backspace, ⌘D, ⌘Z, ⇧⌘Z / ⌘Y, Escape — not while typing.
 */
import { useCallback, useEffect, useEffectEvent, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import type { DocField } from "@/lib/frappe/types";
import {
  addField,
  duplicateField,
  fieldFromDocField,
  insertSection,
  moveField,
  moveSection,
  newSection,
  removeField,
  removeSection,
  setColumnCount,
  updateSection,
  type PFField,
  type PFLayout,
  type SectionKey,
  type Selection,
} from "@/lib/print-builder/layout";
import type { PFSettings } from "@/lib/print-builder/useBuilder";

type Snapshot = { layout: PFLayout; settings: PFSettings };
interface Args {
  layout: PFLayout;
  edit: (fn: (s: Snapshot) => Snapshot) => void;
  undo: () => void;
  readOnly: boolean;
  selection: Selection;
  setSelection: Dispatch<SetStateAction<Selection>>;
  /** back to the sheet after an add, so the new field shows */
  onAdded: () => void;
}

/** a DocField from the field list becomes a print field; Table fields bring their child DocType's columns */
async function toPrintField(field: PFField | DocField): Promise<PFField> {
  if (!("parent" in field) && "custom" in field) return field as PFField;
  const df = field as DocField;
  const isTable = df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect";
  const child = isTable ? await fetchDoctypeMetaClient(String(df.options)).catch(() => undefined) : undefined;
  return fieldFromDocField(df, child);
}

export function useLayoutActions({ layout, edit, undo, readOnly, selection, setSelection, onAdded }: Args) {
  const setLayout = useCallback((fn: (l: PFLayout) => PFLayout) => edit((s) => ({ ...s, layout: fn(s.layout) })), [edit]);
  const setSetting = (k: string, v: unknown) => edit((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  const undoToast = (msg: string) => toast(msg, { action: { label: "Undo", onClick: () => undo() } });

  const removeFieldAt = (s: SectionKey, c: number, f: number) => {
    const { sectionRemoved } = removeField(layout, s, c, f);
    setLayout((l) => removeField(l, s, c, f).layout);
    setSelection(null);
    undoToast(sectionRemoved ? "Field and its empty section removed" : "Field removed");
  };
  const removeSectionAt = (s: number) => {
    setLayout((l) => removeSection(l, s));
    setSelection(null);
    undoToast("Section removed");
  };
  const removeSelected = () => {
    if (selection?.kind === "field") removeFieldAt(selection.s, selection.c, selection.f);
    else if (selection && typeof selection.s === "number") removeSectionAt(selection.s);
  };
  const duplicateSelected = () => {
    if (selection?.kind !== "field") return;
    const { layout: next, selection: sel } = duplicateField(layout, selection.s, selection.c, selection.f);
    setLayout(() => next);
    setSelection(sel);
  };
  const add = async (field: PFField | DocField) => {
    if (readOnly) return;
    const f = await toPrintField(field);
    const { layout: next, selection: sel } = addField(layout, f, selection);
    setLayout(() => next);
    setSelection(sel);
    onAdded();
  };
  const addSection = (pageBreak: boolean) => {
    const at = selection && typeof selection.s === "number" ? selection.s + 1 : layout.sections.length;
    setLayout((l) => insertSection(l, at, newSection(pageBreak)));
    setSelection({ kind: "section", s: at });
    onAdded();
  };

  const canvas = {
    onRemoveField: removeFieldAt,
    onRemoveSection: removeSectionAt,
    onColumns: (s: SectionKey, n: number) => setLayout((l) => updateSection(l, s, (sec) => setColumnCount(sec, n))),
    onInsertSection: (at: number) => {
      setLayout((l) => insertSection(l, at));
      setSelection({ kind: "section", s: at });
    },
    onMoveSection: (from: number, to: number) => {
      setLayout((l) => moveSection(l, from, to));
      setSelection(null);
    },
    onMoveField: (from: { s: SectionKey; c: number; f: number }, to: { s: SectionKey; c: number; at?: number }) => {
      setLayout((l) => moveField(l, from, to));
      setSelection(null);
    },
  };

  return { setLayout, setSetting, removeSelected, duplicateSelected, add, addSection, canvas };
}

/** the builder's document-wide shortcuts; skipped while typing in a field or code editor */
export function useBuilderKeys({ undo, redo, canDelete, canDuplicate, onDelete, onDuplicate, onEscape }: { undo: () => void; redo: () => void; canDelete: boolean; canDuplicate: boolean; onDelete: () => void; onDuplicate: () => void; onEscape: () => void }) {
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable=true], .cm-editor")) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && e.key === "d" && canDuplicate) {
      e.preventDefault();
      onDuplicate();
    } else if (mod && e.key === "y") {
      e.preventDefault();
      redo();
    } else if ((e.key === "Delete" || e.key === "Backspace") && canDelete) {
      e.preventDefault();
      onDelete();
    } else if (e.key === "Escape") onEscape();
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
}
