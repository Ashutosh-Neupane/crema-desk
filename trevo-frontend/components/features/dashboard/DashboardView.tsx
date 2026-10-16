"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import {
  BarChart3, TrendingUp, RefreshCw, Settings2, Plus, Trash2,
  GripVertical, X,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
} from "@/components/charts";
import { useDashboardChart, useNumberCard } from "@/lib/hooks/useDashboardChart";
import { Button } from "@/components/shadcn/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

type WidgetType = "chart" | "number_card";

interface DashboardWidget {
  id: string; // unique within dashboard (chart_name or number_card_name)
  type: WidgetType;
  name: string; // Frappe document name
  label?: string;
  width?: "full" | "half" | "third";
}

interface DashboardData {
  name: string;
  title: string;
  module?: string;
  charts?: Array<{ chart_name: string; label?: string; width?: string }>;
  number_cards?: Array<{ number_card_name: string; label?: string }>;
}

// ─── Main component ──────────────────────────────────────────────────────────

interface DashboardViewProps {
  dashboardName: string;
}

export function DashboardView({ dashboardName }: DashboardViewProps) {
  const qc = useQueryClient();
  const [customizeMode, setCustomizeMode] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [newWidgetName, setNewWidgetName] = useState("");
  const [newWidgetType, setNewWidgetType] = useState<WidgetType>("chart");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Fetch dashboard document
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard-doc", dashboardName],
    queryFn: async () => {
      // Dashboard DocType: charts = Dashboard Chart Link {chart, width}, cards = Number Card Link {card}
      const res = await fetch(`/api/frappe/api/resource/Dashboard/${encodeURIComponent(dashboardName)}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const doc = ((await res.json()) as { data?: {
        dashboard_name?: string;
        module?: string;
        charts?: Array<{ chart: string; width?: string }>;
        cards?: Array<{ card: string }>;
      } }).data ?? {};
      const json = {
        title: doc.dashboard_name,
        module: doc.module,
        charts: (doc.charts ?? []).map((c) => ({
          chart_name: c.chart,
          width: c.width === "Full" ? "full" : "half",
        })),
        number_cards: (doc.cards ?? []).map((c) => ({ number_card_name: c.card })),
      } as {
        title?: string;
        module?: string;
        charts?: Array<{ chart_name: string; label?: string; width?: string }>;
        number_cards?: Array<{ number_card_name: string; label?: string }>;
      };
      // Build widget list from response
      const built: DashboardWidget[] = [
        ...(json.charts ?? []).map((c) => ({
          id: `chart_${c.chart_name}`,
          type: "chart" as WidgetType,
          name: c.chart_name,
          label: c.label,
          width: (c.width ?? "half") as "full" | "half" | "third",
        })),
        ...(json.number_cards ?? []).map((n) => ({
          id: `nc_${n.number_card_name}`,
          type: "number_card" as WidgetType,
          name: n.number_card_name,
          label: n.label,
          width: "third" as const,
        })),
      ];
      setWidgets(built);
      return { name: dashboardName, title: json.title ?? dashboardName, module: json.module };
    },
    staleTime: 60_000,
  });

  // Save widget order back to Frappe
  const saveMutation = useMutation({
    mutationFn: async (ws: DashboardWidget[]) => {
      const res = await fetch(`/api/frappe/api/resource/Dashboard/${encodeURIComponent(dashboardName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charts: ws.filter((w) => w.type === "chart").map((w) => ({
            chart: w.name,
            width: w.width === "full" ? "Full" : "Half",
          })),
          cards: ws.filter((w) => w.type === "number_card").map((w) => ({ card: w.name })),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => { toast.success("Dashboard saved"); qc.invalidateQueries({ queryKey: ["dashboard-doc", dashboardName] }); },
    onError: () => toast.error("Failed to save dashboard"),
  });

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    setWidgets((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === String(active.id));
      const newIdx = prev.findIndex((w) => w.id === String(over.id));
      return arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const handleRemoveWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleAddWidget = useCallback(() => {
    if (!newWidgetName.trim()) return;
    const id = `${newWidgetType}_${newWidgetName.trim()}`;
    if (widgets.some((w) => w.id === id)) {
      toast.error("Widget already on dashboard");
      return;
    }
    setWidgets((prev) => [...prev, { id, type: newWidgetType, name: newWidgetName.trim() }]);
    setNewWidgetName("");
    setAddWidgetOpen(false);
    toast.success("Widget added");
  }, [newWidgetName, newWidgetType, widgets]);

  const handleSave = async () => {
    await saveMutation.mutateAsync(widgets);
    setCustomizeMode(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading dashboard">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-1/2 rounded bg-zinc-100 dark:bg-zinc-700" />
              <div className="h-40 rounded bg-zinc-100 dark:bg-zinc-700" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const draggingWidget = widgets.find((w) => w.id === draggingId) ?? null;

  return (
    <div className="space-y-6" role="region" aria-label={`Dashboard: ${data.title}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{data.title}</h1>
          {data.module && <p className="text-sm text-zinc-500">{data.module}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} aria-label="Refresh dashboard">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          {customizeMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setCustomizeMode(false); refetch(); }}>
                <X className="mr-1 h-4 w-4" aria-hidden="true" /> Discard
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save Layout"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCustomizeMode(true)}>
              <Settings2 className="mr-1 h-4 w-4" aria-hidden="true" /> Customize
            </Button>
          )}
        </div>
      </div>

      {/* Widget grid */}
      {widgets.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <p className="mt-2 text-sm text-zinc-500">No widgets on this dashboard.</p>
          {customizeMode && (
            <Button className="mt-4" size="sm" onClick={() => setAddWidgetOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Widget
            </Button>
          )}
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setDraggingId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {widgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  customizeMode={customizeMode}
                  onRemove={handleRemoveWidget}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {draggingWidget ? (
              <div className="rounded-xl border border-blue-400 bg-white/80 shadow-2xl dark:bg-zinc-800/80 p-4">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{draggingWidget.label ?? draggingWidget.name}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add widget button when in customize mode */}
      {customizeMode && widgets.length > 0 && (
        <Button variant="outline" className="w-full" onClick={() => setAddWidgetOpen(true)}>
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add Widget
        </Button>
      )}

      {/* Add Widget Dialog */}
      <Dialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Widget</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="widget-type">Widget Type</Label>
              <select
                id="widget-type"
                value={newWidgetType}
                onChange={(e) => setNewWidgetType(e.target.value as WidgetType)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="chart">Dashboard Chart</option>
                <option value="number_card">Number Card</option>
              </select>
            </div>
            <div>
              <Label htmlFor="widget-name">
                {newWidgetType === "chart" ? "Chart Name" : "Number Card Name"}
              </Label>
              <Input
                id="widget-name"
                value={newWidgetName}
                onChange={(e) => setNewWidgetName(e.target.value)}
                placeholder="e.g. Sales Analytics"
                className="mt-1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddWidget()}
              />
              <p className="mt-1 text-xs text-zinc-400">Must match the Frappe document name exactly.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWidgetOpen(false)}>Cancel</Button>
            <Button onClick={handleAddWidget} disabled={!newWidgetName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sortable Widget wrapper ──────────────────────────────────────────────────

function SortableWidget({
  widget,
  customizeMode,
  onRemove,
}: {
  widget: DashboardWidget;
  customizeMode: boolean;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !customizeMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const colSpan =
    widget.width === "full"
      ? "col-span-1 sm:col-span-2 lg:col-span-3"
      : widget.width === "half"
      ? "col-span-1 sm:col-span-2"
      : "col-span-1";

  return (
    <div ref={setNodeRef} style={style} className={`relative group ${colSpan}`}>
      {/* Customize mode controls */}
      {customizeMode && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onRemove(widget.id)}
            aria-label={`Remove ${widget.label ?? widget.name}`}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </button>
          <div
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-zinc-700 text-white shadow-md active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3" aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Widget content */}
      {widget.type === "chart" ? (
        <ChartWidget name={widget.name} label={widget.label} />
      ) : (
        <NumberCardWidget name={widget.name} label={widget.label} />
      )}
    </div>
  );
}

// ─── Individual widget renderers ─────────────────────────────────────────────

function ChartWidget({ name, label }: { name: string; label?: string }) {
  const [timespan, setTimespan] = useState("Last Year");
  const { data, isLoading, error } = useDashboardChart(name, { timespan });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {data?.title ?? label ?? name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timespan}
            onChange={(e) => setTimespan(e.target.value)}
            aria-label="Chart timespan"
            className="rounded border border-zinc-200 bg-transparent px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          >
            {["Last Week", "Last Month", "Last Quarter", "Last Year", "All Time"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <BarChart3 className="h-4 w-4 text-zinc-400" aria-hidden="true" />
        </div>
      </div>

      <div className="h-56">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" aria-label="Loading chart" />
          </div>
        ) : error || !data?.rows?.length ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400 italic">
            No data available
          </div>
        ) : data.chart_type === "line" ? (
          <LineChartComponent data={data.rows} xKey={data.xKey} yKey={data.yKey} />
        ) : data.chart_type === "donut" || data.chart_type === "percentage" ? (
          <PieChartComponent data={data.rows} nameKey={data.xKey} valueKey={data.yKey} />
        ) : (
          <BarChartComponent data={data.rows} xKey={data.xKey} yKey={data.yKey} />
        )}
      </div>
    </Card>
  );
}

function NumberCardWidget({ name, label }: { name: string; label?: string }) {
  const { data, isLoading } = useNumberCard(name);

  const displayValue = isLoading
    ? null
    : data?.value != null
    ? typeof data.value === "number"
      ? data.value.toLocaleString()
      : String(data.value)
    : "—";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{data?.label ?? label ?? name}</p>
          {isLoading ? (
            <div className="mt-1 h-8 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700" aria-label="Loading" />
          ) : (
            <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              {displayValue}
            </p>
          )}
          {data?.doctype && (
            <p className="mt-0.5 text-xs text-zinc-400">{data.doctype}</p>
          )}
        </div>
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${data?.color ?? "#2490ef"}20` }}
          aria-hidden="true"
        >
          <TrendingUp className="h-5 w-5" style={{ color: data?.color ?? "#2490ef" }} />
        </div>
      </div>
    </Card>
  );
}

export type { DashboardWidget };
