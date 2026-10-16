/**
 * Workspace fetching — sidebar items + individual workspace data.
 * Server-side functions wrapped in React.cache() so multiple Server Components
 * in the same request share one result (no duplicate backend calls per SSR pass).
 */
import { cache } from "react";
import type { WorkspaceData, WorkspaceSidebarItem, WorkspaceSidebarResponse } from "./types";
import { frappeServerFetch, getCookieHeader } from "./server";
import { frappeGet, frappeMethod } from "./client";

// ---------------------------------------------------------------------------
// Server-side
// ---------------------------------------------------------------------------

export const fetchWorkspaceSidebarServer = cache(async (): Promise<WorkspaceSidebarItem[]> => {
  const cookie = await getCookieHeader();
  const { data } = await frappeServerFetch<WorkspaceSidebarResponse>(
    cookie,
    "api/method/frappe.desk.desktop.get_workspace_sidebar_items",
  );
  // The REAL response uses `pages` key, NOT `workspaces` (verified on :8080)
  const pages = (data as WorkspaceSidebarResponse | null)?.pages ?? [];
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
  const resp = await frappeMethod<WorkspaceSidebarResponse>(
    "frappe.desk.desktop.get_workspace_sidebar_items",
  );
  const pages = resp?.pages ?? [];
  return pages.filter((p) => !(p.is_hidden === true || p.is_hidden === 1));
}

export async function fetchWorkspaceDataClient(name: string): Promise<WorkspaceData> {
  const data = await frappeGet<WorkspaceData>(`Workspace/${encodeURIComponent(name)}`);
  if (!data) throw new Error(`Workspace "${name}" not found`);
  return data;
}
