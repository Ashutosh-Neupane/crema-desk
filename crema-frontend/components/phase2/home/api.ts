/**
 * "My work" fetchers — Frappe's own whitelisted APIs through Crema's client, nothing new on the server.
 *
 * - Waiting on me: `Workflow Action` rows with status Open. Frappe creates one per document whose workflow state has
 *   a transition for some role (workflow_action.py → process_workflow_actions, hooked on every doc save) and its
 *   permission query only returns the rows whose permitted roles the user holds — the same list Desk shows at
 *   /app/workflow-action. Plus open ToDos allocated to the user (frappe.desk.form.assign_to → `_assign`).
 * - Drafts / recently edited: frappe.client.get_list per doctype the user works in (see workDoctypes), owner or
 *   modified_by = me.
 * - Shortcuts: frappe.desk.desktop.get_desktop_page for the user's private workspace (or the first one in the
 *   sidebar), which already drops shortcuts the user may not open.
 *
 * Every call is guarded by boot `can_read`, so a list the user can't read is never requested.
 */
import { frappeMethod } from "@/lib/frappe/client";
import { fetchDoctypeMetaClient } from "@/lib/frappe/doctype";
import { sidebarItemHref } from "@/lib/navigation";
import type { WorkspaceSidebarItem } from "@/lib/frappe/types";
import { docHref, parseFrappeDate, stripHtml, type Shortcut, type WorkItem } from "./data";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

type Row = Record<string, unknown>;

function getList(doctype: string, args: Row): Promise<Row[]> {
  return frappeMethod<Row[]>("frappe.client.get_list", { doctype, ...args }).then((r) => (Array.isArray(r) ? r : []));
}

export async function fetchWorkflowActions(canRead: ReadonlySet<string>, limit = 20): Promise<WorkItem[]> {
  if (!canRead.has("Workflow Action")) return [];
  const rows = await getList("Workflow Action", {
    fields: ["name", "reference_doctype", "reference_name", "workflow_state", "modified"],
    filters: [["status", "=", "Open"]],
    order_by: "modified desc",
    limit_page_length: limit,
  });
  return rows
    .filter((r) => r.reference_doctype && r.reference_name)
    .map((r) => {
      const doctype = String(r.reference_doctype);
      const name = String(r.reference_name);
      return {
        key: `wa:${r.name}`,
        kind: "approval",
        doctype,
        name,
        title: name,
        href: docHref(doctype, name),
        status: r.workflow_state ? String(r.workflow_state) : "Needs action",
        detail: "Waiting for your action",
        at: parseFrappeDate(r.modified),
      } satisfies WorkItem;
    });
}

export async function fetchAssignments(user: string, canRead: ReadonlySet<string>, limit = 20): Promise<WorkItem[]> {
  if (!canRead.has("ToDo")) return [];
  const rows = await getList("ToDo", {
    fields: ["name", "description", "reference_type", "reference_name", "date", "priority", "assigned_by_full_name", "modified"],
    filters: [["allocated_to", "=", user], ["status", "=", "Open"]],
    order_by: "modified desc",
    limit_page_length: limit,
  });
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const ref = !!(r.reference_type && r.reference_name);
    const doctype = ref ? String(r.reference_type) : "ToDo";
    const name = ref ? String(r.reference_name) : String(r.name);
    const desc = stripHtml(r.description);
    const by = r.assigned_by_full_name ? `Assigned by ${String(r.assigned_by_full_name)}` : "Assigned to you";
    const date = typeof r.date === "string" ? r.date : "";
    return {
      key: `todo:${r.name}`,
      kind: "assignment",
      doctype,
      name,
      title: ref ? name : desc || name,
      href: docHref(doctype, name),
      status: r.priority === "High" ? "High priority" : "Assigned",
      detail: [ref && desc ? desc : by, date ? `due ${date.split("-").reverse().join("-")}` : ""].filter(Boolean).join(" · "),
      at: parseFrappeDate(r.modified),
      overdue: !!date && date < today,
    } satisfies WorkItem;
  });
}

