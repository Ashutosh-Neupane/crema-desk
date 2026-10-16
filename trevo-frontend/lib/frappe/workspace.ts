/**
 * Workspace fetching — sidebar items + individual workspace data.
 * Server-side functions wrapped in React.cache() so multiple Server Components
 * in the same request share one result (no duplicate backend calls per SSR pass).
 */
import { cache } from "react";
import type { WorkspaceData, WorkspaceSidebarItem, WorkspaceSidebarResponse } from "./types";
import { frappeServerFetch, getCookieHeader } from "./server";
import { getDeskBoot } from "./deskBoot";
import { frappeGet } from "./client";

// ---------------------------------------------------------------------------
// Server-side
// ---------------------------------------------------------------------------

export const fetchWorkspaceSidebarServer = cache(async (): Promise<WorkspaceSidebarItem[]> => {
  const cookie = await getCookieHeader();
  // v16: workspaces arrive in the desk boot; v15: get_workspace_sidebar_items
  const boot = await getDeskBoot(cookie);
  let pages = (boot?.workspaces as WorkspaceSidebarResponse | undefined)?.pages;
  if (!pages) {
    const { data } = await frappeServerFetch<WorkspaceSidebarResponse>(
      cookie,
      "api/method/frappe.desk.desktop.get_workspace_sidebar_items",
    );
    pages = (data as WorkspaceSidebarResponse | null)?.pages ?? [];
  }
  return pages.filter((p) => !(p.is_hidden === true || p.is_hidden === 1));
});

export const fetchWorkspaceDataServer = cache(async (name: string): Promise<WorkspaceData> => {
  const cookie = await getCookieHeader();
  const { data } = await frappeServerFetch<WorkspaceData>(
    cookie,
    `api/resource/Workspace/${encodeURIComponent(name)}`,
  );
  if (!data) throw new Error(`Workspace "${name}" not found`);
  return data;
});

// ---------------------------------------------------------------------------
// Client-side
// ---------------------------------------------------------------------------

export async function fetchWorkspaceSidebarClient(): Promise<WorkspaceSidebarItem[]> {
  const res = await fetch("/api/workspaces", { credentials: "include" });
  const json = (await res.json().catch(() => null)) as WorkspaceSidebarResponse | null;
  return json?.pages ?? [];
}

export async function fetchWorkspaceDataClient(name: string): Promise<WorkspaceData> {
  const data = await frappeGet<WorkspaceData>(`Workspace/${encodeURIComponent(name)}`);
  if (!data) throw new Error(`Workspace "${name}" not found`);
  return data;
}
