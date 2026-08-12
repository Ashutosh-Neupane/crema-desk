"use client";


import React, { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Search, Download, Upload } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useList } from "@/lib/hooks/useList";
import { useListCount } from "@/lib/hooks/useList";
import type { FilterOperator, FrappeDocument } from "@/lib/frappe/types";
import { formatFieldValue } from "@/lib/trevo-form/meta/parseDoctypeMeta";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { TableSkeleton } from "@/components/Skeleton";
import ListFilters from "@/components/ListFilters";
import type { FilterDef as BasicFilterDef } from "@/components/ListFilters";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { KanbanBoard } from "@/components/features/kanban";
import { GanttView } from "@/components/features/gantt";
import { TreeView } from "@/components/features/tree";
import { ImageView } from "@/components/features/image";
import { BulkActions } from "@/components/features/bulk-operations";
import { AdvancedFilters } from "@/components/features/list-filters";
import type { FilterGroup, SavedFilterLayout } from "@/components/features/list-filters";
import { ExportDialog } from "@/components/features/data-import";
import { ImportDialog } from "@/components/features/data-import";
import type { ImportOptions, ImportResult } from "@/components/features/data-import";
import { GroupBySelector } from "@/components/features/list-filters/GroupBySelector";
import { SavedViewsDropdown } from "@/components/features/list-view-settings/SavedViewsDropdown";
import type { SavedView } from "@/lib/hooks/useSavedViews";
import { subscribeListUpdate } from "@/lib/services/realtime";
import { WifiOff } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function DoctypeListView() {
  const params = useParams<{ doctype: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const doctype = decodeURIComponent(params.doctype);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string>("modified");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterState, setFilterState] = useState<Record<string, { value: string; operator: FilterOperator; valueTo?: string }>>({});
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [groupBy, setGroupBy] = useState<string>("");
  const [activeView, setActiveView] = useState<string>("");
  const [refreshAvailable, setRefreshAvailable] = useState(false);

  const { data: meta } = useDoctype(doctype);
  const isSubmittable = !!meta?.is_submittable;

  useEffect(() => {
    if (!doctype) return;
    const unsub = subscribeListUpdate((data) => {
      if (data.doctype === doctype) {
        setRefreshAvailable(true);
      }
    });
    return unsub;
  }, [doctype]);

  type ViewMode = "list" | "kanban" | "gantt" | "tree" | "image";

  // Metadata-driven view tabs: show only views this doctype actually supports
  const availableViews = useMemo<ViewMode[]>(() => {
    if (!meta) return ["list"];
    const views: ViewMode[] = ["list"];
    if (meta.is_tree || meta.fields?.some((f) => f.fieldtype === "Tree")) views.push("tree");
    if (meta.fields?.some((f) => ["Date", "Datetime"].includes(f.fieldtype))) views.push("gantt");
    if (meta.fields?.some((f) => ["Attach Image", "Attach"].includes(f.fieldtype))) views.push("image");
    views.push("kanban");
    return views;
  }, [meta]);

  const syncFiltersToUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (sortBy !== "modified") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (pageSize !== 20) params.set("pageSize", String(pageSize));
    if (searchQuery) params.set("search", searchQuery);
    if (viewMode !== "list") params.set("view", viewMode);
    if (groupBy) params.set("groupBy", groupBy);
    for (const [field, { value, operator, valueTo }] of Object.entries(filterState)) {
      if (value) {
        params.set(`f_${field}`, `${operator}:${value}${valueTo ? `:${valueTo}` : ""}`);
      }
    }
    const qs = params.toString();
    const newUrl = qs ? `/desk/doctype/${encodeURIComponent(doctype)}?${qs}` : `/desk/doctype/${encodeURIComponent(doctype)}`;
    router.replace(newUrl, { scroll: false });
  }, [doctype, router, sortBy, sortOrder, pageSize, searchQuery, viewMode, groupBy, filterState]);

  const loadFiltersFromUrl = useCallback(() => {
    const sort = searchParams.get("sortBy");
    const order = searchParams.get("sortOrder");
    const ps = searchParams.get("pageSize");
    const search = searchParams.get("search");
    const view = searchParams.get("view");
    if (sort) setSortBy(sort);
    if (order) setSortOrder(order as "asc" | "desc");
    if (ps) setPageSize(Number(ps));
    if (search) setSearchQuery(search);
    if (view && ["list", "kanban", "gantt", "tree", "image"].includes(view)) setViewMode(view as ViewMode);
    const gb = searchParams.get("groupBy");
    if (gb) setGroupBy(gb);
    const newFilterState: Record<string, { value: string; operator: FilterOperator; valueTo?: string }> = {};
    for (const [key, raw] of Array.from(searchParams.entries())) {
      if (key.startsWith("f_")) {
        const fieldname = key.slice(2);
        const [operator, value, valueTo] = raw.split(":");
        newFilterState[fieldname] = { value, operator: operator as FilterOperator, valueTo };
      }
    }
    if (Object.keys(newFilterState).length > 0) setFilterState(newFilterState);
  }, [searchParams]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFiltersFromUrl();
  }, [loadFiltersFromUrl]);

  useEffect(() => {
    syncFiltersToUrl();
  }, [syncFiltersToUrl]);

  const listFields = useMemo(() => {
    const fields = meta?.fields;
    if (!fields) return [];
    return fields.filter((f) => f.in_list_view && !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype));
  }, [meta?.fields]);

  const fieldMappings = useMemo(() => {
    const map: Record<string, { fieldname: string; label: string; fieldtype: string; options?: string }> = {};
    for (const f of listFields) {
      map[f.fieldname] = { fieldname: f.fieldname, label: f.label || f.fieldname, fieldtype: f.fieldtype, options: f.options ?? undefined };
    }
    return map;
  }, [listFields]);

  const exportFields = useMemo(
    () => listFields.map((f) => ({ fieldname: f.fieldname, label: f.label || f.fieldname })),
    [listFields],
  );

  const importFieldMappings = useMemo(
    () => listFields.map((f) => ({ fieldname: f.fieldname, header: f.label || f.fieldname })),
    [listFields],
  );

  const availableFilters: BasicFilterDef[] = useMemo(() => {
    return listFields
      .filter((f) => ["Select", "Autocomplete", "Date", "Datetime", "Time", "Int", "Float", "Currency", "Percent"].includes(f.fieldtype))
      .map((f) => {
        const type = f.fieldtype === "Date" || f.fieldtype === "Datetime" || f.fieldtype === "Time" ? "date" : f.fieldtype === "Int" || f.fieldtype === "Float" || f.fieldtype === "Currency" || f.fieldtype === "Percent" ? "number" : f.fieldtype === "Select" || f.fieldtype === "Autocomplete" ? "select" : "text";
        const operators: FilterOperator[] =
          type === "date" ? ["=", "!=", ">", "<", ">=", "<=", "Between"] :
          type === "number" ? ["=", "!=", ">", "<", ">=", "<=", "Between"] :
          type === "select" ? ["=", "!=", "like", "not like"] :
          ["like", "=", "!=", "is"];
        return {
          fieldname: f.fieldname,
          label: f.label || f.fieldname,
          type,
          options: f.fieldtype === "Select" || f.fieldtype === "Autocomplete" ? (f.options || "").split("\n").map((o) => ({ value: o, label: o })).filter(Boolean) : undefined,
          operators,
        };
      });
  }, [listFields]);

  const filters = useMemo(() => {
    const base = Object.entries(filterState)
      .filter(([, f]) => {
        if (!f.value && !f.valueTo) return false;
        if (f.operator === "Between" && (!f.value || !f.valueTo)) return false;
        return true;
      })
      .map(([fieldname, { value, operator, valueTo }]) => {
        const field = listFields.find((f) => f.fieldname === fieldname);
        const isDate = field?.fieldtype === "Date" || field?.fieldtype === "Datetime";
        let v: unknown = value;
        if (operator === "Between") {
          v = [value, valueTo || ""];
        } else if (!isDate) {
          if (operator === "like") v = `%${value}%`;
          else if (operator === "not like") v = `%${value}%`;
        }
        return [doctype, fieldname, operator, v] as [string, string, FilterOperator, unknown];
      });

    const groupFilters: Array<[string, string, FilterOperator, unknown]> = [];
    for (const group of filterGroups) {
      for (const cond of group.conditions) {
        if (!cond.fieldname || !cond.value) continue;
        const field = listFields.find((f) => f.fieldname === cond.fieldname);
        const isDate = field?.fieldtype === "Date" || field?.fieldtype === "Datetime";
        let v: unknown = cond.value;
        if (cond.operator === "Between") {
          v = [cond.value, cond.valueTo || ""];
        } else if (!isDate) {
          if (cond.operator === "like" || cond.operator === "not like") v = `%${cond.value}%`;
        }
        groupFilters.push([doctype, cond.fieldname, cond.operator, v]);
      }
    }
    return [...base, ...groupFilters];
  }, [filterState, filterGroups, listFields, doctype]);

  const handleFiltersChange = (newFilters: Record<string, { value: string; operator: FilterOperator; valueTo?: string }>) => {
    setFilterState(newFilters);
    setPage(0);
  };

  const handleGroupsChange = (groups: FilterGroup[]) => {
    setFilterGroups(groups);
    setPage(0);
  };

  const [savedLayouts, setSavedLayouts] = useState<SavedFilterLayout[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(`trevo-filter-layouts-${doctype}`);
      return raw ? (JSON.parse(raw) as SavedFilterLayout[]) : [];
    } catch {
      return [];
    }
  });

  const handleSaveLayout = (name: string) => {
    const layout: SavedFilterLayout = {
      id: Math.random().toString(36).substring(2, 10),
      name,
      doctype,
      groups: filterGroups,
      createdAt: new Date().toISOString(),
    };
    const next = [...savedLayouts, layout];
    setSavedLayouts(next);
    try {
      window.localStorage.setItem(`trevo-filter-layouts-${doctype}`, JSON.stringify(next));
    } catch {
      // storage full / unavailable
    }
  };

  const handleLoadLayout = (layout: SavedFilterLayout) => {
    setFilterGroups(layout.groups);
  };

  // Saved views handlers
  const handleLoadView = (view: SavedView) => {
    setActiveView(view.name);
    try {
      if (view.filters) setFilterGroups(JSON.parse(view.filters));
      if (view.sort_by) setSortBy(view.sort_by);
      if (view.sort_order) setSortOrder((view.sort_order as "asc" | "desc") || "desc");
      if (view.group_by !== undefined) setGroupBy(view.group_by ?? "");
    } catch {
      // ignore parse errors
    }
    setPage(0);
  };

  const handleClearView = () => {
    setActiveView("");
    setFilterGroups([]);
    setGroupBy("");
    setSortBy("modified");
    setSortOrder("desc");
    setPage(0);
  };

  const listParams = useMemo(
    () => ({
      ...(listFields.length > 0 ? { fields: listFields.map((f) => f.fieldname) } : {}),
      filters,
      order_by: `${sortBy} ${sortOrder}`,
      limit_start: page * pageSize,
      limit_page_length: pageSize,
    }),
    [listFields, filters, sortBy, sortOrder, page, pageSize],
  );

  const { data: listData, isLoading, refetch } = useList(doctype, listParams);
  const { data: countData } = useListCount(doctype, filters);

  const rows = useMemo(() => (listData as unknown as Array<Record<string, unknown>>) ?? [], [listData]);
  const total = countData ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Group rows by the selected groupBy field
  const groupedRows = useMemo(() => {
    if (!groupBy || rows.length === 0) return null;
    const groups: Record<string, Array<Record<string, unknown>>> = {};
    for (const row of rows) {
      const key = String(row[groupBy] ?? "— Blank —");
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return groups;
  }, [rows, groupBy]);

  const selectedDocs = useMemo(
    () => rows.filter((r) => selectedRows.has(String(r.name))) as FrappeDocument[],
    [rows, selectedRows],
  );

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map((r) => String(r.name))));
    }
  };

  const handleImportFile = async (file: File, _options: ImportOptions): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_type", "Insert New Records");
    formData.append("submit_after", "false");

    const res = await fetch(`/api/doctype/${encodeURIComponent(doctype)}/import`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Import failed" }));
      return { imported: 0, total: 0, errors: [{ row: 0, message: err.error || "Import failed" }] };
    }

    const result = await res.json();
    return {
      imported: result.data ? 1 : 0,
      total: 1,
      errors: result.data ? [] : [{ row: 0, message: result.error || "Import completed with issues" }],
    };
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === "asc" ? " ↑" : " ↓";
  };

  const renderCell = (row: Record<string, unknown>, field: { fieldname: string; label?: string; fieldtype: string }) => {
    const value = row[field.fieldname];
    if (field.fieldname === "docstatus" && typeof value === "number") {
      const statuses: Record<number, { label: string; variant: "default" | "secondary" | "destructive" }> = {
        0: { label: "Draft", variant: "secondary" },
        1: { label: "Submitted", variant: "default" },
        2: { label: "Cancelled", variant: "destructive" },
      };
      const s = statuses[value] ?? { label: "Unknown", variant: "secondary" };
      return <Badge variant={s.variant}>{s.label}</Badge>;
    }
    if (field.fieldtype === "Check") {
      return value ? "Yes" : "No";
    }
    if (field.fieldtype === "Image" || field.fieldtype === "Attach Image") {
      const src = typeof value === "string" ? value : "";
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element -- runtime URL from Frappe backend
        <img src={src} alt="" className="h-8 w-8 rounded object-cover" />
      ) : (
        "-"
      );
    }
    return formatFieldValue(value, field.fieldtype);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{doctype}</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {total}
          </span>
          {/* Customize Form link */}
          <a
            href={`/desk/doctype/${encodeURIComponent(doctype)}/builder`}
            className="ml-2 rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-colors"
            title="Customize form layout"
          >
            Customize
          </a>
          <Tabs
            value={viewMode}
            onValueChange={(v) => {
              if ((v as ViewMode) === viewMode) return;
              setViewMode(v as ViewMode);
              setPage(0);
              setSelectedRows(new Set());
            }}
            className="ml-4"
          >
            <TabsList>
              {availableViews.includes("list") && (
                <TabsTrigger value="list">List</TabsTrigger>
              )}
              {availableViews.includes("kanban") && (
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
              )}
              {availableViews.includes("gantt") && (
                <TabsTrigger value="gantt">Gantt</TabsTrigger>
              )}
              {availableViews.includes("tree") && (
                <TabsTrigger value="tree">Tree</TabsTrigger>
              )}
              {availableViews.includes("image") && (
                <TabsTrigger value="image">Image</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-zinc-300 px-3 py-1.5 pl-9 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          </div>

          <ListFilters filters={filterState} onFiltersChange={handleFiltersChange} availableFilters={availableFilters} />

          <AdvancedFilters
            doctype={doctype}
            groups={filterGroups}
            availableFilters={availableFilters}
            onGroupsChange={handleGroupsChange}
            savedLayouts={savedLayouts}
            onSaveLayout={handleSaveLayout}
            onLoadLayout={handleLoadLayout}
          />

          {/* Group By selector */}
          {meta?.fields && (
            <GroupBySelector
              fields={meta.fields}
              value={groupBy}
              onChange={(f) => { setGroupBy(f); setPage(0); }}
            />
          )}

          {/* Saved Views dropdown */}
          <SavedViewsDropdown
            doctype={doctype}
            activeView={activeView}
            currentState={{
              filters: filterGroups,
              sort_by: sortBy,
              sort_order: sortOrder,
              group_by: groupBy,
            }}
            onLoadView={handleLoadView}
            onClearView={handleClearView}
          />

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4" />
            Export
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>

          <Link
            href={`/desk/doctype/${encodeURIComponent(doctype)}/new`}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New
          </Link>
        </div>
      </div>

      {/* Data table / views */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800 overflow-hidden">
        {/* Realtime refresh banner */}
        {refreshAvailable && (
          <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 dark:border-blue-800 dark:bg-blue-900/20">
            <span className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
              <WifiOff className="h-4 w-4" />
              New changes available
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetch();
                setRefreshAvailable(false);
              }}
            >
              Refresh
            </Button>
          </div>
        )}
        {isLoading ? (
          <TableSkeleton rows={pageSize} cols={listFields.length + 1} />
        ) : viewMode === "kanban" ? (
          <div className="p-4">
            <KanbanBoard doctype={doctype} />
          </div>
        ) : viewMode === "gantt" ? (
          <div className="p-4">
            <GanttView doctype={doctype} />
          </div>
        ) : viewMode === "tree" ? (
          <div className="p-4">
            <TreeView doctype={doctype} />
          </div>
        ) : viewMode === "image" ? (
          <div className="p-4">
            <ImageView doctype={doctype} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-zinc-500">No records found.</p>
          </div>
        ) : (
          <>
            {/* Bulk actions */}
            {selectedRows.size > 0 && (
              <BulkActions
                doctype={doctype}
                selectedDocs={selectedDocs}
                onActionComplete={() => {
                  setSelectedRows(new Set());
                  refetch();
                }}
                isSubmittable={isSubmittable}
                fieldMappings={fieldMappings}
              />
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === rows.length && rows.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-zinc-300"
                      />
                    </th>
                    {listFields.map((field) => (
                      <th
                        key={field.fieldname}
                        onClick={() => handleSort(field.fieldname)}
                        className="px-3 py-3 text-left text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100 select-none"
                      >
                        {field.label || field.fieldname}
                        {SortIcon({ field: field.fieldname })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {groupedRows ? (
                    // Grouped rendering
                    Object.entries(groupedRows).map(([groupKey, groupRows]) => (
                      <GroupSection
                        key={groupKey}
                        label={groupKey}
                        rows={groupRows}
                        listFields={listFields}
                        selectedRows={selectedRows}
                        setSelectedRows={setSelectedRows}
                        renderCell={renderCell}
                        router={router}
                        doctype={doctype}
                      />
                    ))
                  ) : (
                    // Flat rendering
                    rows.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => {
                          const name = String(row.name ?? "");
                          if (name) router.push(`/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
                        }}
                        className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(String(row.name))}
                            onChange={(e) => {
                              const next = new Set(selectedRows);
                              const nameStr = String(row.name);
                              if (e.target.checked) {
                                next.add(nameStr);
                              } else {
                                next.delete(nameStr);
                              }
                              setSelectedRows(next);
                              e.stopPropagation();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-zinc-300"
                          />
                        </td>
                        {listFields.map((field) => (
                          <td key={field.fieldname} className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                             {renderCell(row, field as { fieldname: string; label?: string; fieldtype: string })}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 hover:bg-zinc-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 hover:bg-zinc-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        doctype={doctype}
        data={rows}
        fields={exportFields}
        totalRecords={total}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        doctype={doctype}
        fieldMappings={importFieldMappings}
        onImport={handleImportFile}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupSection — renders a collapsible group header + its rows
// ---------------------------------------------------------------------------
function GroupSection({
  label,
  rows,
  listFields,
  selectedRows,
  setSelectedRows,
  renderCell,
  router,
  doctype,
}: {
  label: string;
  rows: Array<Record<string, unknown>>;
  listFields: Array<{ fieldname: string; label?: string | null; fieldtype: string }>;
  selectedRows: Set<string>;
  setSelectedRows: (s: Set<string>) => void;
  renderCell: (row: Record<string, unknown>, field: { fieldname: string; label?: string; fieldtype: string }) => React.ReactNode;
  router: ReturnType<typeof useRouter>;
  doctype: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Group header row */}
      <tr
        className="bg-zinc-50 dark:bg-zinc-900 border-t-2 border-zinc-200 dark:border-zinc-700"
        role="rowgroup"
        aria-label={`Group: ${label}`}
      >
        <td colSpan={listFields.length + 1} className="px-3 py-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-100"
            aria-expanded={!collapsed}
          >
            <span
              className={`inline-block transition-transform text-zinc-400 ${collapsed ? "-rotate-90" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
            {label}
            <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
              {rows.length}
            </span>
          </button>
        </td>
      </tr>

      {/* Group rows */}
      {!collapsed &&
        rows.map((row, i) => (
          <tr
            key={i}
            onClick={() => {
              const name = String(row.name ?? "");
              if (name) router.push(`/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
            }}
            className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <td className="px-3 py-3">
              <input
                type="checkbox"
                checked={selectedRows.has(String(row.name))}
                onChange={(e) => {
                  const next = new Set(selectedRows);
                  const nameStr = String(row.name);
                  if (e.target.checked) next.add(nameStr);
                  else next.delete(nameStr);
                  setSelectedRows(next);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-zinc-300"
                aria-label={`Select row ${String(row.name)}`}
              />
            </td>
            {listFields.map((field) => (
              <td key={field.fieldname} className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                {renderCell(row, field as { fieldname: string; label?: string; fieldtype: string })}
              </td>
            ))}
          </tr>
        ))}
    </>
  );
}

