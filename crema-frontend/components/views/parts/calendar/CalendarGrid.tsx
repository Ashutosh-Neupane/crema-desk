"use client";

import Link from "next/link";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { weekdayMonthDay } from "../dateLabels";
import { STYLE, enc, pad, ymd, type CalEvent, type CalendarMode } from "./shared";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  doctype: string;
  mode: CalendarMode;
  cursor: Date;
  days: Date[];
  byDay: Map<string, CalEvent[]>;
  styleMap?: Record<string, string>;
  onDragEnd: (e: DragEndEvent) => Promise<void>;
  onNew: (d: Date) => void;
  onMore: (d: Date) => void;
}

export function CalendarGrid({ doctype, mode, cursor, days, byDay, styleMap, onDragEnd, onNew, onMore }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const today = ymd(new Date());
  const limit = mode === "month" ? 4 : 50;
  return (
    <DndContext sensors={sensors} onDragEnd={(e) => void onDragEnd(e)}>
      <div className="grid grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800">
        {WEEK.map((d) => (
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
          const list = byDay.get(k) ?? [];
          return (
            <DayCell
              key={k}
              id={k}
              label={weekdayMonthDay(d)}
              muted={mode === "month" && d.getMonth() !== cursor.getMonth()}
              today={k === today}
              dayNum={d.getDate()}
              onNew={() => onNew(d)}
            >
              {list.slice(0, limit).map((e) => (
                <EventChip
                  key={`${e.id}:${k}`}
                  id={`ev:${e.id}:${k}`}
                  ev={e}
                  cls={STYLE[styleMap?.[e.status ?? ""] ?? "default"] ?? STYLE.default}
                  href={`${doctypeUrl(doctype)}/${enc(e.id)}`}
                />
              ))}
              {mode === "month" && list.length > 4 && (
                <button type="button" onClick={() => onMore(d)} className="px-1 text-left text-[11px] text-zinc-500 hover:underline">
                  +{list.length - 4} more
                </button>
              )}
            </DayCell>
          );
        })}
      </div>
    </DndContext>
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
  const dayCls = today
    ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
    : muted
      ? "text-zinc-400"
      : "text-zinc-700 dark:text-zinc-300";
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      className={`group flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-zinc-100 p-1 dark:border-zinc-800 ${muted ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950"} ${isOver ? "ring-2 ring-inset ring-blue-400" : ""}`}
    >
      <div className="flex items-center">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${dayCls}`}>{dayNum}</span>
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
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 20 } : undefined}
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