/** title field the list query can ask for (a real column, not the name) */
async function titleField(doctype: string): Promise<{ title?: string; submittable: boolean }> {
  try {
    const meta = await fetchDoctypeMetaClient(doctype);
    const tf = typeof meta.title_field === "string" ? meta.title_field : "";
    const field = tf && tf !== "name" ? meta.fields?.find((f) => f.fieldname === tf && !f.is_virtual) : undefined;
    return { title: field ? tf : undefined, submittable: !!meta.is_submittable };
  } catch {
    return { submittable: false };
  }
}

export interface MyDocs {
  drafts: WorkItem[];
  edited: WorkItem[];
}

/** One get_list per doctype: rows the user created or last changed, newest first. */
export async function fetchMyDocs(user: string, doctypes: string[], perDoctype = 6): Promise<MyDocs> {
  const results = await Promise.all(
    doctypes.map(async (doctype) => {
      const { title, submittable } = await titleField(doctype);
      try {
        const rows = await getList(doctype, {
          fields: ["name", "docstatus", "owner", "modified_by", "modified", ...(title ? [title] : [])],
          or_filters: [["owner", "=", user], ["modified_by", "=", user]],
          order_by: "modified desc",
          limit_page_length: perDoctype,
        });
        return { doctype, rows, title, submittable };
      } catch {
        return { doctype, rows: [] as Row[], title, submittable };
      }
    }),
  );
  const drafts: WorkItem[] = [];
  const edited: WorkItem[] = [];
  for (const { doctype, rows, title, submittable } of results) {
    for (const r of rows) {
      const name = String(r.name);
      const base = {
        doctype,
        name,
        title: (title && r[title] ? stripHtml(r[title]) : "") || name,
        href: docHref(doctype, name),
        at: parseFrappeDate(r.modified),
      };
      // a draft only means something on submittable doctypes (everything else is always docstatus 0)
      if (submittable && Number(r.docstatus) === 0 && r.owner === user) drafts.push({ ...base, key: `draft:${doctype}:${name}`, kind: "draft", status: "Draft" });
      if (r.modified_by === user) edited.push({ ...base, key: `edit:${doctype}:${name}`, kind: "edited", detail: "Edited" });
    }
  }
  return { drafts, edited };
}

interface DesktopShortcut {
  label?: string;
  type?: string;
  link_to?: string;
  url?: string;
  doc_view?: string;
}

/** The workspace whose shortcuts are "pinned" for this user: their private one, else the first in the sidebar. */
export function pickWorkspace(pages: WorkspaceSidebarItem[], user: string): WorkspaceSidebarItem | undefined {
  return pages.find((p) => p.for_user === user) ?? pages.find((p) => !p.parent_page && (p.public === 1 || p.public === true));
}

export async function fetchWorkspacePages(): Promise<WorkspaceSidebarItem[]> {
  const res = await fetch("/api/workspaces", { credentials: "include" });
  if (!res.ok) return [];
  return ((await res.json()) as { pages?: WorkspaceSidebarItem[] }).pages ?? [];
}

export async function fetchShortcuts(page: WorkspaceSidebarItem): Promise<Shortcut[]> {
  const res = await frappeMethod<{ shortcuts?: { items?: DesktopShortcut[] } }>("frappe.desk.desktop.get_desktop_page", {
    page: JSON.stringify({ name: page.name, title: page.title ?? page.name, public: page.public ? 1 : 0 }),
  });
  const out: Shortcut[] = [];
  for (const s of res?.shortcuts?.items ?? []) {
    const type = String(s.type ?? "");
    const href =
      type === "DocType" && s.doc_view === "New"
        ? `${doctypeUrl(s.link_to ?? "")}/new`
        : sidebarItemHref({ link_type: type as never, link_to: s.link_to ?? null, url: s.url ?? null });
    if (!href) continue;
    out.push({ key: `${type}:${s.link_to ?? s.url}:${s.label}`, label: s.label || s.link_to || href, href, external: /^https?:/.test(href), type, doctype: type === "DocType" ? s.link_to : undefined });
  }
  return out;
}
