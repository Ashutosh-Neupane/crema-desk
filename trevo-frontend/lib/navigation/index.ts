/**
 * Metadata-driven navigation.
 *
 * This service builds the desk sidebar from Frappe backend metadata instead of a
 * hard-coded array. That way, when you install any new app in Frappe (ERPNext,
 * HRMS, custom apps), its workspaces/modules automatically appear in the Trevo
 * sidebar — exactly like Frappe's own desk.
 *
 * Data sources (all fetched server-side through the BFF):
 *   1. frappe.desk.desktop.get_workspace_sidebar_items → desk sidebar tree
 *   2. api/resource/Module Def → all modules with app/color/icon
 *   3. Installed apps (via /api/boot) → app grouping
 *   4. A curated "system" section — system doctypes that exist in any install
 *      (User, Role, Note, ToDo, Server Script, etc.), checked against the
 *      live Meta via /api/resource/:doctype count.
 */

import type {
  WorkspaceSidebarItem,
  WorkspaceData,
  InstalledApp,
} from "@/lib/frappe/types";

export interface NavLinkItem {
  type: "link";
  label: string;
  href: string;
  icon?: string | null;
  color?: string;
  query?: string;
}

export interface NavSection {
  type: "section";
  id: string;
  label: string;
  href?: string;
  icon?: string | null;
  color?: string;
  app?: string;
  items: Array<NavLinkItem | NavSection>;
}

export interface DeskNavigation {
  sections: NavSection[];
  apps: InstalledApp[];
  modules: Array<{ name: string; app: string; color: string; icon: string | null }>;
}

/** Convert a Frappe Workspace sidebar page into a NavSection (workspaces ARE sections/groups). */
function workspaceToSection(page: WorkspaceSidebarItem): NavSection {
  return {
    type: "section",
    id: page.name,
    label: page.title ?? page.name,
    href: `/desk/workspace/${encodeURIComponent(page.name)}`,
    icon: page.icon,
    color: page.indicator_color ?? "gray",
    app: (page as { app?: string }).app,
    items: [],
  };
}

/** Merge workspace sidebar items flat list into a hierarchy respecting parent_page. */
export function buildNavigationFromWorkspaces(
  pages: WorkspaceSidebarItem[],
  workspaceDetails: WorkspaceData[],
): NavSection[] {
  // index workspace details by name
  const detailMap = new Map(workspaceDetails.map((w) => [w.name, w]));

  const rootPages = pages.filter((p) => !p.parent_page);
  const childPages = pages.filter((p) => !!p.parent_page);

  const toLinkItems = (links: WorkspaceData["links"] = []): NavLinkItem[] =>
    links
      .filter((l) => !(l.hidden === true || l.hidden === 1))
      .map((l) => {
        const target = l.link_to ?? "";
        const linkType = (l.type ?? l.link_type ?? (l.is_query_report ? "Report" : "DocType")) as string;
        if (linkType === "Report" || linkType === "Page" || l.is_query_report) {
          return {
            type: "link",
            label: l.label ?? target,
            href: linkType === "Page" ? `/desk/page/${encodeURIComponent(target)}` : `/desk/query-report/${encodeURIComponent(target)}`,
            icon: l.icon,
            color: l.color,
          };
        }
        if (linkType === "Dashboard") {
          return {
            type: "link",
            label: l.label ?? target,
            href: `/desk/workspace?dashboard=${encodeURIComponent(target)}`,
            icon: l.icon,
            color: l.color,
          };
        }
        if (linkType === "URL") {
          return { type: "link", label: l.label ?? target, href: target, icon: l.icon };
        }
        // DocType and everything else
        return {
          type: "link",
          label: l.label ?? target,
          href: `/desk/doctype/${encodeURIComponent(target)}`,
          icon: l.icon,
          color: l.color,
        };
      });

  return rootPages.map((page) => {
    const detail = detailMap.get(page.name);
    const section = workspaceToSection(page);

    // Deep links from workspace content
    const links = toLinkItems(detail?.links ?? []);
    if (links.length > 0) section.items = links;

    // Nested child pages (sub-workspaces)
    const children = childPages
      .filter((c) => c.parent_page === page.name)
      .map((c) => workspaceToSection(c));
    section.items = [...section.items, ...children];

    return section;
  });
}

