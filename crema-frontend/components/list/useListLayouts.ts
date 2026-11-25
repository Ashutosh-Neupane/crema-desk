"use client";

/** Saved list layouts (Desk v16 list_filter/): the active one's columns, filters and sort replace the list's own. */
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Filter } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { DEFAULT_LAYOUT, fetchLayouts, findBySignature, layoutColumns, layoutFilters, type ListLayout } from "@/lib/list/layouts";
import { toOrder, type ListSettings, type Sort } from "@/components/list/listModel";
import { useSavedListState, useSaveListState } from "@/components/list/useSavedListState";

/** the list's whole view state: URL filters, search and sort with the saved state restored (useSavedListState), and the active layout */
export function useListLayouts({ doctype, meta, settings, user }: { doctype: string; meta: DocTypeMeta | undefined; settings: ListSettings; user: string }) {
  const listState = useSavedListState({ doctype, meta, settings });
  const { filters, setFilters, sortState, setSort, userSettingsRef, stateReady: ready } = listState;
  const layoutsQuery = useQuery({ queryKey: ["list-layouts", doctype, user], queryFn: () => fetchLayouts(doctype, user), enabled: !!user, staleTime: 60_000 });
  const layouts = useMemo(() => layoutsQuery.data ?? [], [layoutsQuery.data]);
  const [activeLayout, setActiveLayout] = useState<string | null>(null);
  const [layoutCols, setLayoutCols] = useState<ListColumnSetting[] | null>(null);
  // list_filter_menu.js capture_default_layout_state: the Default Layout's filters / sort, taken when leaving it
  const defaultSnapshot = useRef<{ filters: Filter[]; sort: Sort | null } | null>(null);
  const captureDefault = useCallback(() => {
    if ((activeLayout ?? DEFAULT_LAYOUT) === DEFAULT_LAYOUT) defaultSnapshot.current = { filters, sort: sortState };
  }, [activeLayout, filters, sortState]);

  // list_filter_menu.js apply_saved_layout / apply_default_layout
  const applyLayout = useCallback(
    (name: string, list: ListLayout[] = layouts) => {
      if (name === DEFAULT_LAYOUT) {
        const snap = defaultSnapshot.current;
        setActiveLayout(DEFAULT_LAYOUT);
        setLayoutCols(null);
        if (snap) {
          setSort(snap.sort);
          setFilters(snap.filters);
        }
        return;
      }
      const l = list.find((x) => x.name === name);
      if (!l) return;
      const cols = layoutColumns(l);
      setActiveLayout(l.name);
      setLayoutCols(cols.length ? cols : null);
      if (l.sort_field) setSort({ field: l.sort_field, order: toOrder(l.sort_order) });
      setFilters(layoutFilters(l));
    },
    [layouts, setFilters, setSort],
  );
  const selectLayout = (name: string) => {
    if (name === activeLayout) return;
    captureDefault();
    applyLayout(name);
  };

  useSaveListState({ doctype, ready: ready && !!meta, filters, sort: listState.sort, activeLayout, userSettingsRef });

  // restore_layout_from_route_signature: URL filters that match a layout select it; no filters → the last one used
  const restoreLayout = useEffectEvent(() => {
    const matched = findBySignature(layouts, doctype, filters);
    const saved = String(userSettingsRef.current.List?.active_layout_name ?? "");
    const savedLayout = !filters.length && saved ? layouts.find((l) => l.name === saved) : undefined;
    if (matched) {
      const cols = layoutColumns(matched);
      setActiveLayout(matched.name);
      setLayoutCols(cols.length ? cols : null);
    } else if (savedLayout) {
      defaultSnapshot.current = { filters, sort: sortState };
      applyLayout(savedLayout.name);
    } else setActiveLayout(DEFAULT_LAYOUT);
  });
  const canRestore = activeLayout === null && ready && layoutsQuery.isSuccess;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot restore once layouts and saved state are in
    if (canRestore) restoreLayout();
  }, [canRestore]);

  /** a layout just created or edited is applied (Desk re-applies the active one after on_save) */
  const onLayoutSaved = async (saved: ListLayout) => {
    const fresh = (await layoutsQuery.refetch()).data ?? [];
    captureDefault();
    applyLayout(saved.name, fresh);
  };
  /** delete_layout: deleting the active layout goes back to Default Layout */
  const onLayoutDeleted = (l: ListLayout) => {
    void layoutsQuery.refetch();
    if (activeLayout === l.name) applyLayout(DEFAULT_LAYOUT);
  };

  return { ...listState, layouts, layoutsLoaded: layoutsQuery.isSuccess, activeLayout, layoutCols, selectLayout, onLayoutSaved, onLayoutDeleted };
}
