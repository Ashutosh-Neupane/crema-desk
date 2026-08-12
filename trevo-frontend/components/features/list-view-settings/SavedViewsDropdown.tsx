"use client";

import { useState, useRef, useEffect } from "react";
import { Bookmark, BookmarkPlus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useSavedViews, useCreateSavedView, useDeleteSavedView } from "@/lib/hooks/useSavedViews";
import type { SavedView } from "@/lib/hooks/useSavedViews";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { toast } from "sonner";

interface SavedViewsDropdownProps {
  doctype: string;
  /** Currently active saved view name (empty = default) */
  activeView: string;
  /** Current list state to persist when saving */
  currentState: {
    fields?: string[];
    filters?: unknown;
    sort_by?: string;
    sort_order?: string;
    group_by?: string;
  };
  onLoadView: (view: SavedView) => void;
  onClearView: () => void;
}

export function SavedViewsDropdown({
  doctype,
  activeView,
  currentState,
  onLoadView,
  onClearView,
}: SavedViewsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: views = [], isLoading } = useSavedViews(doctype);
  const createView = useCreateSavedView(doctype);
  const deleteView = useDeleteSavedView(doctype);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleSave = async () => {
    if (!viewName.trim()) return;
    try {
      await createView.mutateAsync({
        name: viewName.trim(),
        fields: JSON.stringify(currentState.fields ?? []),
        filters: JSON.stringify(currentState.filters ?? []),
        sort_by: currentState.sort_by ?? "modified",
        sort_order: currentState.sort_order ?? "desc",
        group_by: currentState.group_by ?? "",
      });
      toast.success(`View "${viewName}" saved`);
      setSaveDialogOpen(false);
      setViewName("");
    } catch {
      toast.error("Failed to save view");
    }
  };

  const handleDelete = async (viewName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteView.mutateAsync(viewName);
      toast.success("View deleted");
      if (activeView === viewName) onClearView();
    } catch {
      toast.error("Failed to delete view");
    }
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-label="Saved views"
          aria-expanded={open}
          className={[
            "gap-1.5",
            activeView ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300" : "",
          ].join(" ")}
        >
          <Bookmark className="h-4 w-4" />
          {activeView || "Views"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>

        {open && (
          <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="p-1">
              {/* Save current view */}
              <button
                type="button"
                onClick={() => { setSaveDialogOpen(true); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <BookmarkPlus className="h-4 w-4 text-zinc-400" />
                Save current view…
              </button>

              {/* Clear active view */}
              {activeView && (
                <button
                  type="button"
                  onClick={() => { onClearView(); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-700"
                >
                  ✕ Reset to default view
                </button>
              )}

              {/* Divider */}
              {views.length > 0 && (
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
              )}

              {/* Saved view list */}
              {isLoading ? (
                <p className="px-3 py-2 text-xs text-zinc-400">Loading…</p>
              ) : views.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-400 italic">No saved views yet</p>
              ) : (
                views.map((view) => (
                  <div
                    key={view.name}
                    className={[
                      "group flex items-center justify-between rounded px-3 py-2 cursor-pointer transition-colors",
                      activeView === view.name
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300",
                    ].join(" ")}
                    onClick={() => { onLoadView(view); setOpen(false); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onLoadView(view)}
                    aria-pressed={activeView === view.name}
                    aria-label={`Load view: ${view.name}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bookmark className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      <span className="truncate text-sm">{view.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(view.name, e)}
                      aria-label={`Delete view ${view.name}`}
                      className="hidden group-hover:flex ml-2 flex-shrink-0 items-center rounded p-0.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Save the current filters, sort, and grouping as a named view.
            </p>
            <div>
              <Label htmlFor="view-name">View name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Open Orders, My Tasks…"
                className="mt-1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!viewName.trim() || createView.isPending}
            >
              {createView.isPending ? "Saving…" : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
