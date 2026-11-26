/**
 * What a Desk URL can name for one session, read from the Desk boot (Desk router.setup / desk.setup_workspaces):
 * readable doctypes, workspace pages and module sidebars (shells). Server-only (reads the boot through the backend).
 */
import { getDeskBoot, type DeskBoot } from "@/lib/frappe/deskBoot";
import { sidFromCookie } from "@/lib/frappe/server";
import type { DeskRouteRegistry } from "@/lib/navigation/deskRoute";

export function registryFromBoot(boot: DeskBoot): DeskRouteRegistry {
  const user = (boot.user ?? {}) as { can_read?: string[] };
  const pages = ((boot.workspaces as { pages?: Array<{ name: string }> } | undefined)?.pages ?? []).map((p) => p.name);
  return { doctypes: user.can_read ?? [], workspaces: pages, shells: Object.keys(boot.module_sidebars ?? {}) };
}

// Small per-session copy for the request proxy, which resolves every Desk URL: the boot itself is re-read every 30 s
// and is the whole /desk page, so the proxy keeps only the names, for longer, and refreshes on a miss.
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; reg: DeskRouteRegistry }>();

export async function deskRegistry(cookieHeader: string, fresh = false): Promise<DeskRouteRegistry | null> {
  const sid = sidFromCookie(cookieHeader);
  if (!sid) return null;
  const hit = cache.get(sid);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.reg;
  const boot = await getDeskBoot(cookieHeader, fresh);
  if (!boot) return null;
  const reg = registryFromBoot(boot);
  cache.set(sid, { at: Date.now(), reg });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return reg;
}
