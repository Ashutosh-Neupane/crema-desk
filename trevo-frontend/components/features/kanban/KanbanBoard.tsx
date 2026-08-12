"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, Settings, RotateCcw } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import type { KanbanCardData } from "./KanbanCard";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { subscribeListUpdate, subscribeDocUpdate } from "@/lib/services/realtime";

interface KanbanColumnData {
  id: string;
  title: string;
  order: number;
  status: "active" | "archived";
  color?: string;
}

interface KanbanBoardData {
  name?: string;
  field_name: string;
  column_field: string;
}

interface KanbanBoardProps {
  doctype: string;
}

const DEFAULT_COLORS = ["blue", "green", "purple", "yellow", "red", "zinc"];

export function KanbanBoard({ doctype }: KanbanBoardProps) {
  const qc = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [localCards, setLocalCards] = useState<KanbanCardData[]>([]);
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);

  // Dialogs
  const [addCardDialog, setAddCardDialog] = useState({ open: false, columnId: "" });
  const [newCardTitle, setNewCardTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["kanban", doctype],
    queryFn: async (): Promise<{ board: KanbanBoardData; columns: KanbanColumnData[]; cards: KanbanCardData[] }> => {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`);
      if (!res.ok) throw new Error("Failed to fetch kanban data");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Sync local cards from server data (adjust-state-during-render pattern)
  const fetchedCards = data?.cards;
  const [lastFetchedCards, setLastFetchedCards] = useState(fetchedCards);
  if (fetchedCards !== lastFetchedCards) {
    setLastFetchedCards(fetchedCards);
    if (fetchedCards) setLocalCards(fetchedCards);
  }

  const columns = useMemo<KanbanColumnData[]>(() => data?.columns ?? [], [data?.columns]);
  const board: KanbanBoardData | undefined = data?.board;

  const activeColumns = useMemo(
    () => columns.filter((c) => c.status !== "archived").sort((a, b) => a.order - b.order),
    [columns],
  );
  const archivedColumns = useMemo(
    () => columns.filter((c) => c.status === "archived"),
    [columns],
  );

  // ── dnd-kit sensors ────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = localCards.find((c) => c.id === String(event.active.id));
    if (card) setActiveCard(card);
  }, [localCards]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const cardId = String(active.id);
    const card = localCards.find((c) => c.id === cardId);
    if (!card) return;

    // Determine target column
    let targetColumnId: string;
    const asColumn = columns.find((c) => c.id === String(over.id));
    if (asColumn) {
      targetColumnId = asColumn.id;
    } else {
      const overCard = localCards.find((c) => c.id === String(over.id));
      targetColumnId = overCard?.column ?? card.column;
    }

    if (targetColumnId === card.column) {
      // Same column — reorder
      const sameColCards = localCards.filter((c) => c.column === card.column);
      const oldIdx = sameColCards.findIndex((c) => c.id === cardId);
      const overCard = localCards.find((c) => c.id === String(over.id));
      const newIdx = overCard ? sameColCards.findIndex((c) => c.id === overCard.id) : oldIdx;
      if (oldIdx !== newIdx) {
        const reordered = arrayMove(sameColCards, oldIdx, newIdx);
        setLocalCards((prev) => {
          const others = prev.filter((c) => c.column !== card.column);
          return [...others, ...reordered];
        });
      }
      return;
    }

    // Different column — move card
    const previous = card.column;
    // Optimistic
    setLocalCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, column: targetColumnId } : c)),
    );

    try {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_card",
          card_id: cardId,
          column: targetColumnId,
          data: { column_field: board?.column_field ?? "status" },
        }),
      });
      if (!res.ok) throw new Error("Move failed");
      toast.success("Card moved");
    } catch {
      // Revert
      setLocalCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, column: previous } : c)),
      );
      toast.error("Failed to move card");
    }
  }, [localCards, columns, board, doctype]);

  // ── Card mutations ─────────────────────────────────────────────────────────
  const createCard = useMutation({
    mutationFn: async ({ title, column }: { title: string; column: string }) => {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_card",
          column,
          data: {
            [board?.field_name ?? "subject"]: title,
            column_field: board?.column_field ?? "status",
          },
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json();
    },
    onSuccess: () => { refetch(); toast.success("Card created"); },
    onError: () => toast.error("Failed to create card"),
  });

  const handleAddCard = useCallback(async () => {
    if (!newCardTitle.trim()) return;
    await createCard.mutateAsync({ title: newCardTitle.trim(), column: addCardDialog.columnId });
    setNewCardTitle("");
    setAddCardDialog({ open: false, columnId: "" });
  }, [newCardTitle, addCardDialog.columnId, createCard]);

  // ── Column mutations ───────────────────────────────────────────────────────
  const handleAddColumn = useCallback(async () => {
    if (!newColumnName.trim()) return;
    try {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_column",
          column_name: newColumnName.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Column "${newColumnName}" added`);
      setNewColumnName("");
      setAddColumnOpen(false);
      refetch();
    } catch {
      toast.error("Failed to add column");
    }
  }, [newColumnName, doctype, refetch]);

  const handleArchiveColumn = useCallback(async (columnId: string) => {
    try {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_column", column_id: columnId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Column archived");
      refetch();
    } catch {
      toast.error("Failed to archive column");
    }
  }, [doctype, refetch]);

  const handleRestoreColumn = useCallback(async (columnId: string) => {
    try {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_column", column_id: columnId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Column restored");
      refetch();
    } catch {
      toast.error("Failed to restore column");
    }
  }, [doctype, refetch]);

  // ── Board creation ─────────────────────────────────────────────────────────
  const handleCreateBoard = useCallback(async () => {
    if (!newBoardName.trim()) return;
    try {
      const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/kanban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_board",
          board_name: newBoardName.trim(),
          doctype,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Board "${newBoardName}" created`);
      setNewBoardName("");
      setCreateBoardOpen(false);
      refetch();
    } catch {
      toast.error("Failed to create board");
    }
  }, [newBoardName, doctype, refetch]);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubList = subscribeListUpdate((e) => {
      if (e.doctype === doctype) {
        qc.invalidateQueries({ queryKey: ["kanban", doctype] });
      }
    });
    const unsubDoc = subscribeDocUpdate((e) => {
      if (e.doctype === doctype) {
        qc.invalidateQueries({ queryKey: ["kanban", doctype] });
      }
    });
    return () => { unsubList(); unsubDoc(); };
  }, [doctype, qc]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleCardClick = useCallback((card: KanbanCardData) => {
    window.location.href = `/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(card.id)}`;
  }, [doctype]);

  const handleDeleteCard = useCallback(async (card: KanbanCardData) => {
    if (!confirm(`Delete "${card.title}"?`)) return;
    try {
      await fetch(`/api/doctype/${encodeURIComponent(doctype)}/doc/${encodeURIComponent(card.id)}`, {
        method: "DELETE",
      });
      setLocalCards((prev) => prev.filter((c) => c.id !== card.id));
      toast.success("Card deleted");
    } catch {
      toast.error("Failed to delete card");
    }
  }, [doctype]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" aria-label="Loading kanban board">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-sm text-zinc-500">No Kanban board configured for {doctype}</p>
        <Button onClick={() => setCreateBoardOpen(true)}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
          Create Board
        </Button>

        <Dialog open={createBoardOpen} onOpenChange={setCreateBoardOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Create Kanban Board</DialogTitle></DialogHeader>
            <div>
              <Label htmlFor="new-board-name">Board Name</Label>
              <Input id="new-board-name" value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} placeholder="My Board" className="mt-1" autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBoardOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateBoard} disabled={!newBoardName.trim()}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" role="region" aria-label={`Kanban board for ${doctype}`}>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Kanban Board</h2>
        <div className="flex items-center gap-2">
          {archivedColumns.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              aria-pressed={showArchived}
              className="flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {showArchived ? "Hide Archived" : `Archived (${archivedColumns.length})`}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-1 h-4 w-4" aria-hidden="true" />
            Settings
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Active columns */}
          {activeColumns.map((col, idx) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              cards={localCards.filter((c) => c.column === col.id)}
              color={col.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
              onAddCard={(cid) => setAddCardDialog({ open: true, columnId: cid })}
              onEditCard={handleCardClick}
              onDeleteCard={handleDeleteCard}
              onCardClick={handleCardClick}
              onArchiveColumn={handleArchiveColumn}
            />
          ))}

          {/* Archived columns (when toggled visible) */}
          {showArchived && archivedColumns.map((col, idx) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              cards={localCards.filter((c) => c.column === col.id)}
              color={col.color ?? DEFAULT_COLORS[(activeColumns.length + idx) % DEFAULT_COLORS.length]}
              archived
              onRestoreColumn={handleRestoreColumn}
            />
          ))}

          {/* Add column button */}
          <div className="flex w-72 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setAddColumnOpen(true)}
              aria-label="Add new column"
              className="flex flex-col items-center gap-2 py-8 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
              <span className="text-sm">Add Column</span>
            </button>
          </div>
        </div>

        {/* Drag overlay — shows a floating clone while dragging */}
        <DragOverlay>
          {activeCard ? (
            <KanbanCard card={activeCard} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Add Card Dialog ── */}
      <Dialog open={addCardDialog.open} onOpenChange={(o) => setAddCardDialog({ open: o, columnId: "" })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Card</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="new-card-title">Title</Label>
            <Input
              id="new-card-title"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Card title…"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddCard()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCardDialog({ open: false, columnId: "" })}>Cancel</Button>
            <Button onClick={handleAddCard} disabled={!newCardTitle.trim() || createCard.isPending}>
              {createCard.isPending ? "Adding…" : "Add Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Column Dialog ── */}
      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Column</DialogTitle></DialogHeader>
          <div>
            <Label htmlFor="new-col-name">Column Name</Label>
            <Input
              id="new-col-name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="e.g. In Review, Done…"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColumnOpen(false)}>Cancel</Button>
            <Button onClick={handleAddColumn} disabled={!newColumnName.trim()}>Add Column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settings Dialog ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Kanban Settings — {doctype}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Board</p>
              <p className="text-sm text-zinc-500">{board?.name ?? "—"}</p>
              <p className="text-xs text-zinc-400 mt-1">
                Title field: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{board?.field_name ?? "subject"}</code>{" "}
                Column field: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{board?.column_field ?? "status"}</code>
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Active Columns ({activeColumns.length})
              </p>
              <div className="space-y-1.5">
                {activeColumns.map((col) => (
                  <div key={col.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{col.title}</span>
                    <button
                      type="button"
                      onClick={() => handleArchiveColumn(col.id)}
                      aria-label={`Archive ${col.title}`}
                      className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {archivedColumns.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-500">Archived Columns</p>
                <div className="space-y-1.5">
                  {archivedColumns.map((col) => (
                    <div key={col.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 opacity-60 dark:border-zinc-700">
                      <span className="text-sm text-zinc-500">{col.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRestoreColumn(col.id)}
                        aria-label={`Restore ${col.title}`}
                        className="text-xs text-zinc-400 hover:text-green-600 transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => { setAddColumnOpen(true); setSettingsOpen(false); }}>
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              Add New Column
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { KanbanColumnData, KanbanBoardData };
