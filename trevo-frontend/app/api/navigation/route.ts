/**
 * GET /api/navigation
 *
 * Assembles the metadata-driven desk navigation for Trevo:
 *   1. Frappe Workspace sidebar items (get_workspace_sidebar_items)
 *   2. Workspace details (links/shortcuts) for the visible workspaces
 *   3. Module Def records (all installed modules)
 *   4. Installed apps (boot)
 *   5. A "system" section with system doctypes (User, Role, Note, ToDo, ...)
 *
 * This makes the Trevo sidebar dynamic: installing any app in Frappe will
 * automatically surface its workspaces / modules / doctypes here.
 */
import { NextResponse } from "next/server";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { assembleBootInfo } from "@/lib/frappe/boot";
import type { WorkspaceSidebarItem, WorkspaceData } from "@/lib/frappe/types";
import {
  buildNavigationFromWorkspaces,
  SYSTEM_NAV,
  SYSTEM_DOCTYPES,
  type DeskNavigation,
  type NavSection,
  type NavLinkItem,
} from "@/lib/navigation";

interface ModuleDef {
  name: string;
  app_name?: string;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

export async function GET() {
  try {
    const cookie = await getCookieHeader();

    // 1. Workspace sidebar items
    let pages: WorkspaceSidebarItem[] = [];
    try {
      const { data } = await frappeServerFetch<{ pages: WorkspaceSidebarItem[] }>(
        cookie,
        "api/method/frappe.desk.desktop.get_workspace_sidebar_items",
      );
      pages = (data?.pages ?? []).filter((p) => !(p.is_hidden === true || p.is_hidden === 1));
    } catch (err) {
      console.error("[navigation] workspace sidebar failed:", err);
    }

    // 2. Workspace details for the visible roots (max 12 for perf)
    const workspaceDetails: WorkspaceData[] = [];
    const rootPages = pages.filter((p) => !p.parent_page);
    const namesToFetch = rootPages.slice(0, 12).map((p) => p.name);
    if (namesToFetch.length > 0) {
      try {
        const listRes = await frappeServerFetch<WorkspaceData[]>(
          cookie,
          `api/resource/Workspace?filters=${encodeURIComponent(JSON.stringify([["name", "in", namesToFetch]]))}&fields=["name","title","icon","links","shortcuts","charts","number_cards","content"]&limit=20`,
        );
        const raw = Array.isArray(listRes.data) ? listRes.data : [];
        for (const ws of raw) {
          workspaceDetails.push(ws);
        }
      } catch (err) {
        console.error("[navigation] workspace details failed:", err);
      }
    }

    // 3. Modules
    let modules: DeskNavigation["modules"] = [];
    try {
      const { data } = await frappeServerFetch<ModuleDef[]>(
        cookie,
        "api/resource/Module Def?fields=[\"name\",\"app_name\",\"color\",\"icon\"]&limit=200",
      );
      if (Array.isArray(data)) {
        modules = data.map((m) => ({
          name: m.name,
          app: m.app_name ?? "",
          color: m.color ?? "blue",
          icon: m.icon ?? null,
        }));
      }
    } catch (err) {
      console.error("[navigation] modules failed:", err);
    }

    // 4. Boot (apps + user)
    let appsSig: DeskNavigation["apps"] = [];
    try {
      const boot = await assembleBootInfo(cookie);
      if (boot) appsSig = boot.installed_apps ?? [];
    } catch {
      // ignore
    }

    // 5. Build sections from workspaces
    const workspaceSections = buildNavigationFromWorkspaces(pages, workspaceDetails);

    // 6. System section — include only doctypes that exist on the backend
    const systemItems: NavLinkItem[] = [];
    const systemSection: NavSection = { type: "section", id: "system", label: "System", items: [] };
    for (const item of [
      { label: "Settings", doctype: "System Settings", href: "/desk/settings" },
      ...SYSTEM_DOCTYPES.map((d) => ({
        ...d,
        href: d.doctype === "Customize Form"
          ? "/desk/customize-form"
          : d.doctype === "System Settings"
            ? "/desk/settings"
            : `/desk/doctype/${encodeURIComponent(d.doctype)}`,
      })),
    ]) {
      try {
        const { data } = await frappeServerFetch<unknown>(
          cookie,
          `api/resource/${encodeURIComponent(item.doctype)}?limit=1&fields=["name"]`,
        );
        if (data !== null) {
          systemItems.push({ type: "link", label: item.label, href: item.href });
        }
      } catch {
        // Skip doctypes that don't exist
      }
    }
    systemSection.items = systemItems;
    if (systemItems.length > 0) {
      workspaceSections.push(systemSection);
    }

    // 7. Append developer/tools sections (static curated, but system-aware)
    const devSection: NavSection = SYSTEM_NAV.find((s) => s.id === "developer") ?? {
      type: "section",
      id: "developer",
      label: "Developer",
      items: [],
    };
    const toolsSection: NavSection = SYSTEM_NAV.find((s) => s.id === "tools") ?? {
      type: "section",
      id: "tools",
      label: "Tools",
      items: [],
    };
    workspaceSections.push(devSection, toolsSection);

    const navigation: DeskNavigation = {
      sections: workspaceSections,
      apps: appsSig,
      modules,
    };

    return NextResponse.json(navigation);
  } catch (err) {
    console.error("[navigation] assembly error:", err);
    return NextResponse.json(
      { sections: SYSTEM_NAV, apps: [], modules: [] },
      { status: 200 },
    );
  }
}

