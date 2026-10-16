/**
 * Backend version detection and v16→v17 compatibility layer.
 *
 * Frappe v17 introduces:
 *  - Socket.io client v5 (from v4). Frappe frontend in v17 uses socket.io-client@4,
 *    but the server protocol is still v4-compatible. We explicitly pin v4 here.
 *  - Boot info schema changes: `sysdefaults` includes `developer_mode`, `allow_cors`, etc.
 *  - Some `/api/method/` routes may be renamed or removed.
 *
 * This module:
 *  1. Fetches the backend version at runtime.
 *  2. Exposes `getBackendVersion()` for consumers.
 *  3. Provides `useV17Compat()` flags so components can adapt.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackendVersion {
  /** e.g. "16.0.0" or "17.0.0" */
  frappe_version: string;
  /** e.g. "v16.74.1" */
  version: string;
  /** e.g. ["erpnext", "hrms"] */
  installed_apps: string[];
}

export interface VersionCompatibility {
  /** True when backend is v17+ */
  is_v17: boolean;
  /** True when backend is v16.x */
  is_v16: boolean;
  /** Frappe frontend in v17 still uses socket.io v4 protocol */
  socket_io_protocol: "v4" | "v5";
  /** v17 changed some API paths; when true, use legacy paths */
  use_legacy_api_paths: boolean;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

let cachedVersion: BackendVersion | null = null;

// ---------------------------------------------------------------------------
// Version fetch
// ---------------------------------------------------------------------------

/**
 * Try multiple whitelisted methods to get backend version info.
 * Falls back gracefully if none are available.
 */
export async function getBackendVersion(cookieHeader?: string): Promise<BackendVersion> {
  if (cachedVersion) return cachedVersion;

  // Strategy 1: frappe.versions.get_versions (available in v15+)
  try {
    const { frappeServerFetch, getCookieHeader } = await import("./server");
    const cookie = cookieHeader ?? (await getCookieHeader());
    const result = await frappeServerFetch<Record<string, string> | Array<{ name: string }>>(
      cookie,
      "api/method/frappe.versions.get_versions",
    );
    if (result.data) {
      const data = result.data as Record<string, string>;
      const apps = Object.keys(data).filter((k) => k !== "frappe");
      cachedVersion = {
        frappe_version: data.frappe ?? "16.0.0",
        version: data.frappe ?? "16.0.0",
        installed_apps: apps,
      };
      return cachedVersion;
    }
  } catch {
    // Method not available
  }

  // Strategy 2: frappe.boot via generic proxy (if whitelisted)
  try {
    const { frappeServerFetch, getCookieHeader } = await import("./server");
    const cookie = cookieHeader ?? (await getCookieHeader());
    const result = await frappeServerFetch<{ version?: string; frappe_version?: string }>(
      cookie,
      "api/method/frappe.boot",
    );
    if (result.data && (result.data.version || result.data.frappe_version)) {
      cachedVersion = {
        frappe_version: result.data.frappe_version ?? result.data.version ?? "16.0.0",
        version: result.data.version ?? result.data.frappe_version ?? "16.0.0",
        installed_apps: [],
      };
      return cachedVersion;
    }
  } catch {
    // Not available
  }

  // Fallback: assume v16 (current backend is v16)
  cachedVersion = {
    frappe_version: "16.0.0",
    version: "16.0.0",
    installed_apps: [],
  };
  return cachedVersion;
}

// ---------------------------------------------------------------------------
// Compatibility helpers
// ---------------------------------------------------------------------------

export function getVersionCompatibility(version: BackendVersion): VersionCompatibility {
  const major = parseInt(version.frappe_version.split(".")[0] ?? "16", 10);
  const is_v17 = major >= 17;
  const is_v16 = major === 16;

  return {
    is_v17,
    is_v16,
    // Frappe v17 frontend still ships socket.io-client@4.x
    // Server protocol remains compatible with v4 clients.
    socket_io_protocol: "v4",
    // Keep legacy API paths for v16; v17 may deprecate some
    use_legacy_api_paths: !is_v17,
  };
}

export function isV17Compatible(compat: VersionCompatibility): boolean {
  return compat.is_v17 || compat.is_v16;
}

/**
 * Normalize a version string "17.0.0" → major number 17
 */
export function getMajorVersion(versionString: string): number {
  return parseInt(versionString.split(".")[0] ?? "16", 10);
}
