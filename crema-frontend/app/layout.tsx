import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Providers from "./providers";
import { UiPrefsProvider } from "@/lib/ui/newLayout";
import { DEFAULT_UI_PREFS } from "@/lib/ui/prefs";
import { parseUiCookie, UI_COOKIE } from "@/lib/ui/prefsCookie";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

/* Frappe desk uses Inter; keep Geist Mono for code/monospace surfaces */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Crema",
    template: "%s | Crema",
  },
  description: "Modern frontend for Crema, built on Frappe",
  metadataBase: appUrl(),
};

/** NEXT_PUBLIC_APP_URL may be misconfigured — fall back rather than crash every page */
function appUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // the user's New layout / density, mirrored in a cookie so this HTML is already in the chosen layout
  const jar = await cookies();
  const prefs = parseUiCookie(jar.get(UI_COOKIE)?.value, jar.get("user_id")?.value) ?? DEFAULT_UI_PREFS;
  return (
    <html lang="en" suppressHydrationWarning data-layout={prefs.newLayout ? "new" : "classic"} data-density={prefs.density}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Preconnect to Frappe backend for faster first API call */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? "http://localhost:8000"}
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
      >
        {/* Skip to main content — first tab stop for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-zinc-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        <ErrorBoundary>
          <UiPrefsProvider initial={prefs}>
            <Providers>{children}</Providers>
          </UiPrefsProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
