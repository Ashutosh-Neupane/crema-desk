"use client";

/**
 * Saved list layouts UI (Desk v16: list/list_filter/list_filter_menu.js get_layout_menu_items, layout_dialog.js,
 * layout_field_selector.js, manage_layouts_dialog.js):
 *  - LayoutMenu: Default Layout, Global Layouts, Your Layouts, Create Layout, Manage Layouts
 *  - LayoutDialog: create / edit / duplicate — name, "Available to all users" (System Manager), Standard + Module
 *    (developer mode, create only), filters, sort field + order, columns (order, width, add / remove)
 *  - ManageLayoutsDialog: each layout with its scope (Standard / Global / Personal) and Edit / Duplicate / Delete
 */
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  LayoutList,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import {
  FilterEditor,
  describeValue,
  fieldLabel,
  NO_VALUE,
  OPERATORS,
} from "@/components/list/filters";
import LinkInput from "@/components/list/LinkInput";
import type { Filter } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import type { DocTypeMeta } from "@/lib/frappe/types";
import {
  canAddGlobal,
  canEditLayout,
  createLayout,
  DEFAULT_LAYOUT,
  deleteLayout,
  layoutColumns,
  layoutFilters,
  layoutLabel,
  updateLayout,
  type ListLayout,
} from "@/lib/list/layouts";

export interface LayoutCtx {
  user: string;
  roles: string[];
  developerMode: boolean;
}

