"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Archive, RotateCcw } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import type { KanbanCardData } from "./KanbanCard";

interface KanbanColumnProps {
  id: string;
  title: string;
  cards: KanbanCardData[];
  color?: string;
  archived?: boolean;
  onAddCard?: (columnId: string) => void;
  onEditCard?: (card: KanbanCardData) => void;
  onDeleteCard?: (card: KanbanCardData) => void;
  onCardClick?: (card: KanbanCardData) => void;
  onArchiveColumn?: (columnId: string) => void;
  onRestoreColumn?: (columnId: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  blue:   "border-blue-400   bg-blue-50   dark:bg-blue-950/20   dark:border-blue-700",
  green:  "border-green-400  bg-green-50  dark:bg-green-950/20  dark:border-green-700",
  purple: "border-purple-400 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-700",
  yellow: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700",
  red:    "border-red-400    bg-red-50    dark:bg-red-950/20    dark:border-red-700",
  zinc:   "border-zinc-300   bg-zinc-50   dark:border-zinc-700  dark:bg-zinc-900/50",
};

const DOT_MAP: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500", purple: "bg-purple-500",
  yellow: "bg-yellow-500", red: "bg-red-500", zinc: "bg-zinc-400",
};

export function KanbanColumn({
  id,
  title,
  cards,
  color = "zinc",
  archived = false,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onCardClick,
  onArchiveColumn,
  onRestoreColumn,
}: KanbanColumnProps) {
  // Make the column a drop zone for cards dragged from other columns
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column", columnId: id } });

  const cardIds = cards.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      aria-label={`Column: ${title}`}
      className={[
        "flex w-72 shrink-0 flex-col rounded-xl border-2 transition-colors",
        COLOR_MAP[color] ?? COLOR_MAP.zinc,
        isOver ? "ring-2 ring-blue-400 ring-offset-1" : "",
        archived ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${DOT_MAP[color] ?? DOT_MAP.zinc}`}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {title}
          </h3>
          <span
            aria-label={`${cards.length} cards`}
            className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          >
            {cards.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          {!archived && onAddCard && (
            <button
              type="button"
              onClick={() => onAddCard(id)}
              aria-label={`Add card to ${title}`}
              title="Add card"
              className="rounded p-1 hover:bg-white/60 dark:hover:bg-zinc-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            </button>
          )}
          {!archived && onArchiveColumn && (
            <button
              type="button"
              onClick={() => onArchiveColumn(id)}
              aria-label={`Archive column ${title}`}
              title="Archive column"
              className="rounded p-1 hover:bg-white/60 dark:hover:bg-zinc-700 transition-colors"
            >
              <Archive className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            </button>
          )}
          {archived && onRestoreColumn && (
            <button
              type="button"
              onClick={() => onRestoreColumn(id)}
              aria-label={`Restore column ${title}`}
              title="Restore column"
              className="rounded p-1 hover:bg-white/60 dark:hover:bg-zinc-700 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Cards list — SortableContext enables within-column reordering */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div
          className="flex-1 space-y-2 overflow-y-auto px-2 pb-2"
          style={{ minHeight: "4rem" }} // ensures column is droppable even when empty
        >
          {cards.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-zinc-400 italic">No cards</p>
            </div>
          ) : (
            cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
                onClick={onCardClick}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add card footer */}
      {!archived && onAddCard && (
        <button
          type="button"
          onClick={() => onAddCard(id)}
          aria-label={`Add card to ${title}`}
          className="flex items-center justify-center gap-1 rounded-b-lg border-t border-zinc-200/80 px-3 py-2 text-xs text-zinc-500 hover:bg-white/50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Card
        </button>
      )}
    </div>
  );
}
