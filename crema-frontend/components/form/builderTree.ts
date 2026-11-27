/**
 * The form builder's model: flat DocField rows ⇄ tabs → sections → columns → fields, and the pure edits on it
 * (Desk form_builder/store.js keeps the same tree).
 */
import { closestCenter, pointerWithin, type CollisionDetection } from "@dnd-kit/core";
import type { Row } from "@/lib/form/FormController";

export type F = Row & { fieldtype: string; label?: string; fieldname?: string };
export interface Column {
  brk: F | null;
  fields: F[];
}
export interface Section {
  brk: F | null;
  columns: Column[];
}
export interface Tab {
  brk: F | null;
  sections: Section[];
}

export const LAYOUT = new Set(["Tab Break", "Section Break", "Column Break"]);
export const COMMON_TYPES = [
  "Data",
  "Link",
  "Select",
  "Int",
  "Float",
  "Currency",
  "Check",
  "Date",
  "Datetime",
  "Small Text",
  "Text Editor",
  "Table",
  "Attach",
  "Attach Image",
];

export const scrub = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 61) || "field";

/** flat DocField rows → tabs/sections/columns */
export function build(rows: F[]): Tab[] {
  const tabs: Tab[] = [
    { brk: null, sections: [{ brk: null, columns: [{ brk: null, fields: [] }] }] },
  ];
  const tab = () => tabs[tabs.length - 1];
  const sec = () => tab().sections[tab().sections.length - 1];
  const col = () => sec().columns[sec().columns.length - 1];
  for (const r of rows) {
    if (r.fieldtype === "Tab Break") {
      // a leading Tab Break replaces the implicit first tab when it's still empty
      const t = tab();
      if (
        tabs.length === 1 &&
        !t.brk &&
        t.sections.every((s) => s.columns.every((c) => !c.fields.length))
      )
        t.brk = r;
      else tabs.push({ brk: r, sections: [{ brk: null, columns: [{ brk: null, fields: [] }] }] });
    } else if (r.fieldtype === "Section Break") {
      const t = tab();
      const only =
        t.sections.length === 1 &&
        !t.sections[0].brk &&
        t.sections[0].columns.every((c) => !c.fields.length);
      if (only) t.sections[0].brk = r;
      else t.sections.push({ brk: r, columns: [{ brk: null, fields: [] }] });
    } else if (r.fieldtype === "Column Break") {
      sec().columns.push({ brk: r, fields: [] });
    } else col().fields.push(r);
  }
  return tabs;
}

export function flatten(tabs: Tab[]): F[] {
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

/** where a field sits in a tab: section, column and how many columns that section has */
export function locate(
  tab: Tab | undefined,
  name: string
): { si: number; ci: number; count: number } | null {
  for (const [si, sec] of (tab?.sections ?? []).entries())
    for (const [ci, c] of sec.columns.entries())
      if (c.fields.some((f) => f.name === name)) return { si, ci, count: sec.columns.length };
  return null;
}

/** a deep enough copy to edit: tabs, sections, columns and their field lists */
export const cloneTabs = (tabs: Tab[]): Tab[] =>
  tabs.map((t) => ({
    ...t,
    sections: t.sections.map((s) => ({
      ...s,
      columns: s.columns.map((c) => ({ ...c, fields: [...c.fields] })),
    })),
  }));

/** take a field out of the tabs (mutates); returns it, or null */
export function takeOut(tabs: Tab[], id: string): F | null {
  for (const t of tabs)
    for (const sec of t.sections)
      for (const c of sec.columns) {
        const i = c.fields.findIndex((f) => f.name === id);
        if (i >= 0) return c.fields.splice(i, 1)[0];
      }
  return null;
}

/** put `field` in a new column at position `at` (mutates); the Column Break row comes from `brk` */
export function insertColumn(cols: Column[], at: number, field: F, brk: () => F) {
  if (at === 0) {
    // the first column has no break of its own: the old first column gets one and the field leads
    cols[0] = { ...cols[0], brk: cols[0].brk ?? brk() };
    cols.unshift({ brk: null, fields: [field] });
  } else cols.splice(at, 0, { brk: brk(), fields: [field] });
}

/** put `field` before the field named `before` in the tab (mutates); false when it isn't there */
export function insertBefore(tab: Tab, before: string, field: F): boolean {
  for (const sec of tab.sections)
    for (const c of sec.columns) {
      const j = c.fields.findIndex((f) => f.name === before);
      if (j >= 0) {
        c.fields.splice(j, 0, field);
        return true;
      }
    }
  return false;
}

/** put `field` after `after` (when given and found), else at the end of the tab's last column (mutates) */
export function insertAfter(tab: Tab, after: string | null, field: F) {
  const at = after ? locate(tab, after) : null;
  if (at) {
    const col = tab.sections[at.si].columns[at.ci];
    col.fields.splice(col.fields.findIndex((x) => x.name === after) + 1, 0, field);
    return;
  }
  const last = tab.sections[tab.sections.length - 1];
  last.columns[last.columns.length - 1].fields.push(field);
}

// gaps and tabs win when the pointer is inside them (they are small); otherwise the nearest card or column
export const collision: CollisionDetection = (args) => {
  const inside = pointerWithin(args);
  const special = inside.filter((c) => /^(newcol|tab):/.test(String(c.id)));
  if (special.length) return special;
  return inside.length ? inside : closestCenter(args);
};
