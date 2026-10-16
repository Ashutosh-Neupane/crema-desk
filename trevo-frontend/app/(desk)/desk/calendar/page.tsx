"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useList } from "@/lib/hooks/useList";
import type { FilterCondition } from "@/lib/frappe/types";
import { Card } from "@/components/shadcn/card";
import { Badge } from "@/components/shadcn/badge";
import { CalendarSkeleton } from "@/components/Skeleton";

const subscribeNoop = () => () => {};
const getToday = () => new Date().toDateString();

export default function CalendarPage() {
  // server and first client render agree (no "today" highlight until hydrated)
  const todayKey = useSyncExternalStore(subscribeNoop, getToday, () => "");
  const today = todayKey ? new Date(todayKey) : null;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const blanks = Array.from({ length: startDay }, () => null);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  // Frappe Event: starts_on / ends_on (there is no start/end column)
  const calendarFilters = [["starts_on", "Between", [monthStartStr, monthEndStr] as unknown]] as FilterCondition[];
  const { data: events, isLoading: eventsLoading } = useList("Event", {
    fields: ["name", "subject", "event_type", "starts_on", "ends_on", "color"],
    filters: calendarFilters,
    order_by: "starts_on asc",
    limit: 100,
  });

  const taskFilters = [["exp_end_date", "Between", [monthStartStr, monthEndStr] as unknown]] as FilterCondition[];
  const { data: tasks, isLoading: tasksLoading } = useList("Task", {
    fields: ["name", "subject", "status", "priority", "exp_start_date", "exp_end_date"],
    filters: taskFilters,
    order_by: "exp_end_date asc",
    limit: 100,
  });

  const isLoading = eventsLoading || tasksLoading;

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<Record<string, unknown>>>();
    for (const ev of events ?? []) {
      if (!ev.starts_on) continue;
      const dateStr = format(parseISO(String(ev.starts_on).replace(" ", "T")), "yyyy-MM-dd");
      const list = map.get(dateStr) ?? [];
      list.push(ev);
      map.set(dateStr, list);
    }
    return map;
  }, [events]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Array<Record<string, unknown>>>();
    for (const task of tasks ?? []) {
      const dateStr = format(parseISO(String(task.exp_end_date ?? "")), "yyyy-MM-dd");
      const list = map.get(dateStr) ?? [];
      list.push(task);
      map.set(dateStr, list);
    }
    return map;
  }, [tasks]);

  const getEventsForDay = (day: Date) => {
    const key = format(day, "yyyy-MM-dd");
    return [...(eventsByDate.get(key) ?? []), ...(tasksByDate.get(key) ?? [])];
  };

  const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    Open: "default",
    Completed: "secondary",
    Cancelled: "destructive",
    "To Do": "outline",
    "In Progress": "default",
    Done: "secondary",
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Calendar</h1>
            <div className="flex items-center gap-2">
              <button aria-label="Previous month"
                onClick={prevMonth}
                className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </button>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 min-w-[140px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button aria-label="Next month"
                onClick={nextMonth}
                className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <ChevronRight className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="px-2 py-2 text-center text-xs font-medium text-zinc-500">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[100px] border-b border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50" />
                  ))}

                  {days.map((day) => {
                    const isToday = !!today && isSameDay(day, today);
                    const dayEvents = getEventsForDay(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[100px] border-b border-r border-zinc-200 p-2 dark:border-zinc-700 ${
                          isSameMonth(day, currentMonth) ? "bg-white dark:bg-zinc-800" : "bg-zinc-50/50 dark:bg-zinc-900/50"
                        }`}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                            isToday
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((ev, idx) => (
                            <div
                              key={idx}
                              className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                "color" in ev && typeof ev.color === "string"
                                  ? ""
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                              }`}
                              style={
                                "color" in ev && typeof ev.color === "string"
                                  ? { backgroundColor: ev.color + "20", color: ev.color }
                                  : undefined
                              }
                            >
                              {"subject" in ev ? String(ev.subject) : "Event"}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="px-1.5 text-[10px] text-zinc-500">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Legend</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-blue-500" />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Events</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-zinc-500" />
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">Tasks</span>
                  </div>
                </div>
              </Card>

              {(events ?? []).length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Upcoming Events</h3>
                  <div className="space-y-2">
                    {(events as Array<Record<string, unknown>>).slice(0, 5).map((ev) => (
                      <div key={String(ev.name)} className="flex items-center gap-2">
                        <Badge variant={statusColor[String(ev.event_type ?? "info")] || "outline"}>{String(ev.event_type ?? "Event")}</Badge>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{String(ev.subject ?? "-")}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {(tasks ?? []).length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Pending Tasks</h3>
                  <div className="space-y-2">
                    {(tasks as Array<Record<string, unknown>>).slice(0, 5).map((task) => (
                      <div key={String(task.name)} className="flex items-center gap-2">
                        <Badge variant={statusColor[String(task.status ?? "To Do")] || "outline"}>{String(task.status ?? "To Do")}</Badge>
                        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{String(task.subject ?? "-")}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
