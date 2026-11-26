"use client";

/**
 * Gantt view (Desk: frappe/public/js/frappe/views/gantt/gantt_view.js) for DocTypes whose calendar
 * JS sets `gantt` (Task, Work Order, ToDo, …). Rows come from reportview with the gantt fields;
 * dragging a bar moves it, dragging its right edge changes the end; both save through
 * frappe.desk.gantt.update_task like Desk.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deskCall } from "@/lib/frappe/form";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { fetchRows, type Filter } from "@/lib/list/api";
import { useCalendarSettings } from "@/lib/views/calendarSettings";
import { fieldLabel } from "@/components/list/filters";
import { FilterButton, FilterPills } from "./parts/FilterBar";
import { monthDay, monthShortYear } from "./parts/dateLabels";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

type Scale = "Day" | "Week" | "Month";
const PX: Record<Scale, number> = { Day: 36, Week: 14, Month: 4 };
const DAY = 86400000;
const enc = encodeURIComponent;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day0 = (v: unknown) => {
  if (!v) return null;
  const d = new Date(String(v).slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};
const btn = "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

interface Bar {
  id: string;
  title: string;
  start: Date;
  end: Date;
  progress: number;
}

export default function GanttView({ doctype }: { doctype: string }) {
  const qc = useQueryClient();
  const { data: meta, error } = useDoctype(doctype);
  const settings = useCalendarSettings(meta, { gantt: true });
  const fm = settings?.field_map;
  const [scale, setScale] = useState<Scale>("Day");
  const [filters, setFilters] = useState<Filter[]>([]);

  const rowsQ = useQuery<Bar[]>({
    queryKey: ["gantt", doctype, fm, filters],
    enabled: !!fm?.start && !!meta,
    queryFn: async () => {
      const has = (f?: string) => !!f && (f === "name" || !!meta?.fields?.some((x) => x.fieldname === f));
      const fields = ["name", fm!.start, ...(has(fm!.end) ? [fm!.end!] : []), ...(has(fm!.title) ? [fm!.title!] : []), ...(has(fm!.progress) ? [fm!.progress!] : [])];
      const rows = await fetchRows({ doctype, fields, filters: [...filters, [doctype, fm!.start, "is", "set"]], orderBy: `\`tab${doctype}\`.\`${fm!.start}\` asc`, start: 0, pageLength: 200 });
      return rows.flatMap((r) => {
        const start = day0(r[fm!.start]);
        if (!start) return [];
        const end = day0(fm!.end ? r[fm!.end] : null) ?? start;
        return [{ id: r.name, title: String((fm!.title && r[fm!.title]) || r.name), start, end: end < start ? start : end, progress: Number(fm!.progress ? r[fm!.progress] : 0) || 0 }];
      });
    },
  });
  const bars = useMemo(() => rowsQ.data ?? [], [rowsQ.data]);

  // timeline: a few days before the first bar to a week after the last (or around today)
  const span = useMemo(() => {
    const today = day0(ymd(new Date()))!;
    const first = bars.length ? Math.min(...bars.map((b) => b.start.getTime())) : today.getTime();
    const last = bars.length ? Math.max(...bars.map((b) => b.end.getTime())) : today.getTime();
    const from = new Date(Math.min(first, today.getTime()) - 3 * DAY);
    const to = new Date(Math.max(last, today.getTime()) + 10 * DAY);
    return { from, days: Math.round((to.getTime() - from.getTime()) / DAY) + 1 };
  }, [bars]);
  const px = PX[scale];
  const x = (d: Date) => Math.round((d.getTime() - span.from.getTime()) / DAY) * px;

  // header ticks: days, week starts or month starts
  const ticks = useMemo(() => {
    const out: Array<{ left: number; label: string }> = [];
    for (let i = 0; i < span.days; i++) {
      const d = new Date(span.from.getTime() + i * DAY);
      if (scale === "Day") out.push({ left: i * px, label: `${d.getDate()}` });
      else if (scale === "Week" && d.getDay() === 1) out.push({ left: i * px, label: monthDay(d) });
      else if (scale === "Month" && d.getDate() === 1) out.push({ left: i * px, label: monthShortYear(d) });
    }
    return out;
  }, [span, scale, px]);

  // drag: move (whole bar) or resize (right edge); preview locally, save on release
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; startX: number; days: number } | null>(null);
  const dragRef = useRef(drag);
  // the pointer handlers read the ref; it is written only here, in event handlers (never during render)
  const putDrag = (d: typeof drag) => {
    dragRef.current = d;
    setDrag(d);
  };
  const begin = (e: React.PointerEvent, id: string, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    putDrag({ id, mode, startX: e.clientX, days: 0 });
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const days = Math.round((e.clientX - d.startX) / px);
    if (days !== d.days) putDrag({ ...d, days });
  };
  const endDrag = async () => {
    const d = dragRef.current;
    putDrag(null);
    if (!d || !d.days || !fm) return;
    const bar = bars.find((b) => b.id === d.id);
    if (!bar) return;
    const start = d.mode === "move" ? new Date(bar.start.getTime() + d.days * DAY) : bar.start;
    let end = new Date(bar.end.getTime() + d.days * DAY);
    if (end < start) end = start;
    try {
      await deskCall("frappe.desk.gantt.update_task", { args: JSON.stringify({ doctype, name: bar.id, start: ymd(start), end: ymd(end) }), field_map: JSON.stringify(fm) });
      toast.success(`${bar.title}: ${ymd(start)} → ${ymd(end)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update dates", { duration: 8000 });
    }
    qc.invalidateQueries({ queryKey: ["gantt", doctype] });
  };
  const preview = (b: Bar) => {
    if (!drag || drag.id !== b.id) return b;
    const start = drag.mode === "move" ? new Date(b.start.getTime() + drag.days * DAY) : b.start;
    const end = new Date(b.end.getTime() + drag.days * DAY);
    return { ...b, start, end: end < start ? start : end };
  };

  // Desk opens the chart at today and returns there when the scale changes or "Today" is pressed
  // (views/gantt/gantt_view.js scroll_to_today; frappe-gantt `scroll_to: "today"`)
  const timelineRef = useRef<HTMLDivElement>(null);
  const todayLeft = Math.max(0, x(day0(ymd(new Date()))!) - 3 * px);
  const scrollToToday = () => timelineRef.current?.scrollTo({ left: todayLeft });
  const hasBars = bars.length > 0;
  useEffect(() => {
    if (hasBars) timelineRef.current?.scrollTo({ left: todayLeft });
  }, [hasBars, todayLeft]);

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  if (!meta || !settings) return <div className="m-4 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />;
  if (!fm?.start) return <p className="p-6 text-sm text-zinc-500">{doctype} has no date field for a Gantt chart.</p>;

  const width = span.days * px;
  const todayX = x(day0(ymd(new Date()))!);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`${doctypeUrl(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / Gantt"}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{doctype} Gantt</h1>
        </div>
        <nav aria-label="Views" className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700">
          <Link href={`${doctypeUrl(doctype)}`} prefetch={false} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            List
          </Link>
          <Link href={`${doctypeUrl(doctype)}/view/calendar`} prefetch={false} className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Calendar
          </Link>
          <span aria-current="page" className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            Gantt
          </span>
        </nav>
        <div className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700" role="group" aria-label="Gantt scale">
          {(["Day", "Week", "Month"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scale === s} onClick={() => setScale(s)} className={`rounded px-2.5 py-1 ${scale === s ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-300"}`}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={scrollToToday} className={btn}>
          Today
        </button>
        <FilterButton meta={meta} filters={filters} setFilters={setFilters} className={btn} />
      </div>

      <FilterPills meta={meta} filters={filters} setFilters={setFilters} />

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {/* names */}
        <div className="w-64 shrink-0 overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
          <div className="flex h-9 items-center border-b border-zinc-200 px-3 text-xs font-medium text-zinc-500 dark:border-zinc-800">{fieldLabel(meta, fm.title ?? "name")}</div>
          {bars.map((b) => (
            <div key={b.id} className="flex h-9 items-center border-b border-zinc-100 px-3 text-sm dark:border-zinc-800/60">
              <Link href={`${doctypeUrl(doctype)}/${enc(b.id)}`} className="truncate text-zinc-800 hover:underline dark:text-zinc-200" title={b.title}>
                {b.title}
              </Link>
            </div>
          ))}
          {!rowsQ.isLoading && !bars.length && <p className="p-4 text-sm text-zinc-500">No {doctype} with dates</p>}
        </div>
        {/* timeline */}
        <div ref={timelineRef} className="min-w-0 flex-1 overflow-auto" onPointerMove={moveDrag} onPointerUp={() => void endDrag()}>
          <div className="relative" style={{ width }}>
            <div className="sticky top-0 z-10 h-9 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {ticks.map((t) => (
                <span key={t.left} className="absolute top-0 flex h-9 items-center border-l border-zinc-200 pl-1 text-[11px] text-zinc-500 dark:border-zinc-800" style={{ left: t.left }}>
                  {t.label}
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-0 top-9 w-px bg-red-400" style={{ left: todayX }} aria-hidden />
            {bars.map((raw) => {
              const b = preview(raw);
              const left = x(b.start);
              const w = Math.max(px, x(b.end) - left + px);
              return (
                <div key={b.id} className="relative h-9 border-b border-zinc-100 dark:border-zinc-800/60">
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label={`${b.title}: ${ymd(b.start)} to ${ymd(b.end)}`}
                    aria-valuenow={b.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    onPointerDown={(e) => begin(e, b.id, "move")}
                    className={`absolute top-1.5 flex h-6 cursor-grab items-center overflow-hidden rounded-md bg-blue-200 text-[11px] text-blue-950 shadow-sm active:cursor-grabbing dark:bg-blue-900 dark:text-blue-50 ${drag?.id === b.id ? "ring-2 ring-blue-500" : ""}`}
                    style={{ left, width: w }}
                  >
                    <div className="absolute inset-y-0 left-0 bg-blue-500/40" style={{ width: `${Math.min(100, b.progress)}%` }} aria-hidden />
                    <span className="relative truncate px-2">{b.title}</span>
                    <span onPointerDown={(e) => begin(e, b.id, "resize")} aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-blue-500/30" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
