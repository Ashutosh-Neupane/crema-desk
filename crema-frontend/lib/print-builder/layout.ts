/**
 * Print Format Builder layout (docs/GAPS.md § 2.19 B): the same JSON Desk's v16 builder keeps in `format_data`
 * (frappe/public/js/print_format_builder/utils.js): `sections[] → columns[] → fields[]`, plus `header` / `footer`
 * zones (one section-like object each). Crema edits the keys it knows and keeps every other key as it came, so a
 * format can go back and forth between Crema and Desk without losing styling.
 * All helpers are pure: they return a new layout and never touch the one passed in.
 */
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

export type PFField = Record<string, unknown> & { fieldname: string; label?: string; fieldtype: string; remove?: boolean };
export type PFColumn = Record<string, unknown> & { label?: string; fields: PFField[] };
export type PFSection = Record<string, unknown> & { label?: string; columns: PFColumn[]; page_break?: boolean };
export interface PFLayout {
  sections: PFSection[];
  header?: PFSection;
  footer?: PFSection;
  [k: string]: unknown;
}

/** Print Format fields a builder draft may hold (print_format.py BUILDER_DRAFT_FIELDS) */
export const DRAFT_FIELDS = [
  "format_data", "font", "font_size", "page_number", "show_label_colon", "margin_top", "margin_bottom", "margin_left",
  "margin_right", "label_color", "value_color", "css", "classic_format_data", "print_format_builder",
  "print_format_builder_beta", "pdf_generator",
] as const;

/** where a section lives: a body index, or the header / footer zone */
export type SectionKey = number | "header" | "footer";
export type Selection = null | { kind: "section"; s: SectionKey } | { kind: "field"; s: SectionKey; c: number; f: number };

const rand = () => Math.random().toString(36).slice(2, 10);
const emptyZone = (): PFSection => ({ columns: [{ label: "", fields: [] }] });
export const newSection = (pageBreak = false): PFSection => ({ label: "", columns: [{ label: "", fields: [] }], ...(pageBreak ? { page_break: true } : {}) });

/** format_data → layout; null for a classic (array) layout, which only Desk can convert */
export function parseLayout(formatData: unknown): PFLayout | null {
  let v: unknown = formatData;
  if (typeof v === "string") {
    if (!v.trim()) v = null;
    else {
      try {
        v = JSON.parse(v);
      } catch {
        return null;
      }
    }
  }
  if (v == null) return { sections: [], header: emptyZone(), footer: emptyZone() };
  if (Array.isArray(v) || typeof v !== "object") return null;
  const l = v as PFLayout;
  const fix = (sec: PFSection): PFSection => ({ ...sec, columns: (sec.columns?.length ? sec.columns : [{ label: "", fields: [] }]).map((c) => ({ ...c, fields: (c.fields ?? []).filter((f) => !f.remove) })) });
  return {
    ...l,
    sections: (l.sections ?? []).filter((s) => !s.remove).map(fix),
    header: fix(l.header ?? emptyZone()),
    footer: fix(l.footer ?? emptyZone()),
  };
}

export const serializeLayout = (l: PFLayout): string => JSON.stringify(l);

export function getSection(l: PFLayout, s: SectionKey): PFSection | undefined {
  return typeof s === "number" ? l.sections[s] : l[s];
}

/** copy of the layout with section `s` replaced by `fn(section)` */
export function updateSection(l: PFLayout, s: SectionKey, fn: (sec: PFSection) => PFSection): PFLayout {
  if (typeof s === "number") return { ...l, sections: l.sections.map((sec, i) => (i === s ? fn(sec) : sec)) };
  return { ...l, [s]: fn(l[s] ?? emptyZone()) };
}

export function updateField(l: PFLayout, s: SectionKey, c: number, f: number, patch: Partial<PFField>): PFLayout {
  return updateSection(l, s, (sec) => ({
    ...sec,
    columns: sec.columns.map((col, ci) => (ci !== c ? col : { ...col, fields: col.fields.map((fd, fi) => (fi === f ? ({ ...fd, ...patch } as PFField) : fd)) })),
  }));
}

/** Set the number of columns (1–4). Fields of dropped columns move into the last one kept, nothing is lost. */
export function setColumnCount(sec: PFSection, n: number): PFSection {
  const cols = sec.columns.slice(0, n);
  while (cols.length < n) cols.push({ label: "", fields: [] });
  const spill = sec.columns.slice(n).flatMap((c) => c.fields);
  if (spill.length) cols[n - 1] = { ...cols[n - 1], fields: [...cols[n - 1].fields, ...spill] };
  return { ...sec, columns: cols };
}

