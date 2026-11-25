export interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  status?: string;
  raw: Record<string, unknown>;
}

export type CalendarMode = "month" | "week";

export const enc = encodeURIComponent;
export const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const stamp = (d: Date) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const parse = (v: unknown) => (v ? new Date(String(v).replace(" ", "T")) : null);
export const DAY = 86400000;
export const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
export const STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100",
  inverse: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
  default: "bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100",
};
