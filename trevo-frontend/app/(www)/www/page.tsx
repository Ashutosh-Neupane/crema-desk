import Link from "next/link";
import type { Metadata } from "next";
import { KNOWN_WWW_PAGES } from "@/lib/frappe/www";

export const metadata: Metadata = { title: "Frappe www pages" };

/** Index of backend-rendered Frappe website (www) pages available in trevo. */
export default function WwwIndexPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Frappe www pages</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        These pages are rendered server-side by the Frappe website module
        (HTML + Jinja templates from <code>frappe/www/</code> and installed
        apps) and mounted inside the trevo frontend.
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {KNOWN_WWW_PAGES.map((page) => (
          <li key={page.path}>
            <Link
              href={`/www/${page.path}`}
              className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {page.label}
              <code className="text-xs text-[var(--text-muted)]">/{page.path}</code>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-[var(--text-muted)]">
        Any backend website route can be opened via{" "}
        <code>/www/&lt;path&gt;</code> — e.g. ERPNext portal pages built with
        HTML/Jinja on the backend are served here as well.
      </p>
    </div>
  );
}