/**
 * Remove a field. Crema goes one step past Desk: when that was the last field of a body section, the section goes
 * too (an empty section prints nothing and was the reason "remove doesn't work" — GAPS § 2.19). Returns the new
 * layout and whether the section was dropped.
 */
export function removeField(l: PFLayout, s: SectionKey, c: number, f: number): { layout: PFLayout; sectionRemoved: boolean } {
  const next = updateSection(l, s, (sec) => ({ ...sec, columns: sec.columns.map((col, ci) => (ci === c ? { ...col, fields: col.fields.filter((_, fi) => fi !== f) } : col)) }));
  const sec = getSection(next, s);
  if (typeof s === "number" && sec && !sec.page_break && sec.columns.every((col) => col.fields.length === 0)) {
    return { layout: removeSection(next, s), sectionRemoved: true };
  }
  return { layout: next, sectionRemoved: false };
}

/** Copy a field right after itself; a custom block gets a fresh fieldname (Desk: "Duplicate"). */
export function duplicateField(l: PFLayout, s: SectionKey, c: number, f: number): { layout: PFLayout; selection: Selection } {
  const field = getSection(l, s)?.columns[c]?.fields[f];
  if (!field) return { layout: l, selection: null };
  const copy: PFField = { ...field, ...(field.custom ? { fieldname: `${field.fieldname.replace(/_[a-z0-9]{8}$/, "")}_${rand()}` } : {}) };
  return addField(l, copy, { kind: "field", s, c, f });
}

export function removeSection(l: PFLayout, s: number): PFLayout {
  return { ...l, sections: l.sections.filter((_, i) => i !== s) };
}

export function insertSection(l: PFLayout, at: number, sec: PFSection = newSection()): PFLayout {
  const sections = [...l.sections];
  sections.splice(Math.max(0, Math.min(at, sections.length)), 0, sec);
  return { ...l, sections };
}

export function moveSection(l: PFLayout, from: number, to: number): PFLayout {
  if (from === to) return l;
  const sections = [...l.sections];
  const [sec] = sections.splice(from, 1);
  sections.splice(to, 0, sec);
  return { ...l, sections };
}

/** Move a field to (s, c) before index `at` (end when undefined). Indexes are of the layout before the move. */
export function moveField(l: PFLayout, from: { s: SectionKey; c: number; f: number }, to: { s: SectionKey; c: number; at?: number }): PFLayout {
  const field = getSection(l, from.s)?.columns[from.c]?.fields[from.f];
  if (!field) return l;
  let at = to.at;
  if (at !== undefined && from.s === to.s && from.c === to.c && from.f < at) at -= 1;
  // take it out without the empty-section rule (it is going somewhere else)
  let next = updateSection(l, from.s, (sec) => ({ ...sec, columns: sec.columns.map((col, ci) => (ci === from.c ? { ...col, fields: col.fields.filter((_, fi) => fi !== from.f) } : col)) }));
  next = updateSection(next, to.s, (sec) => ({
    ...sec,
    columns: sec.columns.map((col, ci) => {
      if (ci !== to.c) return col;
      const fields = [...col.fields];
      fields.splice(at === undefined ? fields.length : Math.max(0, Math.min(at, fields.length)), 0, field);
      return { ...col, fields };
    }),
  }));
  return next;
}

/** Insert a field after the selection, else at the end of the selected section, else of the last section (Desk add_to_layout) */
export function addField(l: PFLayout, field: PFField, sel: Selection): { layout: PFLayout; selection: Selection } {
  if (sel?.kind === "field") {
    const next = updateSection(l, sel.s, (sec) => ({ ...sec, columns: sec.columns.map((col, ci) => (ci === sel.c ? { ...col, fields: [...col.fields.slice(0, sel.f + 1), field, ...col.fields.slice(sel.f + 1)] } : col)) }));
    return { layout: next, selection: { kind: "field", s: sel.s, c: sel.c, f: sel.f + 1 } };
  }
  let s: SectionKey = sel?.kind === "section" ? sel.s : l.sections.length - 1;
  let base = l;
  if (s === -1) {
    base = insertSection(l, 0);
    s = 0;
  }
  const sec = getSection(base, s)!;
  const c = sec.columns.length - 1;
  const next = updateSection(base, s, (x) => ({ ...x, columns: x.columns.map((col, ci) => (ci === c ? { ...col, fields: [...col.fields, field] } : col)) }));
  return { layout: next, selection: { kind: "field", s, c, f: sec.columns[c].fields.length } };
}

export type TableColumn = { label?: string | null; fieldname: string; fieldtype?: string; options?: string | null; width?: number };

