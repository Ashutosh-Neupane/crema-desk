"use client";

/**
 * Kanban view (Desk: frappe/public/js/frappe/views/kanban) on the v16 board APIs:
 *   get_kanban_boards · quick_kanban_board · get_kanban_board_data · get_kanban_column_page
 *   update_order_for_single_card · add_column · archive_restore_column
 * Cards drag between and within columns (dnd-kit, pointer + keyboard) or move via the
 * card menu; the saved column order (column.order) is respected like Desk.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Filter as FilterIcon, ListFilter, MoreHorizontal, Plus, RefreshCw, X } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import { formatCell, timeAgo } from "@/lib/list/format";
import { INDICATOR_PILL } from "@/lib/list/indicator";
import { PREFILL_KEY } from "@/lib/form/prefill";
import { FilterEditor, OPERATORS, describeValue, fieldLabel } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

interface BoardColumn {
  column_name: string;
  status?: string;
  indicator?: string;
  order?: string | null;
}
interface Board {
  name: string;
  reference_doctype: string;
  field_name: string;
  filters?: string | null;
  title_field?: string | null;
  show_assigned_to?: number;
  footer_date_field?: string;
  columns: BoardColumn[];
  card_fields?: Array<{ fieldname: string; label?: string | null }>;
}
type Card = Record<string, unknown> & { name: string };
type Columns = Record<string, { total: number; cards: Card[] }>;

const enc = encodeURIComponent;
const PAGE = 50;
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const DOT: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-emerald-500", orange: "bg-amber-500", red: "bg-red-500", purple: "bg-violet-500",
  yellow: "bg-yellow-400", pink: "bg-pink-500", cyan: "bg-cyan-500", gray: "bg-zinc-400", darkgrey: "bg-zinc-600", "light-blue": "bg-sky-400",
};

/** Pointer first (a card under the pointer beats its column; an empty column still catches the drop), then corners */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const cards = hits.filter((h) => !String(h.id).startsWith("col:"));
    return cards.length ? cards : hits;
  }
  return closestCorners(args);
};

const uncompress = (msg: unknown): Card[] => {
  const m = msg as { keys?: string[]; values?: unknown[][] } | Card[] | undefined;
  if (Array.isArray(m)) return m;
  const keys = m?.keys ?? [];
  return (m?.values ?? []).map((v) => Object.fromEntries(keys.map((k, i) => [k, v[i]])) as Card);
};

/** Desk keeps a manual order per column (column.order); unknown cards follow, newest first */
function applyOrder(cards: Card[], order: string | null | undefined): Card[] {
  let names: string[] = [];
  try {
    names = order ? (JSON.parse(order) as string[]) : [];
  } catch {
    names = [];
  }
  if (!names.length) return cards;
  const pos = new Map(names.map((n, i) => [n, i]));
  return [...cards].sort((a, b) => (pos.get(a.name) ?? Infinity) - (pos.get(b.name) ?? Infinity));
}

// ── board picker (/view/kanban) ─────────────────────────────────────────────
export function KanbanBoards({ doctype }: { doctype: string }) {
  const router = useRouter();
  const { data: meta } = useDoctype(doctype);
  const { data: boards, isLoading } = useQuery({
    queryKey: ["kanban-boards", doctype],
    queryFn: async () => ((await deskCall("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards", { doctype })).env.message as Array<{ name: string }>) ?? [],
  });
  const [creating, setCreating] = useState(false);

  // one board → open it straight away (Desk remembers the last board)
  useEffect(() => {
    if (boards?.length === 1) router.replace(`/desk/doctype/${enc(doctype)}/view/kanban/${enc(boards[0].name)}`);
  }, [boards, doctype, router]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <div className="text-xs text-zinc-500">
        <Link href={`/desk/doctype/${enc(doctype)}`} className="hover:underline">
          {doctype}
        </Link>
        {" / Kanban"}
      </div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Kanban boards</h1>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {boards?.map((b) => (
            <li key={b.name}>
              <Link href={`/desk/doctype/${enc(doctype)}/view/kanban/${enc(b.name)}`} className="block px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                {b.name}
              </Link>
            </li>
          ))}
          {!boards?.length && <li className="px-4 py-6 text-center text-sm text-zinc-500">No boards for {doctype} yet</li>}
        </ul>
      )}
      <button type="button" onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
        <Plus className="h-4 w-4" aria-hidden /> New Kanban Board
      </button>
      {meta && <NewBoardDialog open={creating} onClose={() => setCreating(false)} meta={meta} />}
    </div>
  );
}