export function LayoutMenu({
  layouts,
  active,
  user,
  onSelect,
  onCreate,
  onManage,
}: {
  layouts: ListLayout[];
  active: string;
  user: string;
  onSelect: (name: string) => void;
  onCreate: () => void;
  onManage: () => void;
}) {
  const global = layouts.filter((l) => !l.for_user);
  const mine = layouts.filter((l) => l.for_user === user);
  const activeLabel =
    active === DEFAULT_LAYOUT
      ? "Default Layout"
      : (layouts.find((l) => l.name === active)?.filter_name ?? "Default Layout");
  const row = (l: ListLayout) => (
    <DropdownMenuItem
      key={l.name}
      role="menuitemradio"
      aria-checked={l.name === active}
      onClick={() => onSelect(l.name)}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate">{layoutLabel(l)}</span>
        {l.name === active && <Check className="h-3.5 w-3.5" />}
      </span>
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Layout: ${activeLabel}`}
        className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <LayoutList className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{activeLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={active === DEFAULT_LAYOUT}
          onClick={() => onSelect(DEFAULT_LAYOUT)}
        >
          <span className="flex w-full items-center justify-between gap-2">
            Default Layout {active === DEFAULT_LAYOUT && <Check className="h-3.5 w-3.5" />}
          </span>
        </DropdownMenuItem>
        {global.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Global Layouts</DropdownMenuLabel>
            {global.map(row)}
          </>
        )}
        {mine.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your Layouts</DropdownMenuLabel>
            {mine.map(row)}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate}>
          <Plus className="mr-2 h-3.5 w-3.5" /> Create Layout
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManage}>
          <Settings className="mr-2 h-3.5 w-3.5" /> Manage Layouts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STD_SORT: Record<string, string> = {
  modified: "Last Updated On",
  name: "ID",
  creation: "Created On",
  idx: "Most Used",
};

/** layout_dialog.js get_sort_field_options */
function sortOptions(meta: DocTypeMeta): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [
    { value: "modified", label: STD_SORT.modified },
  ];
  const push = (value: string, label?: string | null) =>
    !out.some((o) => o.value === value) &&
    out.push({ value, label: label || STD_SORT[value] || fieldLabel(meta, value) });
  if (meta.sort_field) push(String(meta.sort_field).split(",")[0].split(" ")[0]);
  if (meta.title_field) push(String(meta.title_field));
  push("name");
  push("creation");
  push("idx");
  for (const df of meta.fields ?? [])
    if (
      (df.reqd || df.bold || df.in_list_view) &&
      !NO_VALUE.has(df.fieldtype) &&
      !["Section Break", "Column Break", "Tab Break"].includes(df.fieldtype)
    )
      push(df.fieldname, df.label);
  return out;
}

const LAYOUT_BREAKS = new Set(["Section Break", "Column Break", "Tab Break"]);
const opLabel = (op: string) => OPERATORS.find((o) => o.op === op)?.label ?? op;

/** layout_dialog.js validate: the first problem with the form, or null */
function layoutError(o: {
  filterName: string;
  isStandard: boolean;
  module: string;
  layouts: ListLayout[];
  editing: ListLayout | null;
  columns: ListColumnSetting[];
}): string | null {
  if (!o.filterName) return "Layout name is required";
  if (o.isStandard && !o.module) return "Module is required for a standard layout";
  if (o.layouts.some((l) => l.filter_name === o.filterName && l.name !== o.editing?.name))
    return "A layout with this name already exists";
  if (!o.columns.length) return "Select at least one field";
  return null;
}

function initialLayoutName(layout: ListLayout | null, duplicateFrom: ListLayout | null) {
  if (layout) return layout.filter_name;
  return duplicateFrom ? `${duplicateFrom.filter_name} (copy)` : "";
}

function LayoutFiltersSection({
  meta,
  filters,
  setFilters,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
}: {
  meta: DocTypeMeta;
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
  sortField: string;
  setSortField: (v: string) => void;
  sortOrder: string;
  setSortOrder: (v: string) => void;
}) {
  const sorts = useMemo(() => sortOptions(meta), [meta]);
  return (
    <section className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <h3 className="font-semibold">Filters &amp; Sorting</h3>
      {filters.length === 0 ? (
        <p className="text-xs text-zinc-500">No filters selected</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" aria-label="Layout filters">
          {filters.map((f, i) => (
            <li
              key={`${f[1]}-${f[2]}-${describeValue(f[3])}`}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 py-0.5 pl-2 pr-1 text-xs dark:bg-zinc-800"
            >
              {fieldLabel(meta, f[1])} {opLabel(f[2])} {describeValue(f[3])}
              <button
                type="button"
                aria-label={`Remove filter ${fieldLabel(meta, f[1])}`}
                onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                className="rounded p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="max-w-md rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
        <FilterEditor
          meta={meta}
          onAdd={(f) =>
            setFilters([...filters.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f])
          }
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-zinc-500">Sort Field *</span>
          <select
            aria-label="Sort Field"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {!sorts.some((s) => s.value === sortField) && (
              <option value={sortField}>{fieldLabel(meta, sortField)}</option>
            )}
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-zinc-500">Sort Order *</span>
          <select
            aria-label="Sort Order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function LayoutColumnsSection({
  meta,
  columns,
  setColumns,
}: {
  meta: DocTypeMeta;
  columns: ListColumnSetting[];
  setColumns: (c: ListColumnSetting[]) => void;
}) {
  const [addField, setAddField] = useState("");
  const shown = new Set(columns.map((c) => c.fieldname));
  const addable = (meta.fields ?? []).filter(
    (f) => !NO_VALUE.has(f.fieldtype) && !LAYOUT_BREAKS.has(f.fieldtype) && !shown.has(f.fieldname)
  );
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    setColumns(next);
  };
  return (
    <section className="space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <h3 className="font-semibold">Columns</h3>
      <ul
        aria-label="Layout columns"
        className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-700"
      >
        {columns.map((c, i) => (
          <li
            key={c.fieldname}
            data-column={c.fieldname}
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <span className="flex-1 truncate">
              {c.fieldname === "status_field" ? "Status" : c.label || fieldLabel(meta, c.fieldname)}
            </span>
            <input
              type="number"
              min={0}
              aria-label={`${c.label || c.fieldname} width`}
              value={c.width ?? ""}
              placeholder="Width"
              onChange={(e) =>
                setColumns(
                  columns.map((x, j) =>
                    j === i
                      ? { ...x, width: e.target.value ? Number(e.target.value) : undefined }
                      : x
                  )
                )
              }
              className="w-20 rounded-md border border-zinc-200 px-2 py-0.5 text-right text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              aria-label={`Move ${c.label || c.fieldname} up`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Move ${c.label || c.fieldname} down`}
              disabled={i === columns.length - 1}
              onClick={() => move(i, 1)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={`Remove column ${c.label || c.fieldname}`}
              onClick={() => setColumns(columns.filter((_, j) => j !== i))}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <select
          aria-label="Add column"
          value={addField}
          onChange={(e) => setAddField(e.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Add a field…</option>
          {addable.map((f) => (
            <option key={f.fieldname} value={f.fieldname}>
              {f.label || f.fieldname}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!addField}
          onClick={() => {
            const df = meta.fields?.find((f) => f.fieldname === addField);
            if (df)
              setColumns([
                ...columns,
                { fieldname: df.fieldname, label: df.label || df.fieldname },
              ]);
            setAddField("");
          }}
          className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function LayoutScopeFields({
  layout,
  global,
  canStandard,
  isGlobal,
  setIsGlobal,
  isStandard,
  setIsStandard,
  module,
  setModule,
}: {
  layout: ListLayout | null;
  global: boolean;
  canStandard: boolean;
  isGlobal: boolean;
  setIsGlobal: (v: boolean) => void;
  isStandard: boolean;
  setIsStandard: (v: boolean) => void;
  module: string;
  setModule: (v: string) => void;
}) {
  return (
    <>
      {global && !layout?.is_standard && !isStandard && (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
          />{" "}
          Available to all users
        </label>
      )}
      {canStandard && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isStandard}
              onChange={(e) => setIsStandard(e.target.checked)}
            />{" "}
            Standard
            <span className="text-xs text-zinc-500">
              Exported to the module and shipped with its app
            </span>
          </label>
          {isStandard && (
            <div className="max-w-xs">
              <span className="text-xs text-zinc-500">Module *</span>
              <LinkInput doctype="Module Def" value={module} onChange={setModule} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function LayoutDialog({
  meta,
  layout,
  duplicateFrom,
  ctx,
  layouts,
  current,
  onClose,
  onSaved,
}: {
  meta: DocTypeMeta;
  layout: ListLayout | null;
  duplicateFrom: ListLayout | null;
  ctx: LayoutCtx;
  layouts: ListLayout[];
  current: {
    filters: Filter[];
    sort_field: string;
    sort_order: string;
    columns: ListColumnSetting[];
  };
  onClose: () => void;
  onSaved: (l: ListLayout) => void;
}) {
  const source = duplicateFrom ?? layout;
  const isEdit = !!layout;
  const global = canAddGlobal(ctx);
  const canStandard = global && ctx.developerMode && !isEdit;
  const [name, setName] = useState(() => initialLayoutName(layout, duplicateFrom));
  const [isGlobal, setIsGlobal] = useState(source ? !source.for_user : false);
  const [isStandard, setIsStandard] = useState(false);
  const [module, setModule] = useState(String(meta.module ?? ""));
  const [filters, setFilters] = useState<Filter[]>(() =>
    source ? layoutFilters(source) : current.filters
  );
  const [sortField, setSortField] = useState(source?.sort_field || current.sort_field);
  const [sortOrder, setSortOrder] = useState(() =>
    (source?.sort_order || current.sort_order).toLowerCase() === "asc" ? "asc" : "desc"
  );
  const [columns, setColumns] = useState<ListColumnSetting[]>(() => {
    const saved = source ? layoutColumns(source) : [];
    return saved.length ? saved : current.columns;
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const filterName = name.trim();
    const error = layoutError({
      filterName,
      isStandard,
      module,
      layouts,
      editing: layout,
      columns,
    });
    if (error) return toast.error(error);
    setSaving(true);
    try {
      const input = {
        filter_name: filterName,
        is_global: global && isGlobal,
        is_standard: canStandard && isStandard,
        module,
        filters,
        columns,
        sort_field: sortField,
        sort_order: sortOrder,
      };
      const saved = layout
        ? await updateLayout(meta.name, layout, ctx.user, input, global)
        : await createLayout(meta.name, ctx.user, input);
      toast.success(isEdit ? `Layout ${filterName} updated` : `Layout ${filterName} created`);
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the layout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit layout" : "Create layout"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-1 text-sm">
          <label className="block space-y-1">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Layout name *</span>
            <input
              aria-label="Layout name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <LayoutScopeFields
            layout={layout}
            global={global}
            canStandard={canStandard}
            isGlobal={isGlobal}
            setIsGlobal={setIsGlobal}
            isStandard={isStandard}
            setIsStandard={setIsStandard}
            module={module}
            setModule={setModule}
          />
          <LayoutFiltersSection
            meta={meta}
            filters={filters}
            setFilters={setFilters}
            sortField={sortField}
            setSortField={setSortField}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
          />
          <LayoutColumnsSection meta={meta} columns={columns} setColumns={setColumns} />
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isEdit ? "Update" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ManageLayoutsDialog({
  layouts,
  ctx,
  onClose,
  onEdit,
  onDuplicate,
  onDeleted,
}: {
  layouts: ListLayout[];
  ctx: LayoutCtx;
  onClose: () => void;
  onEdit: (l: ListLayout) => void;
  onDuplicate: (l: ListLayout) => void;
  onDeleted: (l: ListLayout) => void;
}) {
  const [confirm, setConfirm] = useState<ListLayout | null>(null);
  const remove = async (l: ListLayout) => {
    try {
      await deleteLayout(l.name);
      toast.success(`Layout ${l.filter_name} deleted`);
      onDeleted(l);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the layout");
    } finally {
      setConfirm(null);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Layouts</DialogTitle>
        </DialogHeader>
        {layouts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-medium">No saved layouts yet</p>
            <p className="text-sm text-zinc-500">Layouts you create will show up here.</p>
          </div>
        ) : (
          <ul aria-label="Saved layouts" className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {layouts.map((l) => {
              const can = canEditLayout(l, ctx);
              const scope = l.is_standard ? "Standard" : l.for_user ? "Personal" : "Global";
              return (
                <li
                  key={l.name}
                  data-layout={l.filter_name}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{layoutLabel(l)}</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {scope}
                    </span>
                  </span>
                  {confirm?.name === l.name ? (
                    <span className="flex items-center gap-2 text-xs">
                      Delete layout <b>{l.filter_name}</b>?
                      <button
                        type="button"
                        onClick={() => void remove(l)}
                        className="rounded bg-red-600 px-2 py-0.5 text-white"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(null)}
                        className="rounded border border-zinc-200 px-2 py-0.5 dark:border-zinc-700"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${l.filter_name}`}
                        title="Edit"
                        disabled={!can}
                        onClick={() => onEdit(l)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate ${l.filter_name}`}
                        title="Duplicate"
                        onClick={() => onDuplicate(l)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${l.filter_name}`}
                        title="Delete"
                        disabled={!can}
                        onClick={() => setConfirm(l)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
