"use client";

/** The form builder's canvas pieces: drop targets, field cards, sections and the drag preview. */
import { Fragment } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, EyeOff, GripVertical, LayoutPanelTop, Plus, X } from "lucide-react";
import type { Problem } from "./builderChecks";
import type { F, Section } from "./builderTree";

/**
 * Drop targets besides the field cards themselves (ids are parsed in onDragEnd):
 *   col:<si>:<ci>     a column (empty or not): the field goes to its end
 *   newcol:<si>:<ci>  the gap before column ci (ci = column count: after the last): a Column Break is created there
 *   tab:<ti>          a tab button: the field moves to the end of that tab's first column
 */
function DropColumn({
  id,
  children,
  empty,
}: {
  id: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-drop={id}
      className={`flex min-h-16 flex-col gap-2 rounded-lg p-2 transition-colors ${isOver ? "bg-blue-50 ring-2 ring-blue-400 dark:bg-blue-500/10" : "bg-zinc-50 dark:bg-zinc-900/60"} ${empty ? "justify-center" : ""}`}
    >
      {children}
    </div>
  );
}

/** a thin strip between / after columns; widens and says what happens while a field is dragged over it */
function NewColumnGap({ id, dragging }: { id: string; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  if (!dragging) return <div ref={setNodeRef} aria-hidden="true" className="w-0" />;
  return (
    <div
      ref={setNodeRef}
      data-drop={id}
      className={`flex min-h-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed text-xs whitespace-nowrap transition-all ${isOver ? "w-28 border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "w-6 border-zinc-300 text-transparent dark:border-zinc-700"}`}
    >
      {isOver ? "New column" : ""}
    </div>
  );
}

export function TabButton({
  id,
  active,
  label,
  onClick,
  onDoubleClick,
}: {
  id: string;
  active: boolean;
  label: string;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${isOver ? "bg-blue-100 text-blue-800 ring-2 ring-blue-400 dark:bg-blue-500/20 dark:text-blue-200" : active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
    >
      {label}
    </button>
  );
}

/** live problems above the canvas; each one selects its field */
export function ProblemList({
  problems,
  onPick,
}: {
  problems: Problem[];
  onPick: (row: string) => void;
}) {
  if (!problems.length) return null;
  return (
    <div
      role="status"
      className="crema-fade mb-4 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm text-[var(--status-warning-fg)]"
    >
      <p className="font-medium">
        {problems.length === 1
          ? "1 thing to fix before saving"
          : `${problems.length} things to fix before saving`}
      </p>
      <ul className="mt-1 space-y-0.5">
        {problems.slice(0, 6).map((p) => (
          <li key={`${p.row}:${p.message}`}>
            <button
              type="button"
              onClick={() => onPick(p.row)}
              className="text-left underline-offset-2 hover:underline"
            >
              {p.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldCard({ f, selected, onSelect }: { f: F; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: f.name,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // the whole card drags with a pointer (a click still selects: the drag starts after 4px); the grip is the
      // keyboard handle (Space to lift, arrows to move)
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler | undefined}
      className={`group flex cursor-grab touch-none items-center gap-2 rounded-lg border bg-white px-2 py-2 text-sm transition-colors dark:bg-zinc-900 ${selected ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"} ${isDragging ? "z-10 opacity-70 shadow-lg" : ""}`}
    >
      <button
        type="button"
        aria-label={`Drag ${f.label || f.fieldname}`}
        className="text-zinc-300 hover:text-zinc-500 dark:text-zinc-600"
        {...attributes}
        onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler | undefined}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span
          className={`truncate ${f.hidden ? "text-zinc-400 line-through" : "text-zinc-800 dark:text-zinc-100"}`}
        >
          {f.label || f.fieldname || "Untitled"}
          {!!f.reqd && (
            <span aria-hidden="true" className="ml-0.5 text-red-500">
              *
            </span>
          )}
        </span>
        {!!f.hidden && <EyeOff className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
        <span className="ml-auto shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {f.fieldtype}
        </span>
      </button>
    </div>
  );
}

/** one section: header (select / add column) and its columns, with new-column gaps while dragging */
export function SectionCard({
  s,
  si,
  selected,
  dragging,
  readOnly,
  onSelect,
  onAddColumn,
  onAddField,
  onRemoveColumn,
}: {
  s: Section;
  si: number;
  selected: string | null;
  dragging: boolean;
  readOnly?: boolean;
  onSelect: (name: string) => void;
  onAddColumn: () => void;
  onAddField: (ci: number) => void;
  onRemoveColumn: (ci: number) => void;
}) {
  const gaps = !readOnly && dragging && s.columns.length < 4;
  return (
    <div className="crema-rise rounded-xl border border-zinc-200 bg-white p-3 shadow-[var(--elevation-1)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => s.brk && onSelect(s.brk.name)}
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
        >
          <LayoutPanelTop className="h-3.5 w-3.5 text-zinc-400" />
          {s.brk?.label || <span className="font-normal text-zinc-400">Untitled section</span>}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={onAddColumn}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Columns3 className="h-3.5 w-3.5" /> Column
          </button>
        )}
      </div>
      {/* columns side by side; while a field is dragged, gaps before / between / after them make a new column */}
      <div className="flex items-stretch gap-2">
        {s.columns.map((c, ci) => (
          <Fragment key={c.brk?.name ?? `col-${si}-${ci}`}>
            {!readOnly && <NewColumnGap id={`newcol:${si}:${ci}`} dragging={gaps} />}
            <div className="min-w-0 flex-1">
              <SortableContext
                id={`list:${si}:${ci}`}
                items={c.fields.map((f) => f.name)}
                strategy={verticalListSortingStrategy}
              >
                <DropColumn id={`col:${si}:${ci}`} empty={!c.fields.length}>
                  {c.fields.map((f) => (
                    <FieldCard
                      key={f.name}
                      f={f}
                      selected={selected === f.name}
                      onSelect={() => onSelect(f.name)}
                    />
                  ))}
                  {!c.fields.length && (
                    <p className="text-center text-xs text-zinc-400">
                      {dragging ? "Drop here" : "Empty column"}
                    </p>
                  )}
                  {!readOnly && !dragging && (
                    <ColumnFooter
                      empty={!c.fields.length && s.columns.length > 1}
                      onAdd={() => onAddField(ci)}
                      onRemove={() => onRemoveColumn(ci)}
                    />
                  )}
                </DropColumn>
              </SortableContext>
            </div>
          </Fragment>
        ))}
        {!readOnly && <NewColumnGap id={`newcol:${si}:${s.columns.length}`} dragging={gaps} />}
      </div>
    </div>
  );
}

function ColumnFooter({
  empty,
  onAdd,
  onRemove,
}: {
  empty: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:hover:text-zinc-200"
      >
        <Plus className="h-3.5 w-3.5" /> Add field
      </button>
      {empty && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove empty column"
          className="rounded-md border border-dashed border-zinc-300 px-2 text-zinc-400 hover:border-red-300 hover:text-red-600 dark:border-zinc-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** what follows the pointer while dragging */
export function DragPreview({ f }: { f: F }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
      <GripVertical className="h-4 w-4 text-zinc-400" />
      <span className="truncate text-zinc-800 dark:text-zinc-100">{f.label || f.fieldname}</span>
      <span className="ml-auto rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
        {f.fieldtype}
      </span>
    </div>
  );
}