function NewBoardDialog({ open, onClose, meta }: { open: boolean; onClose: () => void; meta: DocTypeMeta }) {
  const router = useRouter();
  const selects = (meta.fields ?? []).filter((f) => f.fieldtype === "Select" && !f.hidden);
  const [name, setName] = useState("");
  const [field, setField] = useState(selects.find((f) => f.fieldname === "status")?.fieldname ?? selects[0]?.fieldname ?? "");
  const create = async () => {
    try {
      const { env } = await deskCall("frappe.desk.doctype.kanban_board.kanban_board.quick_kanban_board", { doctype: meta.name, board_name: name.trim(), field_name: field });
      const b = env.message as { name: string };
      onClose();
      router.push(`/desk/doctype/${enc(meta.name)}/view/kanban/${enc(b.name)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create board", { duration: 8000 });
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Kanban Board</DialogTitle>
          <DialogDescription>Columns come from the options of a Select field.</DialogDescription>
        </DialogHeader>
        {selects.length ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Kanban Board Name
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Column Based On
              <select value={field} onChange={(e) => setField(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900">
                {selects.map((f) => (
                  <option key={f.fieldname} value={f.fieldname}>
                    {f.label ?? f.fieldname}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{meta.name} has no Select field to build columns from.</p>
        )}
        <DialogFooter>
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" disabled={!name.trim() || !field} onClick={create} className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            Create
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── board (/view/kanban/<board>) ────────────────────────────────────────────
export default function KanbanView({ doctype, boardName }: { doctype: string; boardName: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: meta, error: metaError } = useDoctype(doctype);
  const { data: ctx } = useDeskContext();
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");

  const boardQ = useQuery<Board>({
    queryKey: ["kanban-board", boardName],
    queryFn: async () => (await deskCall("frappe.client.get", { doctype: "Kanban Board", name: boardName })).env.message as Board,
  });
  const board = boardQ.data;
  const [filters, setFilters] = useState<Filter[]>([]);

  const titleField = board?.title_field || (typeof meta?.title_field === "string" ? meta.title_field : "") || "name";
  const cardFields = useMemo<DocField[]>(
    () => (board?.card_fields ?? []).map((c) => meta?.fields?.find((f) => f.fieldname === c.fieldname)).filter((f): f is DocField => !!f),
    [board, meta],
  );
  const fields = useMemo(() => {
    if (!board) return [];
    const fs = new Set(["name", "modified", "creation", "docstatus", "_assign", board.field_name, titleField, ...cardFields.map((f) => f.fieldname)]);
    return [...fs].filter((f) => f === "name" || f.startsWith("_") || ["modified", "creation", "docstatus"].includes(f) || meta?.fields?.some((x) => x.fieldname === f)).map((f) => `\`tab${doctype}\`.\`${f}\``);
  }, [board, titleField, cardFields, meta, doctype]);
  const reportArgs = useMemo(() => ({ doctype, fields: JSON.stringify(fields), filters: JSON.stringify(filters), order_by: `\`tab${doctype}\`.\`modified\` desc`, with_comment_count: 0 }), [doctype, fields, filters]);

  const dataQ = useQuery<Columns>({
    queryKey: ["kanban-data", boardName, reportArgs],
    enabled: !!board && !!meta,
    queryFn: async () => {
      const { env } = await deskCall("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_board_data", { board_name: boardName, kanban_page_length: PAGE, ...reportArgs });
      const raw = ((env.message as { columns?: Record<string, { total: number; cards: unknown }> })?.columns ?? {}) as Record<string, { total: number; cards: unknown }>;
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { total: v.total, cards: uncompress(v.cards) }]));
    },
  });

  // local copy so drags render immediately; refetches replace it
  const [cols, setCols] = useState<Columns>({});
  const [prev, setPrev] = useState(dataQ.data);
  if (prev !== dataQ.data) {
    setPrev(dataQ.data);
    if (dataQ.data && board) {
      const ordered: Columns = {};
      for (const c of board.columns) if (dataQ.data[c.column_name]) ordered[c.column_name] = { ...dataQ.data[c.column_name], cards: applyOrder(dataQ.data[c.column_name].cards, c.order) };
      setCols(ordered);
    }
  }
  const active = useMemo(() => (board?.columns ?? []).filter((c) => c.status !== "Archived"), [board]);
  const archived = useMemo(() => (board?.columns ?? []).filter((c) => c.status === "Archived"), [board]);
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["kanban-board", boardName] });
    qc.invalidateQueries({ queryKey: ["kanban-data", boardName] });
  }, [qc, boardName]);

  // ── moves ─────────────────────────────────────────────────────────────────
  const move = async (name: string, from: string, to: string, toIndex: number) => {
    const src = cols[from]?.cards ?? [];
    const card = src.find((c) => c.name === name);
    if (!card) return;
    const fromCards = src.filter((c) => c.name !== name);
    const base = from === to ? fromCards : [...(cols[to]?.cards ?? [])];
    const toCards = [...base];
    toCards.splice(Math.max(0, Math.min(toIndex, toCards.length)), 0, { ...card, [board!.field_name]: to });
    const next: Columns = { ...cols, [from]: { total: (cols[from]?.total ?? 0) - (from === to ? 0 : 1), cards: from === to ? toCards : fromCards } };
    if (from !== to) next[to] = { total: (cols[to]?.total ?? 0) + 1, cards: toCards };
    const before = cols;
    setCols(next);
    try {
      await deskCall("frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card", {
        board_name: boardName,
        docname: name,
        from_colname: from,
        to_colname: to,
        from_order: JSON.stringify(next[from].cards.map((c) => c.name)),
        to_order: JSON.stringify(next[to].cards.map((c) => c.name)),
      });
      qc.invalidateQueries({ queryKey: ["list", doctype] });
    } catch (e) {
      setCols(before);
      toast.error(e instanceof Error ? e.message : "Could not move card", { duration: 8000 });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [dragging, setDragging] = useState<Card | null>(null);
  const findCol = (id: string) => Object.keys(cols).find((k) => cols[k].cards.some((c) => c.name === id));
  const onDragStart = (e: DragStartEvent) => {
    const col = findCol(String(e.active.id));
    setDragging(col ? (cols[col].cards.find((c) => c.name === e.active.id) ?? null) : null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const id = String(e.active.id);
    const from = findCol(id);
    if (!from || !e.over) return;
    const overId = String(e.over.id);
    const to = overId.startsWith("col:") ? overId.slice(4) : findCol(overId);
    if (!to) return;
    const list = cols[to].cards.filter((c) => c.name !== id);
    const idx = overId.startsWith("col:") ? list.length : Math.max(0, list.findIndex((c) => c.name === overId) + (from === to && cols[to].cards.findIndex((c) => c.name === id) < cols[to].cards.findIndex((c) => c.name === overId) ? 1 : 0));
    if (from === to && cols[from].cards.findIndex((c) => c.name === id) === idx) return;
    void move(id, from, to, idx);
  };

  const loadMore = async (col: string) => {
    try {
      const { env } = await deskCall("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_column_page", { board_name: boardName, column_name: col, kanban_start: cols[col]?.cards.length ?? 0, kanban_page_length: PAGE, ...reportArgs });
      const m = env.message as { total: number; cards: unknown };
      const more = uncompress(m.cards).filter((c) => !cols[col]?.cards.some((x) => x.name === c.name));
      setCols((cs) => ({ ...cs, [col]: { total: m.total, cards: [...(cs[col]?.cards ?? []), ...more] } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load cards");
    }
  };

  const columnAction = async (method: "add_column" | "archive_restore_column", args: Record<string, unknown>) => {
    try {
      await deskCall(`frappe.desk.doctype.kanban_board.kanban_board.${method}`, { board_name: boardName, ...args });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update board", { duration: 8000 });
    }
  };
  const [newCol, setNewCol] = useState<string | null>(null);

  const addCard = (col: string) => {
    if (!board) return;
    sessionStorage.setItem(PREFILL_KEY(doctype), JSON.stringify({ [board.field_name]: col }));
    router.push(`/desk/doctype/${enc(doctype)}/new`);
  };

  if (metaError || boardQ.error) return <p className="p-6 text-sm text-red-600">{((metaError ?? boardQ.error) as Error).message}</p>;
  if (!meta || !board) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`/desk/doctype/${enc(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / "}
            <Link href={`/desk/doctype/${enc(doctype)}/view/kanban`} className="hover:underline">
              Kanban
            </Link>
          </div>
          <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{board.name}</h1>
        </div>
        <nav aria-label="Views" className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
          <Link href={`/desk/doctype/${enc(doctype)}${meta.is_tree ? "?view=list" : ""}`} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            List
          </Link>
          <Link href={`/desk/doctype/${enc(doctype)}/view/report`} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Report
          </Link>
          <span aria-current="page" className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            Kanban
          </span>
        </nav>
        <Popover>
          <PopoverTrigger className={btn}>
            <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
            {filters.length > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{filters.length}</span>}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <FilterEditor meta={meta} onAdd={(f) => setFilters((fs) => [...fs.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f])} />
          </PopoverContent>
        </Popover>
        <button type="button" className={btn} onClick={refresh} aria-label="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${dataQ.isFetching ? "animate-spin" : ""}`} aria-hidden />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className={btn} aria-label="Board menu">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setNewCol("")}>Add column</DropdownMenuItem>
            {archived.map((c) => (
              <DropdownMenuItem key={c.column_name} onClick={() => columnAction("archive_restore_column", { column_title: c.column_name, status: "Active" })}>
                Restore “{c.column_name}”
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/desk/doctype/Kanban%20Board/${enc(board.name)}`)}>Board settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => (
            <span key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
              <span className="font-medium">{fieldLabel(meta, f[1])}</span>
              <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
              <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
              <button type="button" onClick={() => setFilters(filters.filter((_, j) => j !== i))} aria-label={`Remove ${fieldLabel(meta, f[1])} filter`} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {active.map((c) => (
            <KanbanColumn
              key={c.column_name}
              column={c}
              data={cols[c.column_name]}
              loading={dataQ.isLoading}
              render={(card) => (
                <KanbanCard
                  card={card}
                  doctype={doctype}
                  titleField={titleField}
                  cardFields={cardFields}
                  dateFormat={dateFormat}
                  showAssigned={board.show_assigned_to !== 0}
                  footer={board.footer_date_field === "Creation" ? "creation" : "modified"}
                  moveTargets={active.filter((x) => x.column_name !== c.column_name).map((x) => x.column_name)}
                  onMove={(to) => void move(card.name, c.column_name, to, 0)}
                />
              )}
              onAdd={() => addCard(c.column_name)}
              onArchive={() => columnAction("archive_restore_column", { column_title: c.column_name, status: "Archived" })}
              onLoadMore={() => void loadMore(c.column_name)}
            />
          ))}
        </div>
        <DragOverlay>{dragging ? <div className="w-72 rotate-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-xl dark:border-zinc-700 dark:bg-zinc-900">{String(dragging[titleField] ?? dragging.name)}</div> : null}</DragOverlay>
      </DndContext>

      <Dialog open={newCol !== null} onOpenChange={(o) => !o && setNewCol(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
            <DialogDescription>Cards in this column get this value in {fieldLabel(meta, board.field_name)}.</DialogDescription>
          </DialogHeader>
          <input aria-label="Column name" autoFocus value={newCol ?? ""} onChange={(e) => setNewCol(e.target.value)} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <DialogFooter>
            <button type="button" className={btn} onClick={() => setNewCol(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!newCol?.trim()}
              onClick={() => {
                void columnAction("add_column", { column_title: newCol!.trim() });
                setNewCol(null);
              }}
              className="h-8 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanColumn({
  column,
  data,
  loading,
  render,
  onAdd,
  onArchive,
  onLoadMore,
}: {
  column: BoardColumn;
  data?: { total: number; cards: Card[] };
  loading: boolean;
  render: (c: Card) => React.ReactNode;
  onAdd: () => void;
  onArchive: () => void;
  onLoadMore: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.column_name}` });
  const cards = data?.cards ?? [];
  return (
    <section aria-label={`${column.column_name} column`} className={`flex w-72 shrink-0 flex-col rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 ${isOver ? "ring-2 ring-blue-400" : ""}`}>
      <header className="flex items-center gap-2 px-3 py-2">
        <span className={`h-2 w-2 rounded-full ${DOT[String(column.indicator ?? "gray").toLowerCase()] ?? DOT.gray}`} aria-hidden />
        <h2 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{column.column_name}</h2>
        <span className="text-xs tabular-nums text-zinc-500">{data?.total ?? 0}</span>
        <div className="ml-auto flex items-center">
          <button type="button" onClick={onAdd} aria-label={`Add to ${column.column_name}`} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`${column.column_name} column menu`} className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="mr-2 h-3.5 w-3.5" aria-hidden /> Archive column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div ref={setNodeRef} className="min-h-24 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        <SortableContext id={column.column_name} items={cards.map((c) => c.name)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.name} id={c.name}>
              {render(c)}
            </SortableCard>
          ))}
        </SortableContext>
        {loading && !cards.length && <div className="h-16 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800" />}
        {!loading && !cards.length && <p className="px-1 py-4 text-center text-xs text-zinc-400">No cards</p>}
        {data && cards.length < data.total && (
          <button type="button" onClick={onLoadMore} className="w-full rounded-md py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800">
            Load {Math.min(PAGE, data.total - cards.length)} more
          </button>
        )}
      </div>
    </section>
  );
}

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""} {...attributes} {...listeners} data-card={id}>
      {children}
    </div>
  );
}

