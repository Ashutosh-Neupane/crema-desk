"use client";

/**
 * List View Settings doc of a DocType — what Desk's base_list.js get_list_view_settings reads:
 *   frappe.desk.listview.get_list_settings   → the "List View Settings" doc named after the DocType (or nothing)
 * and what list_settings.js saves:
 *   frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings
 */
import { useQuery } from "@tanstack/react-query";
import { deskCall } from "@/lib/frappe/form";

export interface ListViewSettingsDoc {
  name?: string;
  fields?: string | null; // JSON: [{ fieldname, label, width? }] ("status_field" = the Status indicator column)
  disable_count?: number;
  disable_comment_count?: number;
  disable_sidebar_stats?: number;
  disable_auto_refresh?: number;
  disable_automatic_recency_filters?: number;
  disable_scrolling?: number;
  allow_edit?: number;
  show_tags?: number;
}

export interface ListColumnSetting {
  fieldname: string;
  label?: string;
  width?: number;
}

export const lvsKey = (doctype: string) => ["list-view-settings", doctype] as const;

export async function loadListViewSettings(doctype: string): Promise<ListViewSettingsDoc | null> {
  const { env } = await deskCall("frappe.desk.listview.get_list_settings", { doctype }, { get: true });
  const m = env.message as ListViewSettingsDoc | null | undefined;
  return m && typeof m === "object" ? m : null;
}

/** JSON.parse(settings.fields), tolerant of junk */
export function parseColumnSettings(s: ListViewSettingsDoc | null | undefined): ListColumnSetting[] {
  if (!s?.fields) return [];
  try {
    const a = JSON.parse(s.fields);
    return Array.isArray(a) ? (a as ListColumnSetting[]).filter((f) => f && typeof f.fieldname === "string") : [];
  } catch {
    return [];
  }
}

/** undefined while loading, null when the DocType has no List View Settings doc */
export function useListViewSettings(doctype: string) {
  return useQuery<ListViewSettingsDoc | null>({
    queryKey: lvsKey(doctype),
    queryFn: () => loadListViewSettings(doctype),
    staleTime: 0,
    enabled: !!doctype,
  });
}
