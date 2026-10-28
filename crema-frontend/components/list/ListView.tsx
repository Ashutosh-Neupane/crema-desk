"use client";

/**
 * Desk list view (frappe/public/js/frappe/list/list_view.js), rebuilt:
 *  - columns: title (title_field / name) · status indicator · in_list_view fields · updated
 *  - indicator from the app's own listview_settings.get_indicator (__list_js)
 *  - one filter model: ID/title search, inline standard filters, filter editor,
 *    removable chips; synced to the URL (?status=Draft or ?filters=[…])
 *  - sort, group-by counts, page size + load more, bulk actions (components/list/BulkActions)
 *  - only the views that make sense for the DocType; quick entry for New when allowed
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Filter as FilterIcon,
  Layers,
  ListFilter,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { useListSettings } from "@/lib/list/useListSettings";
import { lvsKey, parseColumnSettings, useListViewSettings } from "@/lib/list/useListViewSettings";
import { loadUserSettings, saveListState, userSettingsKey, type UserSettings } from "@/lib/list/useUserListState";
import ListSettingsDialog from "@/components/list/ListSettingsDialog";
import { fetchCount, fetchRows, type Filter, type Row } from "@/lib/list/api";
import { getIndicator, INDICATOR_PILL, indicatorFilters } from "@/lib/list/indicator";
import { formatCell, timeAgo } from "@/lib/list/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import LinkInput from "@/components/list/LinkInput";
import { FilterEditor, GroupBy, NO_VALUE, OPERATORS, describeValue, fieldLabel, filtersFromParams } from "@/components/list/filters";
import QuickEntry, { canQuickEntry } from "@/components/form/QuickEntry";
import BulkActions from "@/components/list/BulkActions";
import ExportDialog from "@/components/list/ExportDialog";
import ListSidebar from "@/components/list/ListSidebar";
import { useShortcuts } from "@/lib/shortcuts";
import { useListRealtime } from "@/lib/services/realtime";
import type { DocField } from "@/lib/frappe/types";

const enc = encodeURIComponent;
type Sort = { field: string; order: "asc" | "desc" };

// ── Main ───────────────────────────────────────────────────────────────────
export default function ListView({ doctype }: { doctype: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data: meta, isLoading: metaLoading, error: metaError } = useDoctype(doctype);
  // a Single has no list: Desk's router opens its only document (router.set_doctype_route)
  useEffect(() => {
    if (meta?.issingle) router.replace(`/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(doctype)}`);
  }, [meta?.issingle, doctype, router]);
  const { data: ctx } = useDeskContext();
  const settings = useListSettings(meta);
  // Desk base_list.js get_list_view_settings: the List View Settings doc (columns, disable_count, …)
  const lvsQuery = useListViewSettings(doctype);
  const lvs = lvsQuery.data;
  const lvsReady = lvsQuery.isSuccess || lvsQuery.isError;
  const colSettings = useMemo(() => parseColumnSettings(lvs), [lvs]);
  const disableCount = !!lvs?.disable_count;
  const disableCommentCount = !!lvs?.disable_comment_count;

  const filters = useMemo(() => filtersFromParams(doctype, new URLSearchParams(params.toString())), [doctype, params]);
  const [search, setSearch] = useState(params.get("q") ?? "");
  // ?q= can change while this list stays mounted (awesomebar "<text> in <DocType>"): follow the URL
  const urlQ = params.get("q") ?? "";
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (prevUrlQ !== urlQ) {
    setPrevUrlQ(urlQ);
    setSearch(urlQ);
  }
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const defaultSort: Sort = { field: String(meta?.sort_field || "modified"), order: (String(meta?.sort_order || "desc").toLowerCase() as "asc" | "desc") };
  const [sortState, setSort] = useState<Sort | null>(null);
  const sort = sortState ?? defaultSort;
  const [pageLength, setPageLength] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickEntry, setQuickEntry] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);

  // Desk list_view.js setup_defaults: filters / sort_by / sort_order restored from user_settings["List"]
  // (URL filters win); before_render saves them back (+ last_view). Query is not cached so a revisit re-reads it.
  const usQuery = useQuery({ queryKey: userSettingsKey(doctype), queryFn: () => loadUserSettings(doctype), staleTime: 0, gcTime: 0, refetchOnMount: "always" });
  const userSettings = useRef<UserSettings>({});
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const [awaitFrom, setAwaitFrom] = useState<Filter[] | null>(null);

  const setFilters = useCallback(
    (next: Filter[]) => {
      const sp = new URLSearchParams();
      // simple equality filters read nicely in the URL (?status=Draft), others go in ?filters=
      const complex: Filter[] = [];
      for (const f of next) {
        if (f[2] === "=" && (typeof f[3] === "string" || typeof f[3] === "number") && !sp.has(f[1]) && !["filters", "view", "sort", "q"].includes(f[1])) sp.set(f[1], String(f[3]));
        else complex.push(f);
      }
      if (complex.length) sp.set("filters", JSON.stringify(complex));
      if (search.trim()) sp.set("q", search.trim());
      setSelected(new Set());
      router.replace(`${pathname}${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
    },
    [pathname, router, search],
  );
  useEffect(() => {
    if (restoredFor === doctype || !meta || !usQuery.isFetchedAfterMount) return;
    const saved = usQuery.data ?? {};
    userSettings.current = saved;
    const cur = saved.List ?? {};
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore of the saved view state
    if (cur.sort_by) setSort({ field: String(cur.sort_by), order: String(cur.sort_order).toLowerCase() === "asc" ? "asc" : "desc" });
    if (filters.length === 0 && Array.isArray(cur.filters) && cur.filters.length) {
      const std = new Set(["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "_assign", "_user_tags", "_comments", "_liked_by"]);
      const valid = (cur.filters as Filter[]).filter((f) => Array.isArray(f) && f.length === 4 && (f[0] !== doctype || std.has(f[1]) || meta.fields?.some((x) => x.fieldname === f[1])));
      if (valid.length) {
        setAwaitFrom(filters);
        setFilters(valid);
      }
    }
    setRestoredFor(doctype);
  }, [restoredFor, doctype, meta, usQuery.isFetchedAfterMount, usQuery.data, filters, setFilters]);
  const stateReady = restoredFor === doctype && !(awaitFrom !== null && awaitFrom === filters);

  const addFilter = (f: Filter) => setFilters([...filters.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f]);
  const removeFilter = (i: number) => setFilters(filters.filter((_, j) => j !== i));

  const titleField = typeof meta?.title_field === "string" && meta.title_field && meta.show_title_field_in_link !== undefined ? meta.title_field : typeof meta?.title_field === "string" ? meta.title_field : "";
  const listFields = useMemo(() => {
    if (!meta) return [] as DocField[];
    // List View Settings `fields` (list_view.js build_columns): exactly those columns, in that order
    if (colSettings.length) {
      const subject = new Set(["name", titleField, colSettings[0]?.fieldname]);
      const std: Record<string, Partial<DocField>> = { owner: { fieldtype: "Link", options: "User", label: "Created By" }, modified_by: { fieldtype: "Link", options: "User", label: "Last Updated By" }, creation: { fieldtype: "Datetime", label: "Created On" }, modified: { fieldtype: "Datetime", label: "Last Updated On" }, idx: { fieldtype: "Int", label: "Index" }, docstatus: { fieldtype: "Int", label: "Document Status" } };
      const out: DocField[] = [];
      for (const c of colSettings) {
        // the Status indicator column already shows the `status` field
        if (c.fieldname === "status_field" || subject.has(c.fieldname) || (c.fieldname === "status" && colSettings.some((x) => x.fieldname === "status_field"))) continue;
        const df = meta.fields?.find((f) => f.fieldname === c.fieldname) ?? (std[c.fieldname] ? ({ fieldname: c.fieldname, ...std[c.fieldname] } as DocField) : undefined);
        if (df && !NO_VALUE.has(df.fieldtype)) out.push(df);
      }
      return out;
    }
    return (meta.fields ?? [])
      .filter((f) => f.in_list_view && !NO_VALUE.has(f.fieldtype) && f.fieldname !== titleField && f.fieldname !== "status")
      .slice(0, 6);
  }, [meta, titleField, colSettings]);
  const colWidth = (fieldname: string) => colSettings.find((c) => c.fieldname === fieldname)?.width;
  const hasStatusField = !!meta?.fields?.some((f) => f.fieldname === "status");
  const hasIndicator =
    !!meta &&
    (!!meta.is_submittable || hasStatusField || typeof settings?.get_indicator === "function" || !!meta.fields?.some((f) => f.fieldname === "enabled" || f.fieldname === "disabled")) &&
    (!colSettings.length || colSettings.some((c) => c.fieldname === "status_field"));
  const standardFilters = useMemo(
    () => (meta?.fields ?? []).filter((f) => f.in_standard_filter && ["Link", "Select", "Data", "Date", "Check"].includes(f.fieldtype)).slice(0, 4),
    [meta],
  );

  const fetchFields = useMemo(() => {
    if (!meta) return [];
    const fs = new Set<string>(["name", "docstatus", "modified", "owner", "_comment_count", "_assign"]);
    if (titleField) fs.add(titleField);
    if (hasStatusField) fs.add("status");
    if (meta.fields?.some((f) => f.fieldname === "workflow_state")) fs.add("workflow_state");
    for (const f of listFields) {
      fs.add(f.fieldname);
      if (f.fieldtype === "Currency" && typeof f.options === "string" && meta.fields?.some((x) => x.fieldname === f.options)) fs.add(f.options);
    }
    for (const f of (settings?.add_fields as string[] | undefined) ?? []) if (f === "name" || meta.fields?.some((x) => x.fieldname === f)) fs.add(f);
    for (const f of ["enabled", "disabled", "currency"]) if (meta.fields?.some((x) => x.fieldname === f)) fs.add(f);
    return [...fs].filter((f) => f !== "_comment_count");
  }, [meta, titleField, hasStatusField, listFields, settings]);

  const searchFilter = useMemo<Filter[]>(() => (debounced ? [[doctype, titleField || "name", "like", `%${debounced}%`]] : []), [debounced, doctype, titleField]);
  const allFilters = useMemo(() => [...filters, ...searchFilter], [filters, searchFilter]);

  const rowsQuery = useQuery<Row[]>({
    queryKey: ["list", doctype, fetchFields, allFilters, sort, pageLength, disableCommentCount],
    enabled: !!meta && !meta.issingle && settings !== undefined && lvsReady && stateReady,
    queryFn: () => fetchRows({ doctype, fields: fetchFields, filters: allFilters, orderBy: `\`tab${doctype}\`.\`${sort.field}\` ${sort.order}`, start: 0, pageLength, withCommentCount: !disableCommentCount }),
    placeholderData: keepPreviousData,
  });
  const countQuery = useQuery({
    queryKey: ["list-count", doctype, allFilters],
    enabled: !!meta && !meta.issingle && lvsReady && stateReady && !disableCount,
    queryFn: () => fetchCount(doctype, allFilters),
  });

  // Search by title can miss an exact ID — retry on name when the title search is empty
  const rows = rowsQuery.data ?? [];
  const total = countQuery.data ?? rows.length;
  const moreRows = disableCount ? rows.length >= pageLength : rows.length < total;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.name));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["list", doctype] });
    qc.invalidateQueries({ queryKey: ["list-count", doctype] });
  };

  // Desk refreshes the list when anyone creates/changes/deletes a document (list_update); bursts coalesce
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useListRealtime(lvs?.disable_auto_refresh ? undefined : doctype, () => {
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["list", doctype] });
      qc.invalidateQueries({ queryKey: ["list-count", doctype] });
    }, 800);
  });
  useEffect(() => () => {
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
  }, []);

  // before_render: save { filters, sort_by, sort_order } (and last_view) to the user's settings
  useEffect(() => {
    if (!stateReady || !meta) return;
    const value = { filters, sort_by: sort.field, sort_order: sort.order };
    const cur = userSettings.current;
    const next = { ...cur, List: { ...(cur.List ?? {}), ...value }, last_view: "List" };
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    userSettings.current = next;
    saveListState(doctype, cur, value).catch(() => {});
  }, [stateReady, meta, doctype, filters, sort.field, sort.order]);

  const views = useMemo(() => {
    if (!meta) return [] as Array<{ id: string; label: string; href: string }>;
    const v = [{ id: "list", label: "List", href: `/desk/doctype/${enc(doctype)}${meta.is_tree ? "?view=list" : ""}` }];
    v.push({ id: "report", label: "Report", href: `/desk/doctype/${enc(doctype)}/view/report` });
    // Desk: File has a folder view (/app/file/view/home)
    if (doctype === "File") v.push({ id: "home", label: "Home", href: "/desk/files" });
    // Desk offers Calendar when the DocType ships calendar settings (frappe.views.calendar)
    const calJs = String((meta as { __calendar_js?: string }).__calendar_js ?? "");
    if (calJs) v.push({ id: "calendar", label: "Calendar", href: `/desk/doctype/${enc(doctype)}/view/calendar` });
    // Gantt when the calendar settings enable it (gantt: true / { ... })
    if (/\bgantt\s*:\s*(true|\{)/.test(calJs)) v.push({ id: "gantt", label: "Gantt", href: `/desk/doctype/${enc(doctype)}/view/gantt` });
    // Desk offers Kanban for any DocType with a Select field to build columns from
    if (meta.fields?.some((f) => f.fieldtype === "Select" && !f.hidden)) v.push({ id: "kanban", label: "Kanban", href: `/desk/doctype/${enc(doctype)}/view/kanban` });
    if (meta.is_tree) v.push({ id: "tree", label: "Tree", href: `/desk/doctype/${enc(doctype)}/view/tree` });
    if (meta.image_field) v.push({ id: "image", label: "Image", href: `/desk/doctype/${enc(doctype)}/view/image` });
    return v;
  }, [meta, doctype]);

  // Desk opens tree DocTypes (Account, Item Group, …) in Tree view unless the list is asked for
  useEffect(() => {
    if (meta?.is_tree && params.get("view") !== "list") router.replace(`/desk/doctype/${enc(doctype)}/view/tree`);
  }, [meta?.is_tree, params, router, doctype]);

  // ?new=1 (e.g. /desk/doctype/new redirect) opens New / the primary action once the list JS is loaded
  const wantNew = params.get("new") === "1";
  const [openedNew, setOpenedNew] = useState(false);
  useEffect(() => {
    if (!wantNew || openedNew || !meta || settings === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot trigger from the URL
    setOpenedNew(true);
    if (typeof settings.primary_action === "function") (settings.primary_action as () => unknown).call(settings);
    else router.push(`/desk/doctype/${enc(doctype)}/new`);
  }, [wantNew, openedNew, meta, settings, router, doctype]);

  // Desk list shortcut: Ctrl/⌘+B = New (list_view.js)
  useShortcuts(
    [{ keys: "mod+b", description: `New ${doctype}`, group: "List", allowInInput: true, action: () => router.push(`/desk/doctype/${enc(doctype)}/new`) }],
    [doctype, router],
  );

  if (meta?.issingle) return <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (metaError) return <p className="p-6 text-sm text-red-600">{(metaError as Error).message}</p>;
  if (metaLoading || !meta) return <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;

  const sortable = [
    { fieldname: "modified", label: "Last Updated On" },
    { fieldname: "creation", label: "Created On" },
    { fieldname: "name", label: "ID" },
    ...(meta.fields ?? []).filter((f) => ["Date", "Datetime", "Int", "Float", "Currency", "Percent", "Data", "Link", "Select"].includes(f.fieldtype) && (f.in_list_view || f.in_standard_filter || f.bold)).map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname })),
  ];
  const canCreate = !meta.issingle && !meta.istable;
  // Desk: the app's listview_settings.primary_action replaces New (e.g. DocType's "Create New DocType" dialog)
  const onAdd = () => {
    if (typeof settings?.primary_action === "function") {
      try {
        (settings.primary_action as () => unknown).call(settings);
        return;
      } catch (err) {
        console.warn("[list] primary_action failed", err);
      }
    }
    if (canQuickEntry(meta)) setQuickEntry(true);
    else router.push(`/desk/doctype/${enc(doctype)}/new`);
  };
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const defaultCurrency = (ctx?.defaults?.currency as string) || undefined;
  const subjectLabel = titleField ? fieldLabel(meta, titleField) : "ID";

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{doctype}</h1>
        {views.length > 1 && (
          <nav aria-label="Views" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {views.map((v) => (
              <Link key={v.id} href={v.href} prefetch={false} aria-current={v.id === "list" ? "page" : undefined} className={`rounded-md px-2.5 py-1 text-xs font-medium ${v.id === "list" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
                {v.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={refresh} aria-label="Refresh" className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <RefreshCw className={`h-4 w-4 ${rowsQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="List settings" className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
              <Settings2 className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => router.push(`/desk/doctype/Customize Form/Customize Form?doc_type=${enc(doctype)}`)}>Customize</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/desk/doctype/DocType/${enc(doctype)}`)}>Edit DocType</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setListSettingsOpen(true)}>List settings</DropdownMenuItem>
              {!!meta.allow_import && <DropdownMenuItem onClick={() => router.push(`/desk/data-import?doctype=${enc(doctype)}`)}>Import</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => setExporting(true)}>Export</DropdownMenuItem>
              {/* Desk list_view.js: System Manager only */}
              {ctx?.roles.includes("System Manager") && <DropdownMenuItem onClick={() => router.push(`/desk/doctype/User%20Permission?allow=${enc(doctype)}`)}>User Permissions</DropdownMenuItem>}
              {ctx?.roles.includes("System Manager") && <DropdownMenuItem onClick={() => router.push(`/desk/page/permission-manager/${enc(doctype)}`)}>Role Permissions Manager</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          {selected.size > 0 ? (
            <BulkActions
              meta={meta}
              rows={rows.filter((r) => selected.has(r.name))}
              columns={listFields.map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname, fieldtype: f.fieldtype }))}
              onDone={() => {
                setSelected(new Set());
                refresh();
              }}
            />
          ) : (
            canCreate && (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" /> Add {doctype}
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${subjectLabel}`}
            className="h-8 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        {standardFilters.map((f) => {
          const current = filters.find((x) => x[1] === f.fieldname && x[2] === "=");
          const val = current ? String(current[3]) : "";
          const set = (v: string) => setFilters(v ? [...filters.filter((x) => x[1] !== f.fieldname), [doctype, f.fieldname, "=", v]] : filters.filter((x) => x[1] !== f.fieldname));
          return f.fieldtype === "Link" ? (
            <LinkInput key={f.fieldname} doctype={String(f.options)} value={val} onChange={set} placeholder={f.label ?? f.fieldname} className="w-40" />
          ) : f.fieldtype === "Select" ? (
            <select aria-label={f.label ?? f.fieldname} key={f.fieldname} value={val} onChange={(e) => set(e.target.value)} className="h-8 w-40 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <option value="">{f.label}</option>
              {String(f.options ?? "").split("\n").filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.fieldtype === "Check" ? (
            <select aria-label={f.label ?? f.fieldname} key={f.fieldname} value={val} onChange={(e) => set(e.target.value)} className="h-8 w-36 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <option value="">{f.label}</option>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          ) : (
            <input key={f.fieldname} type={f.fieldtype === "Date" ? "date" : "text"} defaultValue={val} title={f.label ?? f.fieldname} aria-label={f.label ?? f.fieldname} onBlur={(e) => set(e.target.value)} onKeyDown={(e) => e.key === "Enter" && set((e.target as HTMLInputElement).value)} placeholder={f.label ?? f.fieldname} className="h-8 w-40 rounded-md border border-zinc-200 bg-white px-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          );
        })}

        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <FilterIcon className="h-3.5 w-3.5" /> Filter
            {filters.length > 0 && <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">{filters.length}</span>}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <FilterEditor meta={meta} onAdd={addFilter} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <Layers className="h-3.5 w-3.5" /> Group by
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <GroupBy meta={meta} filters={allFilters} onPick={addFilter} />
          </PopoverContent>
        </Popover>

        {!lvs?.disable_sidebar_stats && <ListSidebar meta={meta} filters={filters} setFilters={setFilters} user={ctx?.user ?? ""} />}

        <div className="ml-auto flex items-center gap-1">
          <select
            value={sort.field}
            onChange={(e) => setSort({ field: e.target.value, order: sort.order })}
            aria-label="Sort by"
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {sortable.filter((s, i, a) => a.findIndex((x) => x.fieldname === s.fieldname) === i).map((s) => <option key={s.fieldname} value={s.fieldname}>{s.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setSort({ field: sort.field, order: sort.order === "asc" ? "desc" : "asc" })}
            aria-label={sort.order === "asc" ? "Ascending" : "Descending"}
            className="rounded-md border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {sort.order === "asc" ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownNarrowWide className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Active filters */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => (
            <span key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <ListFilter className="h-3 w-3 text-zinc-400" />
              <span className="font-medium">{fieldLabel(meta, f[1])}</span>
              <span className="text-zinc-400">{OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}</span>
              <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
              <button type="button" onClick={() => removeFilter(i)} aria-label={`Remove ${fieldLabel(meta, f[1])} filter`} className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setFilters([])} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.name)))}
                    className="h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100"
                  />
                </th>
                <th className="px-3 py-2.5" style={colWidth(colSettings[0]?.fieldname ?? "name") ? { minWidth: colWidth(colSettings[0]?.fieldname ?? "name") } : undefined}>{subjectLabel}</th>
                {hasIndicator && <th className="px-3 py-2.5">Status</th>}
                {listFields.map((f) => (
                  <th key={f.fieldname} style={colWidth(f.fieldname) ? { minWidth: colWidth(f.fieldname) } : undefined} className={`whitespace-nowrap px-3 py-2.5 ${["Currency", "Float", "Int", "Percent"].includes(f.fieldtype) ? "text-right" : ""}`}>{f.label}</th>
                ))}
                <th className="w-24 px-3 py-2.5 text-right">
                  {!disableCount && `${rows.length} of ${total}`}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ind = hasIndicator ? getIndicator(r, meta, settings) : null;
                const href = `/desk/doctype/${enc(doctype)}/${enc(r.name)}`;
                const subject = titleField && r[titleField] ? String(r[titleField]) : r.name;
                return (
                  <tr
                    key={r.name}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button,input")) return;
                      if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                      else router.push(href);
                    }}
                    className={`group cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 ${selected.has(r.name) ? "bg-zinc-50 dark:bg-zinc-800/40" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.name}`}
                        checked={selected.has(r.name)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(r.name)) next.delete(r.name);
                          else next.add(r.name);
                          setSelected(next);
                        }}
                        className="h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100"
                      />
                    </td>
                    <td className="max-w-[18rem] px-3 py-2.5">
                      <Link href={href} className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100">{subject}</Link>
                      {subject !== r.name && <span className="block truncate text-xs text-zinc-400">{r.name}</span>}
                    </td>
                    {hasIndicator && (
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {ind && (
                          <button
                            type="button"
                            title={`Filter by ${ind[0]}`}
                            onClick={() => ind[2] && setFilters([...filters, ...(indicatorFilters(doctype, ind[2]) as Filter[])])}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${INDICATOR_PILL[ind[1]] ?? INDICATOR_PILL.gray}`}
                          >
                            {ind[0]}
                          </button>
                        )}
                      </td>
                    )}
                    {listFields.map((f) => {
                      const text = formatCell(r[f.fieldname], f, r, { currency: defaultCurrency, dateFormat });
                      const numeric = ["Currency", "Float", "Int", "Percent"].includes(f.fieldtype);
                      return (
                        <td key={f.fieldname} className={`max-w-[16rem] truncate whitespace-nowrap px-3 py-2.5 text-zinc-700 dark:text-zinc-300 ${numeric ? "text-right tabular-nums" : ""}`}>
                          {f.fieldtype === "Link" && text ? (
                            <button type="button" onClick={() => addFilter([doctype, f.fieldname, "=", r[f.fieldname]])} className="truncate hover:underline" title={`Filter by ${text}`}>
                              {text}
                            </button>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-zinc-400" title={String(r.modified ?? "")}>
                      <span className="inline-flex items-center gap-2">
                        {!disableCommentCount && Number(r._comment_count) > 0 && (
                          <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{Number(r._comment_count)}</span>
                        )}
                        {timeAgo(r.modified)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!rowsQuery.isLoading && rows.length === 0 && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-zinc-500">{filters.length || debounced ? `No ${doctype} matches these filters` : `You haven't created a ${doctype} yet`}</p>
            {filters.length || debounced ? (
              <button type="button" onClick={() => { setSearch(""); setFilters([]); }} className="mt-3 text-sm font-medium text-zinc-900 underline dark:text-zinc-100">Clear filters</button>
            ) : (
              canCreate && <button type="button" onClick={onAdd} className="mt-3 text-sm font-medium text-zinc-900 underline dark:text-zinc-100">Create your first {doctype}</button>
            )}
          </div>
        )}
        {rowsQuery.isLoading && <div className="h-40 animate-pulse bg-zinc-50 dark:bg-zinc-900" />}

        {rows.length > 0 && (
          <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
            {[20, 100, 500].map((n) => (
              <button key={n} type="button" onClick={() => setPageLength(n)} className={`rounded-md px-2 py-1 ${pageLength === n ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                {n}
              </button>
            ))}
            {moreRows && (
              <button type="button" onClick={() => setPageLength(pageLength + 20)} className="ml-auto rounded-md border border-zinc-200 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Load more
              </button>
            )}
          </div>
        )}
      </div>

      {listSettingsOpen && (
        <ListSettingsDialog
          meta={meta}
          settings={lvs ?? null}
          hasIndicator={!!meta.is_submittable || hasStatusField || typeof settings?.get_indicator === "function" || !!meta.fields?.some((f) => f.fieldname === "enabled" || f.fieldname === "disabled")}
          onClose={() => setListSettingsOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: lvsKey(doctype) });
            qc.invalidateQueries({ queryKey: ["doctype", doctype] });
            refresh();
          }}
        />
      )}

      {exporting && <ExportDialog doctype={doctype} filters={allFilters} onClose={() => setExporting(false)} />}

      {quickEntry && (
        <QuickEntry
          meta={meta}
          onClose={() => setQuickEntry(false)}
          onCreated={(name) => {
            setQuickEntry(false);
            refresh();
            toast.success(`${doctype} ${name} created`, { action: { label: "Open", onClick: () => router.push(`/desk/doctype/${enc(doctype)}/${enc(name)}`) } });
          }}
        />
      )}
    </div>
  );
}
