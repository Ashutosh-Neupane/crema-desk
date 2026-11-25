"use client";

/**
 * The rows and count a Desk list shows (base_list.js refresh), kept fresh by realtime list_update, plus the
 * `listview` an app's listview_settings hooks receive (onload / refresh / before_render).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCount, fetchRows, type Filter, type Row } from "@/lib/list/api";
import { createListview, EMPTY_PAGE_STATE, runHook, type ListviewHandle } from "@/lib/list/listviewShim";
import { useListRealtime } from "@/lib/services/realtime";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { toggled, type ListSettings, type Sort } from "@/components/list/listModel";

const NONE: Set<string> = new Set();

/** checked rows; a change of filters starts a fresh selection (Desk clears checked items when filters change) */
export function useSelection(filters: Filter[]) {
  const key = JSON.stringify(filters);
  const [sel, setSel] = useState<{ key: string; names: Set<string> }>(() => ({ key, names: NONE }));
  const selected = sel.key === key ? sel.names : NONE;
  const setSelected = useCallback((names: Set<string>) => setSel({ key, names }), [key]);
  const clearSelected = useCallback(() => setSel({ key, names: NONE }), [key]);
  const toggle = useCallback((name: string) => setSel((prev) => ({ key, names: toggled(prev.key === key ? prev.names : NONE, name) })), [key]);
  return { selected, setSelected, clearSelected, toggle };
}

const noSubscribe = () => () => {};
const emptyPageState = () => EMPTY_PAGE_STATE;

export function useListRows({
  doctype,
  meta,
  settings,
  enabled,
  fields,
  filters,
  sort,
  pageLength,
  disableCount,
  disableCommentCount,
  disableAutoRefresh,
}: {
  doctype: string;
  meta: DocTypeMeta | undefined;
  settings: ListSettings;
  enabled: boolean;
  fields: string[];
  filters: Filter[];
  sort: Sort;
  pageLength: number;
  disableCount: boolean;
  disableCommentCount: boolean;
  disableAutoRefresh: boolean;
}) {
  const qc = useQueryClient();
  const live = enabled && !!meta && !meta.issingle;
  const rowsQuery = useQuery<Row[]>({
    queryKey: ["list", doctype, fields, filters, sort, pageLength, disableCommentCount],
    enabled: live && settings !== undefined,
    queryFn: () => fetchRows({ doctype, fields, filters, orderBy: `\`tab${doctype}\`.\`${sort.field}\` ${sort.order}`, start: 0, pageLength, withCommentCount: !disableCommentCount }),
    placeholderData: keepPreviousData,
  });
  const countQuery = useQuery({ queryKey: ["list-count", doctype, filters], enabled: live && !disableCount, queryFn: () => fetchCount(doctype, filters) });
  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const total = countQuery.data ?? rows.length;

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["list", doctype] });
    qc.invalidateQueries({ queryKey: ["list-count", doctype] });
  }, [qc, doctype]);

  // Desk refreshes the list when anyone creates/changes/deletes a document (list_update); bursts coalesce
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useListRealtime(disableAutoRefresh ? undefined : doctype, () => {
    if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = setTimeout(refresh, 800);
  });
  useEffect(
    () => () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
    },
    [],
  );

  return { rows, total, isLoading: rowsQuery.isLoading, isFetching: rowsQuery.isFetching, isSuccess: rowsQuery.isSuccess, dataUpdatedAt: rowsQuery.dataUpdatedAt, refresh };
}

/**
 * The `listview` an app's listview_settings hooks receive: it reads this render's state through setHost, and the
 * buttons it adds come back through useSyncExternalStore.
 */
export function useListviewHooks({
  doctype,
  meta,
  settings,
  ready,
  loadedAt,
  host,
}: {
  doctype: string;
  meta: DocTypeMeta | undefined;
  settings: ListSettings;
  ready: boolean;
  loadedAt: number;
  host: { rows: Row[]; selected: Set<string>; clearSelected: () => void; filters: Filter[]; setFilters: (f: Filter[]) => void; refresh: () => void };
}) {
  const lvHandle = useMemo(() => (meta && settings ? createListview(doctype, meta, settings) : null), [meta, settings, doctype]);
  useEffect(() => {
    lvHandle?.setHost({
      rows: () => host.rows,
      selected: () => [...host.selected],
      clearSelected: host.clearSelected,
      filters: () => host.filters,
      setFilters: host.setFilters,
      refresh: host.refresh,
    });
  });
  const pageState = useSyncExternalStore(lvHandle?.subscribe ?? noSubscribe, lvHandle?.getState ?? emptyPageState, emptyPageState);
  // list_view.js setup_view: settings.onload(listview), once per list
  const onloadFor = useRef<ListviewHandle | null>(null);
  useEffect(() => {
    if (!lvHandle || !ready || onloadFor.current === lvHandle) return;
    onloadFor.current = lvHandle;
    runHook(settings, "onload", lvHandle.listview);
  }, [lvHandle, ready, settings]);
  // base_list.js refresh: before_render(), then settings.refresh(listview) after each load
  useEffect(() => {
    if (!lvHandle || !loadedAt) return;
    runHook(settings, "before_render");
    runHook(settings, "refresh", lvHandle.listview);
  }, [lvHandle, loadedAt, settings]);
  return pageState;
}
