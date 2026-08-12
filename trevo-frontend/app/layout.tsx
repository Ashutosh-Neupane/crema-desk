import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import Providers from "./providers";
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
    default: "Trevo",
    template: "%s | Trevo",
  },
  description: "Modern frontend for Trevo, built on Frappe",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
