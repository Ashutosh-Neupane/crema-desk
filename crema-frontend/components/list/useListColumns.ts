"use client";

/** What a list shows: List View Settings (base_list.js get_list_view_settings) and the columns built from them. */
import { useMemo } from "react";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { parseColumnSettings, useListViewSettings, type ListColumnSetting } from "@/lib/list/useListViewSettings";
import { fieldLabel } from "@/components/list/filterModel";
import { buildFetchFields, buildListFields, indicatorCapable, titleFieldOf, type ListSettings } from "@/components/list/listModel";

/** the List View Settings doc (columns, disable_count, …) */
export function useListViewConfig(doctype: string) {
  const q = useListViewSettings(doctype);
  const lvs = q.data;
  const columns = useMemo(() => parseColumnSettings(lvs), [lvs]);
  return {
    lvs: lvs ?? null,
    ready: q.isSuccess || q.isError,
    columns,
    disableCount: !!lvs?.disable_count,
    disableCommentCount: !!lvs?.disable_comment_count,
    disableAutoRefresh: !!lvs?.disable_auto_refresh,
    showSidebar: !lvs?.disable_sidebar_stats,
  };
}

/** list_view.js build_columns / set_fields: the subject, the status column, the field columns and what to fetch */
export function useListColumns(meta: DocTypeMeta | undefined, settings: ListSettings, colSettings: ListColumnSetting[]) {
  const titleField = titleFieldOf(meta);
  const listFields = useMemo(() => buildListFields(meta, colSettings, titleField), [meta, colSettings, titleField]);
  const fetchFields = useMemo(() => buildFetchFields(meta, titleField, listFields, settings), [meta, titleField, listFields, settings]);
  const canIndicate = !!meta && indicatorCapable(meta, settings);
  const hasIndicator = canIndicate && (!colSettings.length || colSettings.some((c) => c.fieldname === "status_field"));
  const subjectLabel = meta && titleField ? fieldLabel(meta, titleField) : "ID";
  // get_current_columns_state: what the list shows now
  const currentColumns: ListColumnSetting[] = colSettings.length
    ? colSettings
    : [{ fieldname: titleField || "name", label: subjectLabel }, ...(hasIndicator ? [{ fieldname: "status_field", label: "Status" }] : []), ...listFields.map((f) => ({ fieldname: f.fieldname, label: f.label || f.fieldname }))];
  return { titleField, listFields, fetchFields, canIndicate, hasIndicator, subjectLabel, currentColumns };
}
