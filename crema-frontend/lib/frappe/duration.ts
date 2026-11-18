/**
 * Duration values are seconds (Desk: form/controls/duration.js, utils.js seconds_to_duration /
 * get_formatted_duration / duration_to_seconds). hide_days / hide_seconds come from the DocField.
 */
export interface DurationOptions {
  hide_days?: number | boolean;
  hide_seconds?: number | boolean;
}
export interface DurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function secondsToDuration(seconds: number, o?: DurationOptions): DurationParts {
  const floor = seconds > 0 ? Math.floor : Math.ceil;
  const d: DurationParts = {
    days: floor(seconds / 86400),
    hours: floor((seconds % 86400) / 3600),
    minutes: floor((seconds % 3600) / 60),
    seconds: floor(seconds % 60),
  };
  if (o?.hide_days) {
    d.hours = floor(seconds / 3600);
    d.days = 0;
  }
  if (o?.hide_seconds) {
    d.minutes += Math.round(d.seconds / 60);
    d.seconds = 0;
  }
  return d;
}

export function formattedDuration(value: unknown, o?: DurationOptions): string {
  const v = Number(value) || 0;
  if (!v) return "";
  const d = secondsToDuration(v, o);
  const out: string[] = [];
  if (d.days && !o?.hide_days) out.push(`${d.days}d`);
  if (d.hours) out.push(`${d.hours}h`);
  if (d.minutes) out.push(`${d.minutes}m`);
  if (d.seconds && !o?.hide_seconds) out.push(`${d.seconds}s`);
  return out.join(" ");
}

export const durationToSeconds = (d: Partial<DurationParts>) => (d.days || 0) * 86400 + (d.hours || 0) * 3600 + (d.minutes || 0) * 60 + (d.seconds || 0);

const MULT = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
// makeDurationParseRegex: optional "<n>d <n>h <n>m <n>s" parts in that order, anything after ignored
const PARSE = /^\s*(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?\s*.*$/i;

/** duration.js parse: "" → "", digits → seconds, "1d 2h 3m 4s" → seconds, nothing recognised → null */
export function parseDuration(text: string): number | "" | null {
  if (!text.trim()) return "";
  if (/^\s*\d+\s*$/.test(text)) return parseInt(text, 10);
  const m = text.trim().match(PARSE);
  const [d, h, mi, s] = (m ?? []).slice(1, 5);
  if (!m || ![d, h, mi, s].some(Boolean)) return null;
  const n = (x?: string) => parseInt(x || "0", 10) || 0;
  return n(d) * MULT.days + n(h) * MULT.hours + n(mi) * MULT.minutes + n(s) * MULT.seconds;
}
