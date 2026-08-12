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
  poweredByHeader: false,
  compress: true,

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
