"use client";

/** The grid's rows: a sortable table on wider screens, a card list on phones */
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal, Pencil, Settings2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import type { FormController, Row } from "@/lib/form/FormController";
import type { DocField } from "@/lib/frappe/types";
import { formatCell } from "@/lib/list/format";
import { currencyFor } from "@/lib/crema-form/controls/NumberField";
import Cell from "@/components/form/GridCells";
import { NUMERIC, copyOf } from "@/components/form/gridData";

type Col = DocField & { width: number };

export interface GridRowsProps {
  ctl: FormController;
  table: string;
  label: string;
  rows: Row[];
  pageRows: Row[];
  pageStart: number;
  cols: Col[];
  readOnly: boolean;
  cannotAdd: boolean;
  cannotDelete: boolean;
  overrides: Record<string, Record<string, unknown>>;
  errors: Record<string, string>;
  selected: Set<string>;
  onToggle: (name: string) => void;
  onEdit: (name: string) => void;
}

function RowCheckbox({ i, checked, onToggle, className }: { i: number; checked: boolean; onToggle: () => void; className: string }) {
  return <input type="checkbox" aria-label={`Select row ${i + 1}`} checked={checked} onChange={onToggle} className={className} />;
}

/** Phones: each row is a card (row number + its first columns); tapping opens the row form */
export function GridCards({ ctl, table, label, rows, pageRows, pageStart, cols, readOnly, errors, selected, onToggle, onEdit }: GridRowsProps) {
  const parent = ctl.getDoc();
  return (
    <ul aria-label={`${label} rows`} className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {pageRows.map((row, k) => {
        const i = pageStart + k;
        const shown = cols
          .map((c) => ({ c, text: formatCell(row[c.fieldname], c, { ...row, currency: parent.currency }, { currency: currencyFor(c, { ...parent, ...row }) }) }))
          .filter((x) => x.text !== "" && x.text != null);
        const [first, ...rest] = shown;
        const rowError = Object.keys(errors).some((e) => e.startsWith(`${table}.${i}.`));
        return (
          <li key={row.name} className={`relative flex items-start gap-3 px-3 py-2.5 ${selected.has(row.name) ? "bg-zinc-50 dark:bg-zinc-800/40" : ""}`}>
            {!readOnly && <RowCheckbox i={i} checked={selected.has(row.name)} onToggle={() => onToggle(row.name)} className="relative z-10 mt-1 h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100" />}
            <span className="mt-0.5 w-5 shrink-0 text-xs tabular-nums text-zinc-400">{i + 1}</span>
            <button type="button" onClick={() => onEdit(row.name)} aria-label={`Edit row ${i + 1}`} className="min-w-0 flex-1 text-left after:absolute after:inset-0">
              <span className={`block truncate text-sm font-medium ${rowError ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
                {first ? first.text : <span className="font-normal text-zinc-400">Empty row</span>}
              </span>
              {rest.length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                  {rest.slice(0, 3).map(({ c, text }) => (
                    <span key={c.fieldname} className="min-w-0 truncate">
                      <span className="text-zinc-400">{c.label}</span> {text}
                    </span>
                  ))}
                </span>
              )}
            </button>
            <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          </li>
        );
      })}
      {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-zinc-400">No rows</li>}
    </ul>
  );
}

function SortableGridRow({ id, disabled, template, selected, children }: { id: string; disabled: boolean; template: string; selected: boolean; children: (handle: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ gridTemplateColumns: template, transform: CSS.Transform.toString(transform), transition }}
      className={`group relative grid items-center border-b border-zinc-100 last:border-0 dark:border-zinc-800/70 ${isDragging ? "z-10 bg-white shadow-md dark:bg-zinc-900" : selected ? "bg-zinc-50 dark:bg-zinc-800/40" : "hover:bg-zinc-50/60 dark:hover:bg-zinc-800/20"}`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/** Crema: the row form's actions (Desk grid_row_form.js) straight from the row */
function RowMenu({ ctl, table, row, i, last, cannotAdd, cannotDelete, focusCell }: { ctl: FormController; table: string; row: Row; i: number; last: boolean; cannotAdd: boolean; cannotDelete: boolean; focusCell: (r: number, col: "first") => void }) {
  const addAt = (at: number, values: Record<string, unknown> = {}) => void ctl.add_child(table, values, at).then(() => focusCell(at, "first"));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Row ${i + 1} actions`} className="rounded p-1 text-zinc-400 opacity-0 hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!cannotAdd && (
          <>
            <DropdownMenuItem onClick={() => addAt(i)}>Insert Above</DropdownMenuItem>
            <DropdownMenuItem onClick={() => addAt(i + 1)}>Insert Below</DropdownMenuItem>
            <DropdownMenuItem onClick={() => addAt(i + 1, copyOf(row))}>Duplicate</DropdownMenuItem>
          </>
        )}
        {i > 0 && <DropdownMenuItem onClick={() => ctl.move_row(table, row.name, -1)}>Move Up</DropdownMenuItem>}
        {!last && <DropdownMenuItem onClick={() => ctl.move_row(table, row.name, 1)}>Move Down</DropdownMenuItem>}
        {!cannotDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void ctl.remove_rows(table, [row.name])} className="text-red-600 dark:text-red-400">Delete</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GridTable({
  bodyRef,
  onKeyDown,
  onPaste,
  focusCell,
  onConfigure,
  onToggleAll,
  ...p
}: GridRowsProps & {
  bodyRef: React.RefObject<HTMLDivElement | null>;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  focusCell: (r: number, col: "first") => void;
  onConfigure: () => void;
  onToggleAll: (all: boolean) => void;
}) {
  const { ctl, table, label, rows, pageRows, pageStart, cols, readOnly, overrides, errors, selected } = p;
  const template = `2.25rem 2.5rem ${cols.map((c) => `minmax(0,${c.width}fr)`).join(" ")} ${readOnly ? "2.5rem" : "4rem"}`;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.name));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = rows.findIndex((r) => r.name === e.over!.id);
    if (to >= 0) ctl.reorder_row(table, String(e.active.id), to);
  };
  const ov = (c: DocField) => overrides[`${table}.${c.fieldname}`];
  return (
    <div className="overflow-x-auto">
      <div ref={bodyRef} className="min-w-[640px]" onKeyDown={onKeyDown} onPaste={onPaste}>
        <div className="grid items-center border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60" style={{ gridTemplateColumns: template }}>
          <div className="flex justify-center py-2">
            {!readOnly && <input type="checkbox" aria-label="Select all rows" checked={allSelected} onChange={() => onToggleAll(!allSelected)} className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100" />}
          </div>
          <div className="py-2 text-center">No.</div>
          {cols.map((c) => (
            <div key={c.fieldname} role="columnheader" data-fieldname={c.fieldname} className={`truncate px-2 py-2 ${NUMERIC.has(c.fieldtype) ? "text-right" : c.fieldtype === "Check" ? "text-center" : ""}`} title={c.label ?? undefined}>
              {c.label}
              {!!(ov(c)?.reqd ?? c.reqd) && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
            </div>
          ))}
          <div className="flex justify-center">
            {/* Desk grid_row.js configure_columns: the gear in the header row */}
            <button type="button" onClick={onConfigure} aria-label={`Configure columns of ${label}`} title="Column settings" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={pageRows.map((r) => r.name)} strategy={verticalListSortingStrategy}>
            {pageRows.map((row, k) => {
              const i = pageStart + k;
              return (
                <SortableGridRow key={row.name} id={row.name} disabled={readOnly} template={template} selected={selected.has(row.name)}>
                  {(handle) => (
                    <>
                      <div className="flex justify-center">
                        {!readOnly && <RowCheckbox i={i} checked={selected.has(row.name)} onToggle={() => p.onToggle(row.name)} className="h-3.5 w-3.5 accent-zinc-900 dark:accent-zinc-100" />}
                      </div>
                      <div className="relative flex items-center justify-center text-xs tabular-nums text-zinc-400">
                        <span className={readOnly ? "" : "group-hover:opacity-0"}>{i + 1}</span>
                        {!readOnly && (
                          <button type="button" {...handle} aria-label={`Drag row ${i + 1}`} className="absolute inset-0 m-auto flex h-6 w-6 cursor-grab items-center justify-center rounded text-zinc-400 opacity-0 hover:bg-zinc-100 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800">
                            <GripVertical className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </div>
                      {cols.map((c, ci) => (
                        <div key={c.fieldname} data-cell={`${i}:${ci}`} className="min-w-0 px-0.5 py-0.5">
                          <Cell
                            df={{ ...c, ...(ov(c) as Partial<DocField>) }}
                            row={row}
                            table={table}
                            ctl={ctl}
                            readOnly={readOnly || !!(ov(c)?.read_only ?? c.read_only)}
                            error={errors[`${table}.${i}.${c.fieldname}`]}
                          />
                        </div>
                      ))}
                      <div className="flex items-center justify-center gap-0.5">
                        {!readOnly && <RowMenu ctl={ctl} table={table} row={row} i={i} last={i >= rows.length - 1} cannotAdd={p.cannotAdd} cannotDelete={p.cannotDelete} focusCell={focusCell} />}
                        <button type="button" onClick={() => p.onEdit(row.name)} aria-label={`Edit row ${i + 1}`} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </SortableGridRow>
              );
            })}
          </SortableContext>
        </DndContext>

        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-zinc-400">No rows</div>}
      </div>
    </div>
  );
}
