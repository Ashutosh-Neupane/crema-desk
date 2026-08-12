"use client";

import { useCallback, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, MoreHorizontal } from "lucide-react";

interface KanbanCardData {
  id: string;
  title: string;
  column: string;
  data?: Record<string, unknown>;
}

interface KanbanCardProps {
  card: KanbanCardData;
  onEdit?: (card: KanbanCardData) => void;
  onDelete?: (card: KanbanCardData) => void;
  onClick?: (card: KanbanCardData) => void;
  compact?: boolean;
  /** When true, renders a static placeholder (used inside DragOverlay) */
  overlay?: boolean;
}

export function KanbanCard({
  card,
  onEdit,
  onDelete,
  onClick,
  compact = false,
  overlay = false,
}: KanbanCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1, // hide original while DragOverlay shows clone
      };

  const handleClick = useCallback(() => {
    if (!overlay && !isDragging) onClick?.(card);
  }, [isDragging, onClick, card, overlay]);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={[
        "group relative rounded-lg border bg-white dark:bg-zinc-800 shadow-sm transition-shadow",
        overlay
          ? "border-blue-400 shadow-xl rotate-2 cursor-grabbing"
          : "border-zinc-200 dark:border-zinc-700 hover:shadow-md cursor-grab active:cursor-grabbing",
        isDragging && !overlay ? "opacity-0" : "",
      ].join(" ")}
    >
      {/* Drag handle — only on the handle div, not the whole card */}
      <div
        {...(overlay ? {} : { ...attributes, ...listeners })}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab touch-none opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 text-zinc-300" aria-hidden="true" />
      </div>

      {/* Clickable card body */}
      <div
        role={overlay ? undefined : "button"}
        tabIndex={overlay ? undefined : 0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (!overlay && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label={`Open ${card.title}`}
        className="p-3 pl-6 pr-8"
      >
        <p className={`font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
          {card.title}
        </p>

        {typeof card.data?.modified === "string" && (
          <p className="mt-1 text-[11px] text-zinc-400">
            {new Date(card.data.modified as string).toLocaleDateString()}
          </p>
        )}

        {typeof card.data?.docstatus === "number" && (
          <div className="mt-1.5">
            <span
              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                card.data.docstatus === 1
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : card.data.docstatus === 2
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
              }`}
            >
              {card.data.docstatus === 1
                ? "Submitted"
                : card.data.docstatus === 2
                ? "Cancelled"
                : "Draft"}
            </span>
          </div>
        )}
      </div>

      {/* Context menu button */}
      {!overlay && (
        <div className="absolute right-1.5 top-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            aria-label="Card options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-opacity"
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-6 z-50 w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
            >
              {onEdit && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(card); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(card); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { KanbanCardData };
