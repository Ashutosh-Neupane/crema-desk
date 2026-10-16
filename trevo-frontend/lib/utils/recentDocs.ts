/**
 * Recently opened documents (per browser) for the desk home — a convenience
 * only; storage can be unavailable (private mode), so every access is guarded.
 */
const KEY = "trevo:recent-docs";
const MAX = 12;

export interface RecentDoc {
  doctype: string;
  name: string;
  title?: string;
  at: number;
}

export function getRecentDocs(): RecentDoc[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentDoc[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addRecentDoc(doc: Omit<RecentDoc, "at">): void {
  try {
    const list = getRecentDocs().filter((d) => !(d.doctype === doc.doctype && d.name === doc.name));
    list.unshift({ ...doc, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable — ignore */
  }
}
