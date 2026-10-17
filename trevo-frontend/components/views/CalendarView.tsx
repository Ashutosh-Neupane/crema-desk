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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Filter as FilterIcon, ListFilter, Plus, X } from "lucide-react";
import { createRuntime } from "@/lib/desk-runtime";
import { deskCall } from "@/lib/frappe/form";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { PREFILL_KEY } from "@/lib/form/prefill";
import type { Filter } from "@/lib/list/api";
import { FilterEditor, OPERATORS, describeValue, fieldLabel } from "@/components/list/filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

interface FieldMap {
  start: string;
  end?: string;
  id?: string;
  title?: string;
  allDay?: string;
  color?: string;
  status?: string;
}
interface CalSettings {
  field_map?: FieldMap;
  get_events_method?: string;
  style_map?: Record<string, string>;
  filters?: Array<{ fieldname: string; options?: string; label?: string }>;
}
interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  status?: string;
  raw: Record<string, unknown>;
}

const enc = encodeURIComponent;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d: Date) =>
  `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const parse = (v: unknown) => (v ? new Date(String(v).replace(" ", "T")) : null);
const DAY = 86400000;
const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100",
  inverse: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
  default: "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100",
};

export default function CalendarView({ doctype }: { doctype: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: meta, error } = useDoctype(doctype);
  const { data: ctx } = useDeskContext();

  // frappe.views.calendar[doctype] from the DocType's calendar JS; fallback: first Date/Datetime field
  const settings = useMemo<CalSettings | null>(() => {
    if (!meta || !ctx) return null;
    const rt = createRuntime({
      user: ctx.user,
      roles: ctx.roles,
      defaults: ctx.defaults,
      sysdefaults: ctx.sysdefaults,
      perms: ctx.perms,
      boot: ctx.boot,
      metas: { [meta.name]: meta },
    });
    const views = (rt.frappe as unknown as { views: Record<string, unknown> }).views;
    views.calendar ??= {};
    rt.evalScript(
      String((meta as { __calendar_js?: string }).__calendar_js ?? ""),
      `${doctype} calendar js`
    );
    const s = (views.calendar as Record<string, CalSettings>)[doctype];
    if (s?.field_map?.start) return s;
    const dateField = meta.fields?.find(
      (f) => f.fieldtype === "Datetime" || f.fieldtype === "Date"
    );
    if (!dateField) return {};
    const title =
      typeof meta.title_field === "string" && meta.title_field ? meta.title_field : "name";
    return {
      field_map: {
        start: dateField.fieldname,
        end: dateField.fieldname,
        id: "name",
        title,
        allDay: dateField.fieldtype === "Date" ? "__all_day" : undefined,
      },
    };
  }, [meta, ctx, doctype]);
  const fm = settings?.field_map;

  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [filters, setFilters] = useState<Filter[]>([]);

  // visible range: whole weeks covering the month, or the cursor's week (Sunday start like Desk's default)
  const range = useMemo(() => {
    const start = new Date(cursor);
    if (mode === "month") start.setDate(1);
    start.setDate(start.getDate() - start.getDay());
    const days = mode === "month" ? 42 : 7;
    return { start, end: new Date(start.getTime() + days * DAY - 1000), days };
  }, [cursor, mode]);

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
      const { env } = await deskCall(
        settings?.get_events_method || "frappe.desk.calendar.get_events",
        args
      );
      const list = (env.message as Array<Record<string, unknown>>) ?? [];
      return list.flatMap((r): CalEvent[] => {
        const start = parse(r[fm!.start]);
        if (!start) return [];
        const end = parse(fm!.end ? r[fm!.end] : null) ?? start;
        const allDay =
          fm!.allDay === "__all_day" ||
          !!Number(r[fm!.allDay ?? ""]) ||
          !String(r[fm!.start]).includes(":");
        return [
          {
            id: String(r[fm!.id ?? "name"] ?? r.name),
            title: String(r[fm!.title ?? "name"] ?? r.name ?? ""),
            start,
            end: end < start ? start : end,
            allDay,
            color: (fm!.color ? r[fm!.color] : r.color) as string | undefined,
            status: fm!.status ? String(r[fm!.status] ?? "") : undefined,
            raw: r,
          },
        ];
      });
    },
  });
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data]);

  const days = useMemo(
    () => Array.from({ length: range.days }, (_, i) => new Date(range.start.getTime() + i * DAY)),
    [range]
  );
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      // multi-day events show on each covered day (clipped to the range)
      const first = new Date(Math.max(e.start.getTime(), range.start.getTime()));
      first.setHours(0, 0, 0, 0);
      for (let d = first; d <= e.end && d <= range.end; d = new Date(d.getTime() + DAY)) {
        const k = ymd(d);
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(e);
      }
    }
    for (const list of m.values())
      list.sort(
        (a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime()
      );
    return m;
  }, [events, range]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = async (e: DragEndEvent) => {
    const ev = events.find(
      (x) => `ev:${x.id}:${ymd(x.start)}` === e.active.id || e.active.id === `ev:${x.id}`
    );
    const target = e.over?.id ? String(e.over.id).replace("day:", "") : null;
    if (!ev || !target || !fm) return;
    const [y, mo, d] = target.split("-").map(Number);
    const newStart = new Date(ev.start);
    newStart.setFullYear(y, mo - 1, d);
    const delta = newStart.getTime() - ev.start.getTime();
    if (!delta) return;
    const newEnd = new Date(ev.end.getTime() + delta);
    const dateOnly = (v: unknown) => !String(v ?? "").includes(":");
    const args: Record<string, unknown> = {
      doctype,
      name: ev.id,
      [fm.start]: dateOnly(ev.raw[fm.start]) ? ymd(newStart) : stamp(newStart),
    };
    if (fm.end && fm.end !== fm.start)
      args[fm.end] = ev.raw[fm.end]
        ? dateOnly(ev.raw[fm.end])
          ? ymd(newEnd)
          : stamp(newEnd)
        : null;
    try {
      await deskCall("frappe.desk.calendar.update_event", {
        args: JSON.stringify(args),
        field_map: JSON.stringify(fm),
      });
      toast.success(`Moved ${ev.title} to ${target}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move event", { duration: 8000 });
    }
    qc.invalidateQueries({ queryKey: ["calendar", doctype] });
  };

  const newOn = (d: Date) => {
    if (!fm) return;
    const startDf = meta?.fields?.find((f) => f.fieldname === fm.start);
    const v = startDf?.fieldtype === "Datetime" ? `${ymd(d)} 09:00:00` : ymd(d);
    sessionStorage.setItem(
      PREFILL_KEY(doctype),
      JSON.stringify({ [fm.start]: v, ...(fm.end && fm.end !== fm.start ? { [fm.end]: v } : {}) })
    );
    router.push(`/desk/doctype/${enc(doctype)}/new`);
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
    return (
      <p className="p-6 text-sm text-zinc-500">
        {doctype} has no date field to show on a calendar.
      </p>
    );

  const today = ymd(new Date());
  const heading =
    mode === "month"
      ? cursor.toLocaleDateString("en", { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString("en", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            <Link href={`/desk/doctype/${enc(doctype)}`} className="hover:underline">
              {doctype}
            </Link>
            {" / Calendar"}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{heading}</h1>
        </div>
        <nav
          aria-label="Views"
          className="flex rounded-md border border-zinc-200 p-0.5 text-sm dark:border-zinc-700"
        >
          <Link
            href={`/desk/doctype/${enc(doctype)}${meta.is_tree ? "?view=list" : ""}`}
            prefetch={false}
            className="rounded px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            List
          </Link>
          <span
            aria-current="page"
            className="rounded bg-zinc-100 px-2.5 py-1 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          >
            Calendar
          </span>
        </nav>
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
        <button type="button" className={btn} onClick={() => shift(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => setCursor(new Date(new Date().setHours(0, 0, 0, 0)))}
        >
          Today
        </button>
        <button type="button" className={btn} onClick={() => shift(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <Popover>
          <PopoverTrigger className={btn}>
            <FilterIcon className="h-3.5 w-3.5" aria-hidden /> Filter
            {filters.length > 0 && (
              <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                {filters.length}
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <FilterEditor
              meta={meta}
              onAdd={(f) =>
                setFilters((fs) => [...fs.filter((x) => !(x[1] === f[1] && x[2] === f[2])), f])
              }
            />
          </PopoverContent>
        </Popover>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f, i) => (
            <span
              key={`${f[1]}|${f[2]}|${JSON.stringify(f[3])}`}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <ListFilter className="h-3 w-3 text-zinc-400" aria-hidden />
              <span className="font-medium">{fieldLabel(meta, f[1])}</span>
              <span className="text-zinc-400">
                {OPERATORS.find((o) => o.op === f[2])?.label ?? f[2]}
              </span>
              <span>{describeValue(f[3]).replace(/^%|%$/g, "")}</span>
              <button
                type="button"
                onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                aria-label={`Remove ${fieldLabel(meta, f[1])} filter`}
                className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
        <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div
          className={`grid min-h-0 flex-1 grid-cols-7 ${mode === "month" ? "grid-rows-6" : "grid-rows-1"} overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800`}
          role="grid"
          aria-label={`${doctype} calendar`}
        >
          {days.map((d) => {
            const k = ymd(d);
            const inMonth = mode === "week" || d.getMonth() === cursor.getMonth();
            return (
              <DayCell
                key={k}
                id={k}
                label={d.toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                muted={!inMonth}
                today={k === today}
                dayNum={d.getDate()}
                onNew={() => newOn(d)}
              >
                {(byDay.get(k) ?? []).slice(0, mode === "month" ? 4 : 50).map((e) => (
                  <EventChip
                    key={`${e.id}:${k}`}
                    id={`ev:${e.id}:${k}`}
                    ev={e}
                    cls={STYLE[settings.style_map?.[e.status ?? ""] ?? "default"] ?? STYLE.default}
                    href={`/desk/doctype/${enc(doctype)}/${enc(e.id)}`}
                  />
                ))}
                {mode === "month" && (byDay.get(k)?.length ?? 0) > 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCursor(d);
                      setMode("week");
                    }}
                    className="px-1 text-left text-[11px] text-zinc-500 hover:underline"
                  >
                    +{byDay.get(k)!.length - 4} more
                  </button>
                )}
              </DayCell>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function DayCell({
  id,
  label,
  muted,
  today,
  dayNum,
  onNew,
  children,
}: {
  id: string;
  label: string;
  muted: boolean;
  today: boolean;
  dayNum: number;
  onNew: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${id}` });
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      className={`group flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-zinc-100 p-1 dark:border-zinc-800 ${muted ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950"} ${isOver ? "ring-2 ring-inset ring-blue-400" : ""}`}
    >
      <div className="flex items-center">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900" : muted ? "text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}
        >
          {dayNum}
        </span>
        <button
          type="button"
          onClick={onNew}
          aria-label={`New on ${label}`}
          className="ml-auto rounded p-0.5 text-zinc-400 opacity-0 hover:bg-zinc-100 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-zinc-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">{children}</div>
    </div>
  );
}

function EventChip({ id, ev, cls, href }: { id: string; ev: CalEvent; cls: string; href: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const time = ev.allDay ? "" : `${pad(ev.start.getHours())}:${pad(ev.start.getMinutes())} `;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 }
          : undefined
      }
      className={isDragging ? "opacity-70" : ""}
    >
      <Link
        href={href}
        draggable={false}
        className={`block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight ${cls}`}
        style={ev.color ? { backgroundColor: ev.color, color: "#fff" } : undefined}
        title={`${time}${ev.title}`}
      >
        {time}
        {ev.title}
      </Link>
    </div>
  );
}
