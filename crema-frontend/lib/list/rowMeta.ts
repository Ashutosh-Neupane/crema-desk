/** Row activity fields stored as JSON lists by Frappe (_assign, _liked_by, _seen). */
export function jsonList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== "string" || !v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

/** list_view.js get_seen_class: bold until the user has opened it (only for DocTypes with track_seen) */
export const isUnread = (seen: unknown, user: string) => !jsonList(seen).includes(user);