export const SYSTEM_NAV: NavSection[] = [
  {
    type: "section",
    id: "system",
    label: "System",
    items: [
      { type: "link", label: "Users", href: "/desk/users" },
      { type: "link", label: "Roles", href: "/desk/roles" },
      { type: "link", label: "Permissions", href: "/desk/page/permission-manager" },
      { type: "link", label: "Notes", href: "/desk/notes" },
      { type: "link", label: "Assignments", href: "/desk/assignments" },
      { type: "link", label: "Profile", href: "/desk/profile" },
      { type: "link", label: "Update Password", href: "/desk/update-password" },
      { type: "link", label: "System Health", href: "/desk/system-health" },
      { type: "link", label: "Route History", href: "/desk/route-history" },
      { type: "link", label: "Console Logs", href: "/desk/console-log" },
      { type: "link", label: "Changelog Feed", href: "/desk/changelog-feed" },
      { type: "link", label: "Document Templates", href: "/desk/document-template" },
      { type: "link", label: "Desktop Icons", href: "/desk/desktop-icon" },
      { type: "link", label: "Desktop Layout", href: "/desk/desktop-layout" },
      { type: "link", label: "Custom HTML Blocks", href: "/desk/custom-html-block" },
      { type: "link", label: "Dashboard Chart Sources", href: "/desk/dashboard-chart-source" },
    ],
  },
  {
    type: "section",
    id: "developer",
    label: "Developer",
    items: [
      { type: "link", label: "DocTypes", href: "/desk/doctype" },
      { type: "link", label: "Form Builder", href: "/desk/doctype", query: "builder" },
      { type: "link", label: "Server Scripts", href: "/desk/server-scripts" },
      { type: "link", label: "Translations", href: "/desk/translations" },
      { type: "link", label: "System Console", href: "/desk/system-console" },
      { type: "link", label: "Module Manager", href: "/desk/modules" },
      { type: "link", label: "Print Format Builder", href: "/desk/print-format" },
      { type: "link", label: "Workflow Builder", href: "/desk/workflow-builder" },
      { type: "link", label: "Web Forms", href: "/desk/web-forms" },
      { type: "link", label: "Website Builder", href: "/desk/website-builder" },
      { type: "link", label: "Onboarding", href: "/desk/onboarding" },
      { type: "link", label: "Module Onboarding", href: "/desk/module-onboarding" },
    ],
  },
  {
    type: "section",
    id: "tools",
    label: "Tools",
    items: [
      { type: "link", label: "Files", href: "/desk/files" },
      { type: "link", label: "Inbox", href: "/desk/inbox" },
      { type: "link", label: "Calendar", href: "/desk/calendar" },
      { type: "link", label: "Reports", href: "/desk/reports" },
      { type: "link", label: "Tags", href: "/desk/tags" },
    ],
  },
  {
    type: "section",
    id: "settings",
    label: "Settings",
    items: [
      { type: "link", label: "List View Settings", href: "/desk/list-view-settings" },
      { type: "link", label: "Settings", href: "/desk/settings" },
      { type: "link", label: "Notification Settings", href: "/desk/notification-settings" },
      { type: "link", label: "Global Search Settings", href: "/desk/global-search-settings" },
      { type: "link", label: "Dashboard Settings", href: "/desk/dashboard-settings" },
    ],
  },
];

export const SYSTEM_DOCTYPES: Array<{ label: string; doctype: string }> = [
  { label: "Users", doctype: "User" },
  { label: "Roles", doctype: "Role" },
  { label: "Notes", doctype: "Note" },
  { label: "ToDo / Assignments", doctype: "ToDo" },
  { label: "System Settings", doctype: "System Settings" },
  { label: "Customize Form", doctype: "Customize Form" },
  { label: "Roles & Profiles", doctype: "Role Profile" },
  { label: "Server Scripts", doctype: "Server Script" },
  { label: "Translations", doctype: "Translation" },
  { label: "Backups", doctype: "Backup" },
];


// ---------------------------------------------------------------------------
// Frappe v16: module sidebars from the desk boot payload
// ---------------------------------------------------------------------------

import type { DeskBoot, SidebarItem } from "@/lib/frappe/deskBoot";

/** Trevo route for a v16 sidebar/dock link. */
export function sidebarItemHref(item: Pick<SidebarItem, "link_type" | "link_to" | "url">): string | null {
  const to = item.link_to ?? "";
  switch (item.link_type) {
    case "DocType":
      return `/desk/doctype/${encodeURIComponent(to)}`;
    case "Report":
      return `/desk/query-report/${encodeURIComponent(to)}`;
    case "Workspace":
      return `/desk/workspace/${encodeURIComponent(to)}`;
    case "Dashboard":
      return `/desk/dashboard/${encodeURIComponent(to)}`;
    case "Page":
      return `/desk/page/${encodeURIComponent(to)}`;
    case "URL":
      return item.url ?? null;
    default:
      return item.url ?? null;
  }
}

/**
 * One NavSection per module sidebar (Accounts, Selling, Stock, …) in the app's
 * dock order, with Section Breaks becoming nested groups — the same tree
 * Desk's sidebar renders.
 */
export function buildNavigationFromBoot(boot: DeskBoot): NavSection[] {
  const sidebars = boot.module_sidebars ?? {};
  const ordered: string[] = [];
  const placed = new Set<string>();
  for (const app of boot.app_data ?? []) {
    for (const d of app.dock ?? []) {
      if (d.link_type === "Sidebar" && sidebars[d.link_to] && !placed.has(d.link_to)) {
        placed.add(d.link_to);
        ordered.push(d.link_to);
      }
    }
  }
  // Sidebars not placed in any dock (e.g. a custom app's module) still show, after the docked ones
  for (const name of Object.keys(sidebars)) if (!placed.has(name)) ordered.push(name);

  return ordered.map((name) => {
    const sb = sidebars[name];
    const home = sb.items.find((i) => i.link_type === "Workspace" && i.type === "Link");
    const section: NavSection = {
      type: "section",
      id: `module:${sb.name}`,
      label: sb.label || sb.name,
      href: home ? sidebarItemHref(home) ?? undefined : undefined,
      icon: sb.header_icon ?? null,
      app: sb.app,
      items: [],
    };
    let group: NavSection | null = null;
    sb.items.forEach((it, idx) => {
      if (it.type === "Section Break") {
        group = { type: "section", id: `${section.id}:${idx}`, label: it.label, icon: it.icon ?? null, items: [] };
        section.items.push(group);
        return;
      }
      const href = sidebarItemHref(it);
      if (!href) return;
      const link: NavLinkItem = { type: "link", label: it.label, href, icon: it.icon ?? null };
      // `child` marks items that belong under the preceding Section Break
      if (group && it.child) group.items.push(link);
      else {
        group = null;
        section.items.push(link);
      }
    });
    return section;
  });
}