function KanbanCard({
  card,
  doctype,
  titleField,
  cardFields,
  dateFormat,
  showAssigned,
  footer,
  moveTargets,
  onMove,
}: {
  card: Card;
  doctype: string;
  titleField: string;
  cardFields: DocField[];
  dateFormat: string;
  showAssigned: boolean;
  footer: "modified" | "creation";
  moveTargets: string[];
  onMove: (to: string) => void;
}) {
  const title = String(card[titleField] || card.name);
  let assigned: string[] = [];
  try {
    assigned = card._assign ? (JSON.parse(String(card._assign)) as string[]) : [];
  } catch {
    assigned = [];
  }
  return (
    <article className="group rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <div className="flex items-start gap-2">
        <Link href={`/desk/doctype/${enc(doctype)}/${enc(card.name)}`} className="min-w-0 flex-1 font-medium text-zinc-900 hover:underline dark:text-zinc-100" onPointerDown={(e) => e.stopPropagation()}>
          {title}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Move ${title}`} className="rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-100 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800" onPointerDown={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {moveTargets.map((t) => (
              <DropdownMenuItem key={t} onClick={() => onMove(t)}>
                Move to {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {title !== card.name && <div className="mt-0.5 text-xs text-zinc-500">{card.name}</div>}
      {cardFields.length > 0 && (
        <dl className="mt-2 space-y-0.5 text-xs">
          {cardFields.map((f) => {
            const v = formatCell(card[f.fieldname], f, card, { dateFormat });
            return v ? (
              <div key={f.fieldname} className="flex gap-1.5">
                <dt className="text-zinc-500">{f.label}:</dt>
                <dd className="truncate text-zinc-700 dark:text-zinc-300">{v}</dd>
              </div>
            ) : null;
          })}
        </dl>
      )}
      <footer className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
        {showAssigned && assigned.length > 0 && (
          <span className="flex -space-x-1.5">
            {assigned.slice(0, 3).map((u) => (
              <span key={u} title={u} className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-200 text-[10px] font-medium uppercase text-zinc-700 dark:border-zinc-950 dark:bg-zinc-700 dark:text-zinc-200">
                {u.charAt(0)}
              </span>
            ))}
          </span>
        )}
        <span className="ml-auto">{timeAgo(card[footer])}</span>
      </footer>
      {card.docstatus === 1 && <span className={`mt-1 inline-block rounded-full px-2 text-[10px] ${INDICATOR_PILL.blue}`}>Submitted</span>}
    </article>
  );
}
