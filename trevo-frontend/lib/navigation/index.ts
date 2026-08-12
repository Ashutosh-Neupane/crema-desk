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
            href: `/desk/reports?report=${encodeURIComponent(target)}`,
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
    items: [],
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
      { type: "link", label: "Onboarding", href: "/desk/onboarding" },
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
      { type: "link", label: "Map", href: "/desk/map" },
      { type: "link", label: "Image View", href: "/desk/image" },
      { type: "link", label: "Tags", href: "/desk/tags" },
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
];

