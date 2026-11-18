/**
 * The `listview` object an app's listview_settings hooks receive (onload(listview), refresh(listview), before_render),
 * as Desk builds it in list/base_list.js + list/list_view.js + ui/page.js — the parts apps use:
 *   page.add_action_item / add_menu_item / add_inner_button (+ group) / set_indicator / clear_indicator / set_title,
 *   get_checked_items(only_docnames), call_for_selected_items(method, args), clear_checked_items, refresh,
 *   filter_area.add / remove / clear / get / exists, get_filter_value, doctype, meta, data, filters, settings.
 * Buttons go into a small store the list view renders (Actions menu, settings menu, toolbar).
 */
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";

export interface PageItem {
  label: string;
  action: () => unknown;
  group?: string;
}

export interface PageState {
  actions: PageItem[];
  menu: PageItem[];
  inner: PageItem[];
  indicator: { label: string; color: string } | null;
  title: string | null;
}

export interface ListviewHost {
  rows: () => Array<Record<string, unknown> & { name: string }>;
  selected: () => string[];
  clearSelected: () => void;
  filters: () => Filter[];
  setFilters: (f: Filter[]) => void;
  refresh: () => void;
}

const plain = (label: unknown) => String(label ?? "").replace(/<[^>]*>/g, "").trim();
const emptyState = (): PageState => ({ actions: [], menu: [], inner: [], indicator: null, title: null });

/** an app hook that throws must not take the list down (Desk logs it and carries on) */
export function runHook(settings: Record<string, unknown> | undefined, name: string, ...args: unknown[]) {
  const fn = settings?.[name];
  if (typeof fn !== "function") return;
  try {
    fn.apply(settings, args);
  } catch (e) {
    console.warn(`listview_settings.${name}:`, e);
  }
}

const NO_HOST: ListviewHost = { rows: () => [], selected: () => [], clearSelected: () => {}, filters: () => [], setFilters: () => {}, refresh: () => {} };

/** the list view hands over its current state with setHost after each render */
export function createListview(doctype: string, meta: DocTypeMeta, settings: Record<string, unknown>) {
  let host = NO_HOST;
  let state = emptyState();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  // ui/page.js add_dropdown_item / add_inner_button: the same label is added once (a later one replaces it)
  const put = (key: "actions" | "menu" | "inner", item: PageItem) => {
    const list = state[key].filter((i) => !(i.label === item.label && i.group === item.group));
    state = { ...state, [key]: [...list, item] };
    emit();
    return item;
  };
  const sameFilter = (a: Filter, b: Filter) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && JSON.stringify(a[3]) === JSON.stringify(b[3]);
  const toFilters = (args: unknown[]): Filter[] => {
    const first = args[0];
    if (typeof first === "string") return [args.slice(0, 4) as Filter];
    if (!Array.isArray(first)) return [];
    return (first as unknown[][]).map((f) => (f.length === 3 ? [doctype, ...f] : f.slice(0, 4)) as Filter);
  };

  const filter_area = {
    get: () => host.filters(),
    exists: (f: Filter) => host.filters().some((x) => sameFilter(x, f)),
    add: (...args: unknown[]) => {
      const next = toFilters(args).filter((f) => !host.filters().some((x) => sameFilter(x, f)));
      if (next.length) host.setFilters([...host.filters(), ...next]);
      return Promise.resolve();
    },
    remove: (fieldname: string) => {
      host.setFilters(host.filters().filter((f) => f[1] !== fieldname));
      return Promise.resolve();
    },
    clear: () => {
      host.setFilters([]);
      return Promise.resolve();
    },
  };

  const listview = {
    doctype,
    meta,
    settings,
    get data() {
      return host.rows();
    },
    get filters() {
      return host.filters();
    },
    filter_area,
    page: {
      add_action_item: (label: unknown, click: () => unknown) => put("actions", { label: plain(label), action: click }),
      add_menu_item: (label: unknown, click: () => unknown) => put("menu", { label: plain(label), action: click }),
      add_inner_button: (label: unknown, action: () => unknown, group?: unknown) => put("inner", { label: plain(label), action, group: group ? plain(group) : undefined }),
      remove_inner_button: (label: unknown, group?: unknown) => {
        state = { ...state, inner: state.inner.filter((i) => !(i.label === plain(label) && (group ? i.group === plain(group) : !i.group))) };
        emit();
      },
      clear_inner_toolbar: () => {
        state = { ...state, inner: [] };
        emit();
      },
      set_indicator: (label: unknown, color?: unknown) => {
        state = { ...state, indicator: { label: plain(label), color: String(color ?? "gray") } };
        emit();
      },
      clear_indicator: () => {
        state = { ...state, indicator: null };
        emit();
      },
      set_title: (title: unknown) => {
        state = { ...state, title: plain(title) };
        emit();
      },
    },
    get_checked_items: (onlyDocnames?: boolean) => {
      const names = host.selected();
      if (onlyDocnames) return names;
      const checked = new Set(names);
      return host.rows().filter((r) => checked.has(r.name));
    },
    clear_checked_items: () => host.clearSelected(),
    /** base_list.js call_for_selected_items: args.names = checked names; refresh when it worked */
    call_for_selected_items: async (method: string, args: Record<string, unknown> = {}) => {
      try {
        await deskCall(method, { ...args, names: JSON.stringify(host.selected()) });
        host.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e), { duration: 8000 });
      }
    },
    /** base_list.js get_filter_value */
    get_filter_value: (fieldname: string) => {
      const f = host.filters().find((x) => x[1] === fieldname);
      if (!f) return undefined;
      if (f[2] === "like") return String(f[3] ?? "").replace(/^%?|%$/g, "");
      if (f[2] === "not set") return null;
      return f[3];
    },
    refresh: () => host.refresh(),
  };

  return {
    listview,
    setHost: (h: ListviewHost) => {
      host = h;
    },
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getState: () => state,
  };
}

export type ListviewHandle = ReturnType<typeof createListview>;
export const EMPTY_PAGE_STATE: PageState = emptyState();
