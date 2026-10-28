import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Minimal shell for backend-rendered Frappe www pages.
 * The page content brings its own Frappe CSS, so we only provide a thin
 * navigation strip back to the crema desk.
 */
export default function WwwLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
      <div className="flex h-10 items-center justify-between border-b border-[var(--border-color)] px-4">
        <Link
          href="/desk"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-color)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Desk
        </Link>
        <span className="text-sm font-semibold">Crema · Frappe www</span>
      </div>
      <main id="main-content" className="www-page-container">
        {children}
      </main>
    </div>
  );
}
