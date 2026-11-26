import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Environment validation — fail loudly at startup rather than silently
// serving a broken app against the wrong backend.
// ---------------------------------------------------------------------------
const frappeUrl = process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? process.env.FRAPPE_BACKEND_URL;
if (!frappeUrl) {
  console.warn(
    "\x1b[33m[crema] WARNING: NEXT_PUBLIC_FRAPPE_BASE_URL is not set.\x1b[0m\n" +
    "        Copy .env.example → .env.local and set the correct Frappe backend URL.\n" +
    "        Default: NEXT_PUBLIC_FRAPPE_BASE_URL=http://localhost:8000",
  );
}
if (frappeUrl?.includes(":8080")) {
  console.error(
    "\x1b[31m[crema] ERROR: NEXT_PUBLIC_FRAPPE_BASE_URL is pointing at port 8080.\x1b[0m\n" +
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

  // Older Crema shortcuts → the Desk URL for the same screen. DocType slugs (/desk/console-log, /desk/print-format …)
  // need no entry: proxy.ts serves every Desk URL in place.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/desk/assignments", "/desk/todo"),
      to("/desk/backups", "/desk/system-settings"),
      to("/desk/calendar", "/desk/event/view/calendar"),
      to("/desk/changelog-feed", "/desk"),
      to("/desk/document-template", "/desk"),
      to("/desk/image", "/desk"),
      to("/desk/map", "/desk"),
      to("/desk/follow", "/desk/document-follow"),
      to("/desk/notes", "/desk/note"),
      to("/desk/permissions", "/desk/permission-manager"),
      to("/desk/roles", "/desk/role"),
      to("/desk/server-scripts", "/desk/server-script"),
      to("/desk/system-health", "/desk/system-health-report"),
      to("/desk/tags", "/desk/tag"),
      to("/desk/tasks", "/desk/todo"),
      to("/desk/users", "/desk/user"),
      to("/desk/web-forms", "/desk/web-form"),
      to("/desk/website-builder", "/desk/web-page"),
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
