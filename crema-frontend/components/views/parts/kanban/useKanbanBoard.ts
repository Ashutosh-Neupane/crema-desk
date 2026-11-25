"use client";

/**
 * Board data + card moves for the Kanban view (Desk: frappe/public/js/frappe/views/kanban/kanban_board.bundle.js)
 * on the v16 board APIs: get_kanban_board_data · get_kanban_column_page · update_order_for_single_card ·
 * add_column · archive_restore_column.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";

export interface BoardColumn {
  column_name: string;
  status?: string;
  indicator?: string;
  order?: string | null;
}
export interface Board {
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
export type Card = Record<string, unknown> & { name: string };
type Columns = Record<string, { total: number; cards: Card[] }>;

export const PAGE = 50;
const API = "frappe.desk.doctype.kanban_board.kanban_board";
const STD_FIELDS = new Set(["modified", "creation", "docstatus"]);
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export const uncompress = (msg: unknown): Card[] => {
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

/** the board columns in saved order with each column's saved card order applied */
function orderColumns(data: Columns, board: Board): Columns {
  const ordered: Columns = {};
  for (const c of board.columns) if (data[c.column_name]) ordered[c.column_name] = { ...data[c.column_name], cards: applyOrder(data[c.column_name].cards, c.order) };
  return ordered;
}

/** the cards list after moving `card` from `from` to index `toIndex` of `to` */
function moved(cols: Columns, card: Card, from: string, to: string, toIndex: number, field: string): Columns {
  const fromCards = (cols[from]?.cards ?? []).filter((c) => c.name !== card.name);
  const toCards = from === to ? [...fromCards] : [...(cols[to]?.cards ?? [])];
  toCards.splice(Math.max(0, Math.min(toIndex, toCards.length)), 0, { ...card, [field]: to });
  if (from === to) return { ...cols, [from]: { total: cols[from]?.total ?? 0, cards: toCards } };
  return {
    ...cols,
    [from]: { total: (cols[from]?.total ?? 0) - 1, cards: fromCards },
    [to]: { total: (cols[to]?.total ?? 0) + 1, cards: toCards },
  };
}

/** index the dragged card lands at in column `to` (dropped on the column itself → the end) */
function dropIndex(cols: Columns, id: string, overId: string, from: string, to: string): number {
  if (overId.startsWith("col:")) return cols[to].cards.filter((c) => c.name !== id).length;
  const list = cols[to].cards;
  const after = from === to && list.findIndex((c) => c.name === id) < list.findIndex((c) => c.name === overId);
  return Math.max(0, list.filter((c) => c.name !== id).findIndex((c) => c.name === overId) + (after ? 1 : 0));
}

function useBoardData(doctype: string, boardName: string, meta: DocTypeMeta | undefined, filters: Filter[]) {
  const boardQ = useQuery<Board>({
    queryKey: ["kanban-board", boardName],
    queryFn: async () => (await deskCall("frappe.client.get", { doctype: "Kanban Board", name: boardName })).env.message as Board,
  });
  const board = boardQ.data;
  const titleField = board?.title_field || (typeof meta?.title_field === "string" ? meta.title_field : "") || "name";
  const cardFields = useMemo<DocField[]>(() => {
    const byName = new Map((meta?.fields ?? []).map((f) => [f.fieldname, f]));
    return (board?.card_fields ?? []).map((c) => byName.get(c.fieldname)).filter((f): f is DocField => !!f);
  }, [board, meta]);
  const reportArgs = useMemo(() => {
    const known = new Set((meta?.fields ?? []).map((f) => f.fieldname));
    const wanted = board ? new Set(["name", "modified", "creation", "docstatus", "_assign", board.field_name, titleField, ...cardFields.map((f) => f.fieldname)]) : new Set<string>();
    const fields = [...wanted].filter((f) => f === "name" || f.startsWith("_") || STD_FIELDS.has(f) || known.has(f)).map((f) => `\`tab${doctype}\`.\`${f}\``);
    return { doctype, fields: JSON.stringify(fields), filters: JSON.stringify(filters), order_by: `\`tab${doctype}\`.\`modified\` desc`, with_comment_count: 0 };
  }, [board, titleField, cardFields, meta, doctype, filters]);

  const dataQ = useQuery<Columns>({
    queryKey: ["kanban-data", boardName, reportArgs],
    enabled: !!board && !!meta,
    queryFn: async () => {
      const { env } = await deskCall(`${API}.get_kanban_board_data`, { board_name: boardName, kanban_page_length: PAGE, ...reportArgs });
      const raw = (env.message as { columns?: Record<string, { total: number; cards: unknown }> })?.columns ?? {};
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { total: v.total, cards: uncompress(v.cards) }]));
    },
  });
  return { boardQ, board, titleField, cardFields, reportArgs, dataQ };
}

