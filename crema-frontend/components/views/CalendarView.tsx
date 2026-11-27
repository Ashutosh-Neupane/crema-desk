"use client";

/**
 * Calendar view for any DocType (Desk: frappe/public/js/frappe/views/calendar/calendar.js).
 * Settings come from the DocType's own calendar JS (frappe.views.calendar[doctype] via __calendar_js):
 * field_map (start/end/title/allDay/color/status), filters, get_events_method, style_map.
 * Events: get_events_method or frappe.desk.calendar.get_events; drag to reschedule →
 * frappe.desk.calendar.update_event (keeps the event's duration).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useCalendarSettings } from "@/lib/views/calendarSettings";
import { PREFILL_KEY } from "@/lib/form/prefill";
import type { Filter } from "@/lib/list/api";
import type { DocTypeMeta } from "@/lib/frappe/types";
import { FilterButton, FilterPills } from "./parts/FilterBar";
import { monthDay, monthDayYear, monthYear } from "./parts/dateLabels";
import { CalendarGrid } from "./parts/calendar/CalendarGrid";
import { useCalendarEvents, useCalendarRange } from "./parts/calendar/useCalendarEvents";
import { DAY, btn, ymd, type CalendarMode } from "./parts/calendar/shared";
import { doctypeUrl } from "@/lib/navigation/deskUrl";
import { ViewMenu } from "@/components/views/ViewMenu";

const startOfToday = () => new Date(new Date().setHours(0, 0, 0, 0));

export default function CalendarView({ doctype }: { doctype: string }) {
  const router = useRouter();
  const { data: meta, error } = useDoctype(doctype);
  const settings = useCalendarSettings(meta);
  const fm = settings?.field_map;

  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(startOfToday);
  const [filters, setFilters] = useState<Filter[]>([]);

  const range = useCalendarRange(cursor, mode);
  const { byDay, onDragEnd } = useCalendarEvents(doctype, settings, range, filters);
  const days = useMemo(
    () => Array.from({ length: range.days }, (_, i) => new Date(range.start.getTime() + i * DAY)),
    [range]
  );

  const newOn = (d: Date) => {
    if (!fm) return;
    const startDf = meta?.fields?.find((f) => f.fieldname === fm.start);
    const v = startDf?.fieldtype === "Datetime" ? `${ymd(d)} 09:00:00` : ymd(d);
    sessionStorage.setItem(
      PREFILL_KEY(doctype),
      JSON.stringify({ [fm.start]: v, ...(fm.end && fm.end !== fm.start ? { [fm.end]: v } : {}) })
    );
    router.push(`${doctypeUrl(doctype)}/new`);
  };

  const shift = (n: number) =>
    setCursor((c) => {
      const d = new Date(c);
      if (mode === "month") d.setMonth(d.getMonth() + n, 1);
      else d.setDate(d.getDate() + 7 * n);
      return d;
    });

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  if (!meta || !settings)
    return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (!fm?.start)
    return <p className="p-6 text-sm text-zinc-500">{doctype} has no date field to show on a calendar.</p>;

  const heading = mode === "month" ? monthYear(cursor) : `${monthDay(days[0])} – ${monthDayYear(days[6])}`;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarTitle doctype={doctype} heading={heading} meta={meta} />
        <ModeSwitch mode={mode} setMode={setMode} />
        <button type="button" className={btn} onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={btn} onClick={() => setCursor(startOfToday())}>
          Today
        </button>
        <button type="button" className={btn} onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <FilterButton meta={meta} filters={filters} setFilters={setFilters} className={btn} />
      </div>

      <FilterPills meta={meta} filters={filters} setFilters={setFilters} />

      <CalendarGrid
        doctype={doctype}
        mode={mode}
        cursor={cursor}
        days={days}
        byDay={byDay}
        styleMap={settings.style_map}
        onDragEnd={onDragEnd}
        onNew={newOn}
        onMore={(d) => {
          setCursor(d);
          setMode("week");
        }}
      />
    </div>
  );
}

function CalendarTitle({ doctype, heading, meta }: { doctype: string; heading: string; meta: DocTypeMeta }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-zinc-500">
          <Link href={`${doctypeUrl(doctype)}`} className="hover:underline">
            {doctype}
          </Link>
          {" / Calendar"}
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h1>
      </div>
      <ViewMenu meta={meta} doctype={doctype} current="calendar" />
    </>
  );
}

function ModeSwitch({ mode, setMode }: { mode: CalendarMode; setMode: (m: CalendarMode) => void }) {
  return (
    <div
      className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700"
      role="group"
      aria-label="Calendar range"
    >
      {(["month", "week"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`rounded px-2.5 py-1 capitalize ${mode === m ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-300"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
