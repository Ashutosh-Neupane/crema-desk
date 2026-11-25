/**
 * Text ↔ value helpers for DatePicker / TimePicker: the site's date_format / time_format on screen,
 * ISO "yyyy-mm-dd" and "HH:mm:ss" stored, like Frappe.
 */

export const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function formatForUser(iso: string, fmt: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return fmt.replace("yyyy", y).replace("mm", m).replace("dd", d);
}

/** Parse what the user typed in the site's format (or ISO) → ISO, or null */
export function parseUserDate(text: string, fmt: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const parts = t.split(/[^0-9]/).filter(Boolean);
  const order = fmt.split(/[^a-z]/).filter(Boolean); // e.g. ["dd","mm","yyyy"]
  if (parts.length !== 3 || order.length !== 3) return null;
  const get = (k: string) => Number(parts[order.indexOf(k)]);
  let y = get("yyyy");
  const m = get("mm");
  const d = get("dd");
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

export type TimeParts = [number, number, number];

/** "14:30:00.000000" / "14:30" → [14, 30, 0], or null */
export function splitTime(v: string | null | undefined): TimeParts | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(v ?? ""));
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}
export const joinTime = ([h, m, s]: TimeParts) => `${pad(h)}:${pad(m)}:${pad(s)}`;

/** what the user typed → "HH:mm:ss", or null if it isn't a time */
export function parseUserTime(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const m = /^(\d{1,2})(?:[:.\s]?(\d{2}))?(?:[:.](\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const sec = Number(m[3] ?? 0);
  if (m[4]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[4].startsWith("p") ? 12 : 0);
  }
  if (h > 23 || min > 59 || sec > 59) return null;
  return joinTime([h, min, sec]);
}

/** a complete time ("10:00", "10:00:30", "2:30 pm"), as opposed to a half-typed "1" */
export const isCompleteTime = (v: string) => /^\s*\d{1,2}[:.]\d{2}([:.]\d{2})?\s*(am|pm|a|p)?\s*$/i.test(v);
