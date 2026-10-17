import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Environment validation — fail loudly at startup rather than silently
// serving a broken app against the wrong backend.
// ---------------------------------------------------------------------------
const frappeUrl = process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? process.env.FRAPPE_BACKEND_URL;
if (!frappeUrl) {
  console.warn(
    "\x1b[33m[trevo] WARNING: NEXT_PUBLIC_FRAPPE_BASE_URL is not set.\x1b[0m\n" +
    "        Copy .env.example → .env.local and set the correct Frappe backend URL.\n" +
    "        Default: NEXT_PUBLIC_FRAPPE_BASE_URL=http://localhost:8000",
  );
}
if (frappeUrl?.includes(":8080")) {
  console.error(
    "\x1b[31m[trevo] ERROR: NEXT_PUBLIC_FRAPPE_BASE_URL is pointing at port 8080.\x1b[0m\n" +
    "        Frappe does not listen on :8080. Change it to :8000 in .env.local.",
  );
}

// ---------------------------------------------------------------------------
// Next.js config
// ---------------------------------------------------------------------------
const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // the persistent dev cache grew to ~19 GB and stalled the machine for minutes while flushing;
    // in-memory caching keeps HMR fast, cold starts recompile once
    turbopackFileSystemCacheForDev: false,
  },
  poweredByHeader: false,
  compress: true,

  // Prototype routes that are plain DocType lists/forms in Desk (or not part of Frappe at all)
  async redirects() {
    return [
      { source: "/desk/assignments", destination: "/desk/doctype/ToDo", permanent: false },
      { source: "/desk/backups", destination: "/desk/doctype/System%20Settings/System%20Settings", permanent: false },
      { source: "/desk/calendar", destination: "/desk/doctype/Event/view/calendar", permanent: false },
      { source: "/desk/changelog-feed", destination: "/desk", permanent: false },
      { source: "/desk/console-log", destination: "/desk/doctype/Console%20Log", permanent: false },
      { source: "/desk/custom-html-block", destination: "/desk/doctype/Custom%20HTML%20Block", permanent: false },
      { source: "/desk/dashboard-chart-source", destination: "/desk/doctype/Dashboard%20Chart%20Source", permanent: false },
      { source: "/desk/desktop-icon", destination: "/desk/doctype/Desktop%20Icon", permanent: false },
      { source: "/desk/desktop-layout", destination: "/desk/doctype/Desktop%20Layout", permanent: false },
      { source: "/desk/document-template", destination: "/desk", permanent: false },
      { source: "/desk/follow", destination: "/desk/doctype/Document%20Follow", permanent: false },
      { source: "/desk/global-search-settings", destination: "/desk/doctype/Global%20Search%20Settings/Global%20Search%20Settings", permanent: false },
      { source: "/desk/image", destination: "/desk", permanent: false },
      { source: "/desk/list-view-settings", destination: "/desk/doctype/List%20View%20Settings", permanent: false },
      { source: "/desk/map", destination: "/desk", permanent: false },
      { source: "/desk/notes", destination: "/desk/doctype/Note", permanent: false },
      { source: "/desk/notification-settings", destination: "/desk/doctype/Notification%20Settings", permanent: false },
      { source: "/desk/onboarding-permission", destination: "/desk/doctype/Onboarding%20Permission", permanent: false },
      { source: "/desk/onboarding-step", destination: "/desk/doctype/Onboarding%20Step", permanent: false },
      { source: "/desk/permissions", destination: "/desk/doctype/Role", permanent: false },
      { source: "/desk/print-format", destination: "/desk/doctype/Print%20Format", permanent: false },
      { source: "/desk/roles", destination: "/desk/doctype/Role", permanent: false },
      { source: "/desk/route-history", destination: "/desk/doctype/Route%20History", permanent: false },
      { source: "/desk/server-scripts", destination: "/desk/doctype/Server%20Script", permanent: false },
      { source: "/desk/system-health", destination: "/desk/doctype/System%20Health%20Report/System%20Health%20Report", permanent: false },
      { source: "/desk/tags", destination: "/desk/doctype/Tag", permanent: false },
      { source: "/desk/tasks", destination: "/desk/doctype/ToDo", permanent: false },
      { source: "/desk/users", destination: "/desk/doctype/User", permanent: false },
      { source: "/desk/web-forms", destination: "/desk/doctype/Web%20Form", permanent: false },
      { source: "/desk/website-builder", destination: "/desk/doctype/Web%20Page", permanent: false },
    ];
  },

  // Security: HTTP headers for all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Logging for development observability
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
};

export default nextConfig;