/** child-table fields a Table block can show as columns */
export const tableColumnChoices = (childMeta: DocTypeMeta) =>
  (childMeta.fields ?? []).filter((tf) => tf.fieldname && !["Section Break", "Column Break", "Tab Break", "HTML", "Button"].includes(tf.fieldtype));

/** Paper sizes for the sheet and the preview; a preview-time Print Settings override, not stored in the format */
export const PAPERS: Array<{ key: string; label: string; width: number; height: number; settings: Record<string, unknown> }> = [
  { key: "A4", label: "A4", width: 210, height: 297, settings: { pdf_page_size: "A4" } },
  { key: "A5", label: "A5", width: 148, height: 210, settings: { pdf_page_size: "A5" } },
  { key: "Letter", label: "Letter", width: 215.9, height: 279.4, settings: { pdf_page_size: "Letter" } },
  { key: "Legal", label: "Legal", width: 215.9, height: 355.6, settings: { pdf_page_size: "Legal" } },
  { key: "thermal80", label: "Receipt 80 mm", width: 80, height: 297, settings: { pdf_page_size: "Custom", pdf_page_width: 80, pdf_page_height: 297 } },
];

/** Is this DocField worth offering in the Fields list (Desk is_printable_docfield) */
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Image", "Fold", "Heading"]);
export const isPrintable = (df: DocField) => !!df.fieldname && (!NO_VALUE.has(df.fieldtype) || df.fieldtype === "Table");

/** DocType field → layout field; Table fields get their columns like Desk get_table_columns */
export function fieldFromDocField(df: DocField, childMeta?: DocTypeMeta): PFField {
  const f: PFField = { label: df.label ?? df.fieldname, fieldname: df.fieldname, fieldtype: df.fieldtype, options: df.options };
  if ((df.fieldtype === "Table" || df.fieldtype === "Table MultiSelect") && childMeta) {
    let cols = (childMeta.fields ?? []).filter((tf) => tf.fieldname && !["Section Break", "Column Break", "Tab Break"].includes(tf.fieldtype) && !tf.print_hide);
    if (cols.some((tf) => tf.in_list_view)) cols = cols.filter((tf) => tf.in_list_view);
    const table_columns: Array<Record<string, unknown>> = [];
    let total = 0;
    for (const tf of cols) {
      if (total >= 100) break;
      const w = typeof tf.width === "number" && tf.width < 100 ? tf.width : tf.width ? 20 : 10;
      table_columns.push({ label: tf.label, fieldname: tf.fieldname, fieldtype: tf.fieldtype, options: tf.options, width: w });
      total += w;
    }
    f.table_columns = table_columns;
  }
  return f;
}

/** Blocks tab (Desk PrintFormatControls draggable_blocks): fieldtypes the server templates render */
export const BLOCKS: Array<{ key: string; label: string; desc: string; make: () => PFField }> = [
  { key: "static_text", label: "Text", desc: "Fixed text like a title or a note", make: () => ({ label: "Text", fieldname: `static_text_${rand()}`, fieldtype: "Static Text", custom: 1, text: "" }) },
  { key: "custom_html", label: "Custom HTML", desc: "HTML or a Jinja template", make: () => ({ label: "Custom HTML", fieldname: `custom_html_${rand()}`, fieldtype: "HTML", custom: 1, html: "" }) },
  { key: "spacer", label: "Spacer", desc: "Vertical whitespace", make: () => ({ label: "Spacer", fieldname: `spacer_${rand()}`, fieldtype: "Spacer", custom: 1, height: 10 }) },
  { key: "divider", label: "Divider", desc: "Horizontal rule", make: () => ({ label: "Divider", fieldname: `divider_${rand()}`, fieldtype: "Divider", custom: 1 }) },
  { key: "image", label: "Image", desc: "An image from a URL", make: () => ({ label: "Image", fieldname: `image_${rand()}`, fieldtype: "Image", custom: 1, image_url: "", width: "" }) },
  {
    key: "barcode",
    label: "Barcode / QR",
    desc: "From a field or a fixed value",
    make: () => ({ label: "Barcode", fieldname: `barcode_${rand()}`, fieldtype: "Barcode", custom: 1, barcode_field: "", barcode_value: "", barcode_format: "CODE128", show_text: true, width: "" }),
  },
];

export const fieldKey = (s: SectionKey, c: number, f: number) => `f|${s}|${c}|${f}`;
export const columnKey = (s: SectionKey, c: number) => `c|${s}|${c}`;
export function parseKey(k: string): { kind: "f" | "c" | "s"; s: SectionKey; c: number; f: number } {
  const [kind, s, c, f] = k.split("|");
  return { kind: kind as "f" | "c" | "s", s: s === "header" || s === "footer" ? s : Number(s), c: Number(c ?? 0), f: Number(f ?? 0) };
}
