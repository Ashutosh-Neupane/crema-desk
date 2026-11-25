"use client";

/**
 * Report view settings: saved report → user settings ("Report") → list-view defaults; remembered per user
 * (Desk: report_view.js setup_defaults / user_settings).
 */
import { useEffect, useState } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { deskCall } from "@/lib/frappe/form";
import { NO_VALUE, filtersFromParams } from "@/components/list/filters";
import { groupFromParam } from "@/lib/report/groupBy";
import type { DocTypeMeta } from "@/lib/frappe/types";
import type { Col, ReportSettings } from "./shared";

interface SavedReport {
  name: string;
  is_standard?: string;
}

async function loadSaved(doctype: string, reportName: string | undefined): Promise<{ settings: ReportSettings; report: SavedReport | null }> {
  try {
    if (reportName) {
      const { env } = await deskCall("frappe.client.get", { doctype: "Report", name: reportName });
      const doc = env.message as { name: string; json?: string; is_standard?: string };
      return { settings: JSON.parse(doc.json || "{}") as ReportSettings, report: { name: doc.name, is_standard: doc.is_standard } };
    }
    const { env } = await deskCall("frappe.model.utils.user_settings.get", { doctype });
    const us = JSON.parse(String(env.message || "{}")) as { Report?: ReportSettings };
    return { settings: us.Report ?? {}, report: null };
  } catch {
    /* fall back to defaults */
    return { settings: {}, report: null };
  }
}

/** saved settings over the DocType's list-view defaults; the URL's filters / ?_group_by= win */
function resolveSettings(s: ReportSettings, meta: DocTypeMeta, doctype: string, params: URLSearchParams): ReportSettings {
  const titleField = typeof meta.title_field === "string" ? meta.title_field : "";
  const defaults: Col[] = [["name", doctype], ...(meta.fields ?? []).filter((f) => (f.in_list_view || f.fieldname === titleField) && !NO_VALUE.has(f.fieldtype)).map((f) => [f.fieldname, doctype] as Col)];
  if (meta.is_submittable) defaults.push(["docstatus", doctype]);
  const urlFilters = filtersFromParams(doctype, params);
  return {
    fields: s.fields?.length ? s.fields.filter((c) => Array.isArray(c) && c.length >= 2) : defaults,
    filters: urlFilters.length ? urlFilters : (s.filters ?? []),
    order_by: s.order_by || `\`tab${doctype}\`.\`${meta.sort_field || "modified"}\` ${String(meta.sort_order || "desc").toLowerCase()}`,
    add_totals_row: s.add_totals_row ? 1 : 0,
    page_length: s.page_length || 20,
    // ?_group_by= (a shared link, report_view.js parse_filters_from_route_options) wins over what was saved
    group_by: groupFromParam(params.get("_group_by")) ?? (s.group_by?.group_by && s.group_by.aggregate_function ? s.group_by : null),
  };
}

export function useReportViewSettings(doctype: string, reportName: string | undefined, meta: DocTypeMeta | undefined, params: ReadonlyURLSearchParams) {
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [report, setReport] = useState<SavedReport | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    void loadSaved(doctype, reportName).then(({ settings: s, report: r }) => {
      if (cancelled) return;
      if (r) setReport(r);
      setSettings(resolveSettings(s, meta, doctype, new URLSearchParams(params.toString())));
    });
    return () => {
      cancelled = true;
    };
    // params read once on load; later filter edits stay local like Desk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, doctype, reportName]);

  // remember view settings per user (not for saved reports — those save explicitly)
  useEffect(() => {
    if (!settings || reportName) return;
    const t = setTimeout(() => {
      deskCall("frappe.model.utils.user_settings.save", { doctype, user_settings: JSON.stringify({ Report: settings }) }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [settings, doctype, reportName]);

  const update = (patch: Partial<ReportSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s));
  return { settings, report, update };
}
