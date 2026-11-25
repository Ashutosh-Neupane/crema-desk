"use client";

/**
 * Child table grid, Desk-style (frappe/public/js/frappe/form/grid.js):
 *  - columns = child fields with in_list_view (width from df.columns, Desk's
 *    default per type), total ≤ 10 units; ✓ for Check
 *  - cells edit inline; the pencil opens the full row editor (every field)
 *  - select rows → Delete / Duplicate; per-row insert below, move up/down
 *  - every change goes through the FormController, so child events
 *    (item_code(frm, cdt, cdn), qty…) and fetch_from run exactly once
 *  - keyboard like Desk (grid_row.js set_arrow_keys): ↑/↓ same column in the next row, Tab off the last cell goes
 *    to the next row (adds one at the end), Ctrl/⌘+↓/↑ inserts below/above, Ctrl/⌘+Shift+↓/↑ adds at the end/start,
 *    Shift+Alt+↓ duplicates, Esc drops a new empty row
 *  - paste from a spreadsheet like Desk (controls/table.js): tab-separated rows fill down from the cell, adding rows;
 *    a header row of labels / fieldnames picks the columns
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import AddMultipleDialog from "@/components/form/AddMultipleDialog";
import GridColumnsDialog from "@/components/form/GridColumnsDialog";
import GridRowEditor from "@/components/form/GridRowEditor";
import { GridCards, GridTable } from "@/components/form/GridRows";
import { GridActions, GridFooter } from "@/components/form/GridToolbar";
import { useGridKeys } from "@/components/form/useGridKeys";
import { columnFields, gridColumns, type GridViewColumn } from "@/components/form/gridColumns";
import { PAGE_SIZE, isBlankRow } from "@/components/form/gridData";
import { loadUserSettings, userSettingsKey, type UserSettings } from "@/lib/list/useUserListState";
import { deskCall } from "@/lib/frappe/form";
import { useIsPhone } from "@/lib/hooks/useIsPhone";

type Overrides = Record<string, Record<string, unknown>>;

/** the user's column settings for this child table: GridView in the parent DocType's user settings */
function useGridView(parentDt: string, childDt: string) {
  const qc = useQueryClient();
  const { data: userSettings } = useQuery({ queryKey: userSettingsKey(parentDt), queryFn: () => loadUserSettings(parentDt), staleTime: 60_000 });
  const gridView = (userSettings?.GridView ?? {}) as Record<string, GridViewColumn[] | undefined>;
  /** merge per child table: Desk's server merges user settings only at the top level, so GridView goes whole */
  const save = async (next: GridViewColumn[] | null) => {
    const merged: Record<string, GridViewColumn[] | undefined> = { ...gridView, [childDt]: next ?? undefined };
    if (!next) delete merged[childDt];
    await deskCall("frappe.model.utils.user_settings.save", { doctype: parentDt, user_settings: JSON.stringify({ GridView: merged }) });
    qc.setQueryData<UserSettings>(userSettingsKey(parentDt), (s) => ({ ...(s ?? {}), GridView: merged }));
  };
  return { userCols: gridView[childDt], save };
}

/** Desk grid.set_multiple_add(link, qty) from the app's script → "Add Multiple" */
function useMultipleAdd(ctl: FormController, table: string, meta: DocTypeMeta, overrides: Overrides, cols: DocField[], showLast: () => void) {
  const multiple = overrides[table]?.multiple_add as { link: string; qty?: string } | undefined;
  const link = multiple ? meta.fields?.find((f) => f.fieldname === multiple.link && f.fieldtype === "Link") : undefined;
  const qtyField = multiple?.qty ? meta.fields?.find((f) => f.fieldname === multiple.qty) : undefined;
  // Desk link_selector.js set_in_grid: a row that already has the value gets the new quantity, else a new row
  const pick = async (value: string, qty?: number) => {
    if (!link) return;
    const current = (ctl.getDoc()[table] as Row[]) ?? [];
    const existing = qtyField ? current.find((r) => r[link.fieldname] === value) : undefined;
    if (existing && qtyField) {
      await ctl.set_child_value(existing.doctype, existing.name, qtyField.fieldname, qty);
    } else {
      // a new form's blank row (Sales Order starts with one) is filled first instead of left above the picks
      const last = current[current.length - 1];
      const row = isBlankRow(last, cols) ? last : await ctl.add_child(table, {});
      await ctl.set_child_value(row.doctype, row.name, qtyField && qty !== undefined ? { [link.fieldname]: value, [qtyField.fieldname]: qty } : { [link.fieldname]: value });
    }
    showLast();
    toast.success(qty === undefined ? `${value} added` : `Added ${value} (${qty})`);
  };
  return { link, qtyField, pick };
}

