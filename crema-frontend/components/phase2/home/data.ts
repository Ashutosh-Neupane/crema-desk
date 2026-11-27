import { doctypeUrl } from "@/lib/navigation/deskUrl";
/**
 * "My work" (docs/GAPS.md § 3.4 Home) — pure helpers shared by the fetchers and the views.
 * No React here so the component modules only export components.
 */

export type WorkKind = "approval" | "assignment" | "draft" | "viewed" | "edited";

/** One row on the page: a document (or ToDo) with where it opens. */
export interface WorkItem {
  key: string;
  kind: WorkKind;
  doctype: string;
  name: string;
  title: string;
  href: string;
  /** short status words shown as a pill: workflow state, priority, "Draft" */
  status?: string;
  /** extra context line: "Assigned by …", "Due 18-11-2026" */
  detail?: string;
  /** ms since epoch, for sorting and "2h ago" */
  at?: number;
  /** ToDo past its date */
  overdue?: boolean;
}

export interface Shortcut {
  key: string;
  label: string;
  href: string;
  external: boolean;
  type: string;
  /** link_to of a DocType shortcut */
  doctype?: string;
}

/** visible keyboard focus for every link / button on the page */
export const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const enc = encodeURIComponent;

export function docHref(doctype: string, name: string): string {
  return `${doctypeUrl(doctype)}/${enc(name)}`;
}

export function stripHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Frappe datetime ("2026-11-18 10:02:03.123456") → ms; the server's wall clock is close enough for "2h ago". */
export function parseFrappeDate(s: unknown): number | undefined {
  if (typeof s !== "string" || !s) return undefined;
  const t = Date.parse(s.replace(" ", "T").slice(0, 23));
  return Number.isNaN(t) ? undefined : t;
}

/** YYYY-MM-DD in the browser's timezone, n days from today (toISOString() would be the UTC day) */
export function localDay(n = 0): string {
  return new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA");
}

export function timeAgo(ts: number | undefined, now = Date.now()): string {
  if (!ts) return "";
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Desk route strings in `boot.frequently_visited_links` (route_history.py → frequently_visited_links):
 * "List/Sales Order/List", "Form/Sales Order/SO-0001", "Tree/Account", "Workspaces/Home".
 */
export function parseDeskRoute(route: string): { doctype?: string; name?: string } {
  const parts = route.split("/");
  if (parts[0] === "Form" && parts[1]) return { doctype: parts[1], name: parts.slice(2).join("/") || undefined };
  if (["List", "Tree", "Report", "Kanban", "Calendar", "Gantt", "Dashboard View"].includes(parts[0]) && parts[1]) return { doctype: parts[1] };
  return {};
}

// doctypes that are plumbing rather than someone's work
const NOT_WORK = new Set(["DocType", "Workspace", "Workflow Action", "Route History", "Version", "Comment", "Communication", "File", "Activity Log", "Access Log", "Error Log"]);

/**
 * The doctypes this user works in, most relevant first, from what Desk already knows about them:
 * open approvals and assignments, Desk's route history (boot.frequently_visited_links), documents opened in Crema,
 * and the user's workspace shortcuts. Only doctypes the boot says the user can read are kept.
 */
export function workDoctypes(sources: Array<Array<string | undefined>>, canRead: ReadonlySet<string>, max = 10): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of sources) {
    for (const dt of list) {
      if (!dt || seen.has(dt) || NOT_WORK.has(dt) || !canRead.has(dt)) continue;
      seen.add(dt);
      out.push(dt);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** Keep the first row per document, joining the reasons ("Approve · Assigned"). */
export function dedupeByDoc(items: WorkItem[]): WorkItem[] {
  const byDoc = new Map<string, WorkItem>();
  for (const it of items) {
    const k = `${it.doctype}\u0000${it.name}`;
    const prev = byDoc.get(k);
    if (!prev) byDoc.set(k, it);
    else if (it.status && prev.status !== it.status) byDoc.set(k, { ...prev, status: prev.status ? `${prev.status} · ${it.status}` : it.status });
  }
  return [...byDoc.values()];
}

export function byRecent(a: WorkItem, b: WorkItem): number {
  return (b.at ?? 0) - (a.at ?? 0);
}
