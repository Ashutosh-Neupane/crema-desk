/**
 * Pure helpers for the app-supplied home (useProviderHome): links, ordering, the headline and the create list.
 * Rules follow the Desk home they mirror: most-used first, waiting work before the rest.
 */
import { docUrl, doctypeUrl, reportUrl, workspaceUrl } from "@/lib/navigation/deskUrl";
import type { NavLinkItem, NavSection } from "@/lib/navigation";
import type { Cue, HomeData, KpiGroup, RecentRow } from "./useProviderHome";

/** documents worth a Create button when the site configured none (common business documents) */
const QUICK_CREATE = ["Sales Invoice", "Sales Order", "Quotation", "Customer", "Item", "Purchase Order", "Payment Entry", "Lead", "Purchase Invoice", "Supplier", "Journal Entry", "Stock Entry", "Delivery Note", "Purchase Receipt", "Material Request", "Work Order", "BOM", "Project", "Task", "Timesheet", "Issue", "Opportunity", "Asset", "Quality Inspection", "ToDo", "Event", "Note"];
/** documents the system makes, never created by hand */
const MADE_BY_SYSTEM = new Set(["Serial and Batch Bundle", "Stock Ledger Entry", "GL Entry", "Repost Item Valuation", "Bin"]);
/** a DocType joins Create once the user worked with it this much (an edit counts 3, an open 2, a list visit 1) */
const FREQUENT_MIN = 6;
const CREATE_MAX = 8;

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function recentHref(r: RecentRow): string | null {
  if (r.type === "Form" && r.doctype && r.name) return docUrl(r.doctype, r.name);
  if (r.type === "List" && r.doctype) return doctypeUrl(r.doctype);
  if (r.type === "Report" && r.name) return reportUrl(r.name);
  return null;
}

export const cueHref = (c: Cue) => `${doctypeUrl(c.doctype)}${c.filters?.length ? `?filters=${encodeURIComponent(JSON.stringify(c.filters))}` : ""}`;

/** "NPR 31.8L": amounts on cues are totals, read at a glance */
const COMPACT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 2 });
export function compactAmount(v: number | undefined, currency?: string): string {
  if (!v) return "";
  const n = COMPACT.format(v);
  return currency ? `${currency} ${n}` : n;
}

/** KPI tabs: the modules the user works in most first */
export function orderedGroups(data: HomeData): KpiGroup[] {
  const used = data.usage?.modules ?? {};
  return (data.kpis ?? []).map((g, i) => ({ g, i })).sort((a, b) => (used[b.g.module] ?? 0) - (used[a.g.module] ?? 0) || a.i - b.i).map((x) => x.g);
}

/** one sentence under the greeting: what waits today */
export function headline(data: HomeData): string {
  const parts: string[] = [];
  const approvals = data.approvals?.total ?? data.approvals?.items.length ?? 0;
  const tasks = data.assigned?.items ?? [];
  const overdue = tasks.filter((t) => t.date && t.date < today()).length;
  if (approvals) parts.push(`${approvals} waiting for your approval`);
  if (overdue) parts.push(overdue === 1 ? "1 overdue task" : `${overdue} overdue tasks`);
  else if (data.assigned?.total) parts.push(`${data.assigned.total} assigned to you`);
  if (data.approvals?.mine_total) parts.push(`${data.approvals.mine_total} of your documents to move on`);
  const urgent = (data.cues?.items ?? []).filter((c) => c.tone === "danger" || c.tone === "warning");
  for (const c of urgent.slice(0, Math.max(0, 2 - parts.length))) parts.push(`${c.label}: ${c.more ? `${c.count}+` : c.count}`);
  return parts.length ? parts.join(" · ") : "You're all caught up.";
}

/** what the user may create, most used first */
function creatable(doctypes: string[], canCreate: Set<string>, used: Record<string, number>): string[] {
  return [...new Set(doctypes)]
    .filter((dt) => dt && canCreate.has(dt) && !MADE_BY_SYSTEM.has(dt))
    .map((dt, i) => ({ dt, i, use: used[dt] ?? 0 }))
    .sort((a, b) => b.use - a.use || a.i - b.i)
    .map((x) => x.dt);
}

/** Create buttons: the selected module's documents first, then the general list (the site's choice, else common ones) */
export function createList(data: HomeData, group: KpiGroup | undefined, canCreate: Set<string>): { own: string[]; other: string[] } {
  const used = data.usage?.doctypes ?? {};
  const config = data.create_config ?? [];
  const general = config.length
    ? creatable(config.map((r) => r.doctype), canCreate, used)
    : creatable([...(data.custom ?? []).filter((c) => c.can_create).slice(0, 3).map((c) => c.doctype), ...QUICK_CREATE, ...Object.keys(used).filter((dt) => used[dt] >= FREQUENT_MIN)], canCreate, used);
  const configured = group ? config.filter((r) => r.module === group.module).map((r) => r.doctype) : [];
  const own = creatable(configured.length ? configured : (group?.doctypes ?? []), canCreate, used).slice(0, CREATE_MAX);
  const mine = new Set(own);
  return { own, other: general.filter((dt) => !mine.has(dt)).slice(0, CREATE_MAX) };
}

function findSection(sections: NavSection[], names: Set<string>): NavSection | null {
  for (const s of sections) {
    if (names.has(s.label) || names.has(s.id)) return s;
    const inner = findSection(s.items.filter((i): i is NavSection => i.type === "section"), names);
    if (inner) return inner;
  }
  return null;
}

export interface QuickLink {
  href: string;
  label: string;
  count?: number;
  tone?: string;
  hint?: string;
}

/** the module's lists and reports from its sidebar, those with waiting work (and their count) first */
export function quickLinks(sections: NavSection[], group: KpiGroup, cues: Cue[], limit = 6): QuickLink[] {
  const section = findSection(sections, new Set([group.workspace ?? "", group.module].filter(Boolean)));
  if (!section) return [];
  const cueAt = new Map(cues.filter((c) => c.count).map((c) => [doctypeUrl(c.doctype), c]));
  // lists and reports only: the workspace and dashboard have their own tiles, and "Home" / "Dashboard" pages
  // in a module's sidebar are not where work is
  const skip = new Set([group.workspace ? workspaceUrl(group.workspace) : "", "/desk", "/desk/home", "/desk/dashboard"]);
  const links = section.items.filter((i): i is NavLinkItem => i.type === "link" && i.href.startsWith("/desk/") && !skip.has(i.href.split("?")[0]) && !/^(home|dashboard)$/i.test(i.label));
  return links
    .map((l, i) => {
      const path = l.href.split("?")[0];
      const cue = cueAt.get(path);
      return { link: { href: l.href, label: l.label, count: cue?.count, tone: cue?.tone, hint: cue?.label }, rank: (cue ? -1000 : 0) + i };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.link);
}
