/**
 * Boot info assembly.
 *
 * frappe.boot.get_bootinfo is NOT whitelisted on this backend (verified → 403).
 * Instead, our BFF /api/boot route assembles equivalent info from multiple calls:
 *   1. frappe.auth.get_logged_user  →  user email
 *   2. /api/resource/User/:email    →  full user object + roles
 *   3. frappe.apps.get_apps          →  installed apps
 *
 * This is called on desk shell mount and provides everything the sidebar/UI needs.
 *
 * Wrapped in React.cache() so multiple Server Components in the same request
 * share one result (no duplicate backend calls per SSR pass).
 */

import { cache } from "react";
import { frappeServerFetch, getCookieHeader } from "./server";
import { getBackendVersion } from "./version";
import type { FrappeUser, InstalledApp, BootInfo } from "./types";

export const assembleBootInfo = cache(async (cookieHeader?: string): Promise<BootInfo | null> => {
  const cookie = cookieHeader ?? (await getCookieHeader());

  // 1. Get logged user email
  let userEmail: string | null = null;
  try {
    const { data: msg } = await frappeServerFetch<string>(cookie, "api/method/frappe.auth.get_logged_user");
    userEmail = msg ?? null;
  } catch {
    return null; // Not logged in
  }
  if (!userEmail || userEmail === "Guest") return null;

  // 2. Get full user object + 3. Get installed apps in parallel
  let user: Partial<FrappeUser> = { name: userEmail, email: userEmail };
  let installedApps: InstalledApp[] = [];

  try {
    const [userResult, appsResult] = await Promise.all([
      frappeServerFetch<Record<string, unknown>>(
        cookie,
        `api/resource/User/${encodeURIComponent(userEmail)}`,
      ),
      frappeServerFetch<
        Array<{ name: string; title: string; route: string; icon?: string; url?: string }>
      >(cookie, "api/method/frappe.apps.get_apps"),
    ]);

    if (userResult.data) {
      user = {
        ...user,
        full_name: (userResult.data.full_name as string) ?? userEmail,
        user_image: (userResult.data.user_image as string) ?? null,
        first_name: (userResult.data.first_name as string) ?? undefined,
        last_name: (userResult.data.last_name as string) ?? undefined,
        language: (userResult.data.language as string) ?? "en",
      };
      const roles = userResult.data.roles as Array<{ role: string }> | undefined;
      if (Array.isArray(roles)) {
        user.roles = roles.map((r) => r.role);
      }
    }

    if (Array.isArray(appsResult.data)) {
      installedApps = appsResult.data.map((app) => ({
        app_name: app.name,
        app_title: app.title,
        app_version: "",
        app_route: app.route ?? "",
        icon: app.icon ?? "",
        url: app.url ?? "",
      }));
    }
  } catch {
    // Ignore — endpoints may vary
  }

  let backendVersion = "";
  let frappeVersion = "";
  try {
    const versionInfo = await getBackendVersion(cookie);
    backendVersion = versionInfo.version;
    frappeVersion = versionInfo.frappe_version;
  } catch {
    // Version detection is best-effort
  }

  return {
    user: user as FrappeUser,
    installed_apps: installedApps,
    sysdefaults: {}, // Could fetch from System Settings if needed
    lang: user.language ?? "en",
    desk_theme: "Light", // Default; could read from User preference
    notification_count: 0, // Could fetch from notification count API
    backend_version: backendVersion,
    frappe_version: frappeVersion,
  };
});
