"use client";

/**
 * Events for the visible range + drag-to-reschedule (Desk: frappe/public/js/frappe/views/calendar/calendar.js).
 * Events: get_events_method or frappe.desk.calendar.get_events; a drop calls frappe.desk.calendar.update_event
 * and keeps the event's duration.
 */
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DragEndEvent } from "@dnd-kit/core";
import { deskCall } from "@/lib/frappe/form";
import type { Filter } from "@/lib/list/api";
import type { CalendarSettings, FieldMap } from "@/lib/views/calendarSettings";
import { DAY, parse, stamp, ymd, type CalEvent, type CalendarMode } from "./shared";

export interface CalendarRange {
  start: Date;
  end: Date;
  days: number;
}

/** whole weeks covering the month, or the cursor's week (Sunday start like Desk's default) */
export function useCalendarRange(cursor: Date, mode: CalendarMode): CalendarRange {
  return useMemo(() => {
    const start = new Date(cursor);
    if (mode === "month") start.setDate(1);
    start.setDate(start.getDate() - start.getDay());
    const days = mode === "month" ? 42 : 7;
    return { start, end: new Date(start.getTime() + days * DAY - 1000), days };
  }, [cursor, mode]);
}

function toEvent(r: Record<string, unknown>, fm: FieldMap): CalEvent | null {
  const start = parse(r[fm.start]);
  if (!start) return null;
  const end = parse(fm.end ? r[fm.end] : null) ?? start;
  const allDay = fm.allDay === "__all_day" || !!Number(r[fm.allDay ?? ""]) || !String(r[fm.start]).includes(":");
  return {
    id: String(r[fm.id ?? "name"] ?? r.name),
    title: String(r[fm.title ?? "name"] ?? r.name ?? ""),
    start,
    end: end < start ? start : end,
    allDay,
    color: (fm.color ? r[fm.color] : r.color) as string | undefined,
    status: fm.status ? String(r[fm.status] ?? "") : undefined,
    raw: r,
  };
}

/** events grouped per visible day; multi-day events show on each covered day (clipped to the range) */
function groupByDay(events: CalEvent[], range: CalendarRange) {
  const m = new Map<string, CalEvent[]>();
  for (const e of events) {
    const first = new Date(Math.max(e.start.getTime(), range.start.getTime()));
    first.setHours(0, 0, 0, 0);
    for (let d = first; d <= e.end && d <= range.end; d = new Date(d.getTime() + DAY)) {
      const k = ymd(d);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
  }
  for (const list of m.values())
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
  return m;
}

/** update_event args for moving `ev` to the day `target` (yyyy-mm-dd), or null when nothing changes */
function moveArgs(doctype: string, ev: CalEvent, target: string, fm: FieldMap) {
  const [y, mo, d] = target.split("-").map(Number);
  const newStart = new Date(ev.start);
  newStart.setFullYear(y, mo - 1, d);
  const delta = newStart.getTime() - ev.start.getTime();
  if (!delta) return null;
  const newEnd = new Date(ev.end.getTime() + delta);
  const dateOnly = (v: unknown) => !String(v ?? "").includes(":");
  const fmt = (v: unknown, date: Date) => (dateOnly(v) ? ymd(date) : stamp(date));
  const args: Record<string, unknown> = { doctype, name: ev.id, [fm.start]: fmt(ev.raw[fm.start], newStart) };
  if (fm.end && fm.end !== fm.start) args[fm.end] = ev.raw[fm.end] ? fmt(ev.raw[fm.end], newEnd) : null;
  return args;
}

export function useCalendarEvents(doctype: string, settings: CalendarSettings | null, range: CalendarRange, filters: Filter[]) {
  const qc = useQueryClient();
  const fm = settings?.field_map;
  const eventsQ = useQuery<CalEvent[]>({
    queryKey: ["calendar", doctype, ymd(range.start), range.days, filters, fm],
    enabled: !!fm?.start,
    queryFn: async () => {
      const args = {
        doctype,
        start: ymd(range.start),
        end: stamp(range.end),
        filters: JSON.stringify(filters),
        field_map: JSON.stringify(fm),
      };
      const { env } = await deskCall(settings?.get_events_method || "frappe.desk.calendar.get_events", args);
      const list = (env.message as Array<Record<string, unknown>>) ?? [];
      return list.map((r) => toEvent(r, fm!)).filter((e): e is CalEvent => !!e);
    },
  });
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);
  const byDay = useMemo(() => groupByDay(events, range), [events, range]);

  const onDragEnd = async (e: DragEndEvent) => {
    const ev = events.find((x) => `ev:${x.id}:${ymd(x.start)}` === e.active.id || e.active.id === `ev:${x.id}`);
    const target = e.over?.id ? String(e.over.id).replace("day:", "") : null;
    if (!ev || !target || !fm) return;
    const args = moveArgs(doctype, ev, target, fm);
    if (!args) return;
    try {
      await deskCall("frappe.desk.calendar.update_event", { args: JSON.stringify(args), field_map: JSON.stringify(fm) });
      toast.success(`Moved ${ev.title} to ${target}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move event", { duration: 8000 });
    }
    qc.invalidateQueries({ queryKey: ["calendar", doctype] });
  };

  return { byDay, onDragEnd };
}