export function useKanbanBoard(doctype: string, boardName: string, meta: DocTypeMeta | undefined, filters: Filter[]) {
  const qc = useQueryClient();
  const { boardQ, board, titleField, cardFields, reportArgs, dataQ } = useBoardData(doctype, boardName, meta, filters);

  // local copy so drags render immediately; refetches replace it
  const [cols, setCols] = useState<Columns>({});
  const [prev, setPrev] = useState(dataQ.data);
  if (prev !== dataQ.data) {
    setPrev(dataQ.data);
    if (dataQ.data && board) setCols(orderColumns(dataQ.data, board));
  }
  const active = useMemo(() => (board?.columns ?? []).filter((c) => c.status !== "Archived"), [board]);
  const archived = useMemo(() => (board?.columns ?? []).filter((c) => c.status === "Archived"), [board]);
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["kanban-board", boardName] });
    qc.invalidateQueries({ queryKey: ["kanban-data", boardName] });
  }, [qc, boardName]);

  const move = async (name: string, from: string, to: string, toIndex: number) => {
    const card = cols[from]?.cards.find((c) => c.name === name);
    if (!card || !board) return;
    const next = moved(cols, card, from, to, toIndex, board.field_name);
    const before = cols;
    setCols(next);
    try {
      await deskCall(`${API}.update_order_for_single_card`, {
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
      toast.error(errText(e, "Could not move card"), { duration: 8000 });
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
    const idx = dropIndex(cols, id, overId, from, to);
    if (from === to && cols[from].cards.findIndex((c) => c.name === id) === idx) return;
    void move(id, from, to, idx);
  };

  const loadMore = async (col: string) => {
    try {
      const { env } = await deskCall(`${API}.get_kanban_column_page`, { board_name: boardName, column_name: col, kanban_start: cols[col]?.cards.length ?? 0, kanban_page_length: PAGE, ...reportArgs });
      const m = env.message as { total: number; cards: unknown };
      const have = new Set((cols[col]?.cards ?? []).map((c) => c.name));
      const more = uncompress(m.cards).filter((c) => !have.has(c.name));
      setCols((cs) => ({ ...cs, [col]: { total: m.total, cards: [...(cs[col]?.cards ?? []), ...more] } }));
    } catch (e) {
      toast.error(errText(e, "Could not load cards"));
    }
  };

  const columnAction = async (method: "add_column" | "archive_restore_column", args: Record<string, unknown>) => {
    try {
      await deskCall(`${API}.${method}`, { board_name: boardName, ...args });
      refresh();
    } catch (e) {
      toast.error(errText(e, "Could not update board"), { duration: 8000 });
    }
  };

  return {
    board,
    boardError: boardQ.error,
    loading: dataQ.isLoading,
    fetching: dataQ.isFetching,
    titleField,
    cardFields,
    cols,
    active,
    archived,
    refresh,
    move,
    loadMore,
    columnAction,
    dnd: { sensors, dragging, onDragStart, onDragEnd, onDragCancel: () => setDragging(null) },
  };
}
