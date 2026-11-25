"use client";

/**
 * Grid keyboard and paste, like Desk (grid_row.js set_arrow_keys, controls/table.js paste). Cells carry
 * data-cell="<row index>:<column index>".
 */
import { useRef } from "react";
import { toast } from "sonner";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import { FOCUSABLE, NO_VALUE, PAGE_SIZE, TEXTY, copyOf, isBlankRow, parseCsv, pastedValue } from "@/components/form/gridData";

interface GridKeysInput {
  ctl: FormController;
  table: string;
  label: string;
  meta: DocTypeMeta;
  rows: Row[];
  cols: DocField[];
  curPage: number;
  setPage: (p: number) => void;
  readOnly: boolean;
  cannotAdd: boolean;
  cannotDelete: boolean;
}

type At = { r: number; col: number };

export function useGridKeys({ ctl, table, label, meta, rows, cols, curPage, setPage, readOnly, cannotAdd, cannotDelete }: GridKeysInput) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const tableRows = () => (ctl.getDoc()[table] as Row[]) ?? [];

  const cellAt = (el: EventTarget | null): At | null => {
    const c = (el as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
    if (!c || !bodyRef.current?.contains(c)) return null;
    const [r, col] = c.dataset.cell!.split(":").map(Number);
    return { r, col };
  };
  /** columns of row `r` holding an enabled input, in order */
  const editableCols = (r: number) =>
    [...(bodyRef.current?.querySelectorAll<HTMLElement>(`[data-cell^="${r}:"]`) ?? [])].filter((c) => c.querySelector(FOCUSABLE)).map((c) => Number(c.dataset.cell!.split(":")[1]));
  /** focus a cell once it renders (new rows, other pages); col "first" / "last" = first / last editable cell */
  const focusCell = (r: number, col: number | "first" | "last") => {
    const p = Math.floor(r / PAGE_SIZE);
    if (p !== curPage) setPage(p);
    let tries = 0;
    const attempt = () => {
      const editable = editableCols(r);
      const c = col === "first" ? editable[0] : col === "last" ? editable[editable.length - 1] : col;
      const input = c === undefined ? null : bodyRef.current?.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`)?.querySelector<HTMLInputElement>(FOCUSABLE);
      if (input) {
        input.focus();
        if (input.type !== "checkbox") input.select?.();
      } else if (tries++ < 20) setTimeout(attempt, 50);
    };
    // existing cells take focus at once (typing straight after ↓ must land in the new cell); new rows render first
    attempt();
  };
  /** add a row at `to` (optionally a copy), then focus its first cell */
  const addAndFocus = (to: number, values: Record<string, unknown> = {}) => void ctl.add_child(table, values, to).then(() => focusCell(to, "first"));

  /** Desk add_new_row_using_keys: Ctrl+↓/↑ insert below/above, Ctrl+Shift+↓/↑ add at the end/start */
  const insertByKeys = (e: React.KeyboardEvent, { r }: At, down: boolean) => {
    e.preventDefault();
    if (cannotAdd) return;
    addAndFocus(e.shiftKey ? (down ? rows.length : 0) : down ? r + 1 : r);
  };
  const moveVertical = (e: React.KeyboardEvent, { r, col }: At, down: boolean, texty: boolean) => {
    const input = e.target as HTMLInputElement;
    // an open suggestion list (Link) keeps the arrows; text fields need Alt
    if (input.getAttribute("aria-expanded") === "true" || (texty && !e.altKey)) return;
    const to = down ? r + 1 : r - 1;
    if (to < 0 || to >= rows.length) return;
    e.preventDefault();
    focusCell(to, col);
  };
  const tabOut = (e: React.KeyboardEvent, { r, col }: At) => {
    const editable = editableCols(r);
    if (!e.shiftKey && col === editable[editable.length - 1]) {
      if (r < rows.length - 1) {
        e.preventDefault();
        focusCell(r + 1, "first");
      } else if (!cannotAdd) {
        e.preventDefault();
        void ctl.add_child(table, {}).then(() => focusCell(r + 1, "first"));
      }
    } else if (e.shiftKey && col === editable[0] && r > 0) {
      e.preventDefault();
      focusCell(r - 1, "last");
    }
  };
  /** Desk: Esc on a new row nobody filled in (__unedited; defaults don't count) removes it */
  const dropBlankRow = (e: React.KeyboardEvent, { r, col }: At) => {
    const row = rows[r];
    if (e.shiftKey || cannotDelete || (e.target as HTMLInputElement).value || !isBlankRow(row, cols)) return;
    e.preventDefault();
    void ctl.remove_rows(table, [row.name]);
    if (r > 0) focusCell(r - 1, col);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = readOnly ? null : cellAt(e.target);
    if (!at) return;
    const texty = TEXTY.has(cols[at.col]?.fieldtype ?? "");
    const down = e.key === "ArrowDown";
    const vertical = down || e.key === "ArrowUp";
    if (vertical && (e.metaKey || e.ctrlKey) && !texty) insertByKeys(e, at, down);
    else if (down && e.shiftKey && e.altKey) {
      // Desk duplicate_row_using_keys
      e.preventDefault();
      const row = rows[at.r];
      if (!cannotAdd && row) addAndFocus(at.r + 1, copyOf(row));
    } else if (vertical) moveVertical(e, at, down, texty);
    else if (e.key === "Tab") tabOut(e, at);
    else if (e.key === "Escape") dropBlankRow(e, at);
  };

  const fieldFor = (name: string) => {
    const n = name.trim().toLowerCase();
    return (meta.fields ?? []).find((f) => !NO_VALUE.has(f.fieldtype) && (f.fieldname.toLowerCase() === n || (f.label ?? "").toLowerCase() === n));
  };
  /** spreadsheet rows fill down from the cell, adding rows; a header row of labels / fieldnames picks the columns */
  const pasteRows = async (data: string[][], at: At) => {
    const fields: Array<DocField | undefined> = data[0][0] && fieldFor(data[0][0]) ? data.shift()!.map(fieldFor) : cols.slice(at.col);
    const needed = at.r + data.length;
    while (tableRows().length < needed && !cannotAdd) {
      // in order, each add fires <table>_add like Desk
      // react-doctor-disable-next-line async-await-in-loop
      await ctl.add_child(table, {});
    }
    let n = 0;
    for (const [k, line] of data.entries()) {
      const target = tableRows()[at.r + k];
      if (!target || !line.some((v) => v.trim())) continue;
      const values: Record<string, unknown> = {};
      line.forEach((v, i) => {
        const f = fields[i];
        if (f && !f.read_only) values[f.fieldname] = pastedValue(v, f.fieldtype);
      });
      // one row at a time so each row's events (item_code → rate …) run like Desk's set_value
      // react-doctor-disable-next-line async-await-in-loop
      await ctl.set_child_value(target.doctype, target.name, values);
      n++;
    }
    toast.success(`Pasted ${n} row${n === 1 ? "" : "s"} into ${label}`);
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const input = e.target as HTMLInputElement;
    const at = cellAt(input);
    if (readOnly || !at || input.tagName !== "INPUT" || input.type === "checkbox") return;
    const data = parseCsv(e.clipboardData.getData("text/plain"), "\t");
    // Excel adds a trailing newline to every copy
    while (data.length && !data[data.length - 1].some((v) => v.trim())) data.pop();
    // one value pastes into the cell as usual
    if (!data.length || (data.length === 1 && data[0].length === 1)) return;
    e.preventDefault();
    void pasteRows(data, at);
  };

  return { bodyRef, focusCell, onKeyDown, onPaste };
}