export default function Grid({
  ctl,
  df,
  meta,
  readOnly,
  overrides,
  errors,
}: {
  ctl: FormController;
  df: DocField;
  meta: DocTypeMeta;
  readOnly: boolean;
  overrides: Overrides;
  errors: Record<string, string>;
}) {
  const table = df.fieldname;
  const label = df.label ?? table;
  const rows = (ctl.getDoc()[table] as Row[]) ?? [];
  const { userCols, save: saveGridView } = useGridView(ctl.meta.name, meta.name);
  const cols = useMemo(() => gridColumns(meta, overrides, table, userCols), [meta, overrides, table, userCols]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [multipleOpen, setMultipleOpen] = useState(false);
  const [selected, setSelectedState] = useState<Set<string>>(() => new Set());
  // the form's scripts see the checked rows too (grid.get_selected(), e.g. Sales Order → Delivery Note)
  const setSelected = (next: Set<string>) => {
    setSelectedState(next);
    ctl.setGridSelection(table, [...next]);
  };
  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };
  const [editing, setEditing] = useState<string | null>(null);
  const phone = useIsPhone();
  const tableReadOnly = readOnly || !!(overrides[table]?.read_only ?? df.read_only);
  const cannotAdd = !!(df as { cannot_add_rows?: unknown }).cannot_add_rows || !!overrides[table]?.cannot_add_rows;
  const cannotDelete = !!(df as { cannot_delete_rows?: unknown }).cannot_delete_rows;
  const editRow = rows.find((r) => r.name === editing);

  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const curPage = Math.min(page, pages - 1);
  const pageStart = curPage * PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageStart + PAGE_SIZE);
  const showLast = () => setPage(Math.floor((((ctl.getDoc()[table] as Row[]) ?? []).length - 1) / PAGE_SIZE));

  const multiple = useMultipleAdd(ctl, table, meta, overrides, cols, showLast);
  const keys = useGridKeys({ ctl, table, label, meta, rows, cols, curPage, setPage, readOnly: tableReadOnly, cannotAdd, cannotDelete });

  const add = async () => {
    const row = await ctl.add_child(table, {});
    setPage(Math.floor(rows.length / PAGE_SIZE));
    // Desk focuses the first cell of the new row; open the editor if no inline columns
    // (phones edit rows in the row form, so it opens right away)
    if (!cols.length || phone) setEditing(row.name);
  };

  const rowProps = { ctl, table, label, rows, pageRows, pageStart, cols, readOnly: tableReadOnly, cannotAdd, cannotDelete, overrides, errors, selected, onToggle: toggle, onEdit: setEditing };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      {phone ? (
        <GridCards {...rowProps} />
      ) : (
        <GridTable
          {...rowProps}
          bodyRef={keys.bodyRef}
          onKeyDown={keys.onKeyDown}
          onPaste={keys.onPaste}
          focusCell={keys.focusCell}
          onConfigure={() => setColumnsOpen(true)}
          onToggleAll={(all) => setSelected(all ? new Set(rows.map((r) => r.name)) : new Set())}
        />
      )}

      <GridFooter
        ctl={ctl}
        table={table}
        label={label}
        meta={meta}
        rows={rows}
        page={curPage}
        pages={pages}
        setPage={setPage}
        // Desk: Download / Upload only when the Table field allows bulk edit
        bulkEdit={!!(df as { allow_bulk_edit?: unknown }).allow_bulk_edit}
        canUpload={!tableReadOnly && !cannotAdd}
      />

      {!tableReadOnly && (
        <GridActions
          ctl={ctl}
          table={table}
          rows={rows}
          pageRowCount={pageRows.length}
          selected={selected}
          setSelected={setSelected}
          cannotAdd={cannotAdd}
          cannotDelete={cannotDelete}
          canAddMultiple={!!multiple.link}
          onAdd={() => void add()}
          onAddMultiple={() => setMultipleOpen(true)}
        />
      )}

      {columnsOpen && (
        <GridColumnsDialog
          title={label}
          current={cols.map((c) => ({ fieldname: c.fieldname, width: c.width, sticky: userCols?.find((u) => u.fieldname === c.fieldname)?.sticky ?? 0 }))}
          available={columnFields(meta, overrides, table)}
          onSave={(next) => saveGridView(next)}
          onReset={() => saveGridView(null)}
          onClose={() => setColumnsOpen(false)}
        />
      )}

      {multipleOpen && multiple.link && (
        <AddMultipleDialog
          doctype={String(multiple.link.options)}
          qtyLabel={multiple.qtyField ? (multiple.qtyField.label ?? multiple.qtyField.fieldname) : undefined}
          getQuery={() => ctl.getQuery(multiple.link!.fieldname, table)?.(ctl.getDoc(), meta.name, "") as Record<string, unknown> | undefined}
          onPick={multiple.pick}
          onClose={() => setMultipleOpen(false)}
        />
      )}

      {editRow && (
        <GridRowEditor
          key={editRow.name}
          ctl={ctl}
          df={df}
          meta={meta}
          row={editRow}
          rowCount={rows.length}
          readOnly={tableReadOnly}
          cannotAdd={cannotAdd}
          cannotDelete={cannotDelete}
          overrides={overrides}
          errors={errors}
          onEdit={setEditing}
        />
      )}
    </div>
  );
}
