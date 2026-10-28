"use client";

/**
 * frappe.views.calendar[doctype] from the DocType's calendar JS (__calendar_js) — shared by the
 * Calendar and Gantt views. `gantt` may be `true` or an object that overrides the settings (Desk).
 */
import { useMemo } from "react";
import { createRuntime } from "@/lib/desk-runtime";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import type { DocTypeMeta } from "@/lib/frappe/types";

export interface FieldMap {
  start: string;
  end?: string;
  id?: string;
  title?: string;
  allDay?: string;
  color?: string;
  status?: string;
  progress?: string;
  depends_on?: string;
}
export interface CalendarSettings {
  field_map?: FieldMap;
  get_events_method?: string;
  style_map?: Record<string, string>;
  filters?: Array<{ fieldname: string; options?: string; label?: string }>;
  gantt?: boolean | Partial<CalendarSettings>;
}

export function useCalendarSettings(meta: DocTypeMeta | undefined, opts: { gantt?: boolean } = {}): CalendarSettings | null {
  const { data: ctx } = useDeskContext();
  return useMemo(() => {
    if (!meta || !ctx) return null;
    const rt = createRuntime({ user: ctx.user, roles: ctx.roles, defaults: ctx.defaults, sysdefaults: ctx.sysdefaults, perms: ctx.perms, boot: ctx.boot, metas: { [meta.name]: meta } });
    const views = (rt.frappe as unknown as { views: Record<string, unknown> }).views;
    views.calendar ??= {};
    rt.evalScript(String((meta as { __calendar_js?: string }).__calendar_js ?? ""), `${meta.name} calendar js`);
    let s = (views.calendar as Record<string, CalendarSettings>)[meta.name];
    if (s && opts.gantt && typeof s.gantt === "object") s = { ...s, ...s.gantt, field_map: { ...s.field_map, ...s.gantt.field_map } as FieldMap };
    if (s?.field_map?.start) return s;
    // no calendar JS: the first Date/Datetime field (Desk's fallback for Calendar View docs)
    const dateField = meta.fields?.find((f) => f.fieldtype === "Datetime" || f.fieldtype === "Date");
    if (!dateField) return {};
    const title = typeof meta.title_field === "string" && meta.title_field ? meta.title_field : "name";
    return { field_map: { start: dateField.fieldname, end: dateField.fieldname, id: "name", title, allDay: dateField.fieldtype === "Date" ? "__all_day" : undefined } };
  }, [meta, ctx, opts.gantt]);
}
