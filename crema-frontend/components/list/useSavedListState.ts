"use client";

/**
 * Desk list_view.js setup_defaults / before_render: filters, sort_by / sort_order and the active layout are
 * restored from user_settings["List"] (URL filters win) and saved back (+ last_view) as they change.
 */
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { DEFAULT_LAYOUT } from "@/lib/list/layouts";
import { loadUserSettings, saveListState, userSettingsKey, type UserSettings } from "@/lib/list/useUserListState";
import { defaultSortOf, filtersToRestore, savedSortOf, titleFieldOf, type ListSettings, type Sort } from "@/components/list/listModel";
import { useListFilters } from "@/components/list/useListFilters";

type Restored = { saved: UserSettings; apply: Filter[] | null; from: Filter[] };

/** the URL filters and search (useListFilters) plus the sort, with the saved state restored into them once */
export function useSavedListState({ doctype, meta, settings }: { doctype: string; meta: DocTypeMeta | undefined; settings: ListSettings }) {
  const urlState = useListFilters(doctype, titleFieldOf(meta));
  const { filters, setFilters } = urlState;
  // not cached, so a revisit re-reads it
  const usQuery = useQuery({ queryKey: userSettingsKey(doctype), queryFn: () => loadUserSettings(doctype), staleTime: 0, gcTime: 0, refetchOnMount: "always" });
  const userSettingsRef = useRef<UserSettings>({});

  // taken once, when meta, the app's listview_settings and the saved settings are all in
  const [restored, setRestored] = useState<Restored | null>(null);
  if (!restored && meta && settings !== undefined && usQuery.isFetchedAfterMount) {
    const saved = usQuery.data ?? {};
    setRestored({ saved, apply: filtersToRestore(doctype, meta, settings, saved, filters), from: filters });
  }
  const applyRestored = useEffectEvent((r: Restored) => {
    userSettingsRef.current = r.saved;
    if (r.apply) setFilters(r.apply);
  });
  useEffect(() => {
    if (restored) applyRestored(restored);
  }, [restored]);
  // the restored filters must reach the URL before the list loads
  const stateReady = !!restored && !(restored.apply && filters === restored.from);

  const [sortState, setSort] = useState<Sort | null>(null);
  const sort = sortState ?? (restored ? savedSortOf(restored.saved) : null) ?? defaultSortOf(meta);
  return { ...urlState, stateReady, sort, sortState, setSort, userSettingsRef };
}

/** before_render: save { filters, sort_by, sort_order, active layout } (and last_view) to the user's settings */
export function useSaveListState({ doctype, ready, filters, sort, activeLayout, userSettingsRef }: { doctype: string; ready: boolean; filters: Filter[]; sort: Sort; activeLayout: string | null; userSettingsRef: RefObject<UserSettings> }) {
  useEffect(() => {
    if (!ready) return;
    const value = { filters, sort_by: sort.field, sort_order: sort.order, active_layout_name: activeLayout && activeLayout !== DEFAULT_LAYOUT ? activeLayout : "" };
    const cur = userSettingsRef.current;
    const next = { ...cur, List: { ...(cur.List ?? {}), ...value }, last_view: "List" };
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    userSettingsRef.current = next;
    saveListState(doctype, cur, value).catch(() => {});
  }, [ready, doctype, filters, sort.field, sort.order, activeLayout, userSettingsRef]);
}
