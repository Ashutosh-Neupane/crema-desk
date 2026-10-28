"use client";

/**
 * Print Format Builder host (docs/GAPS.md § 2.19 A): Desk's v16 builder (`print_format_builder_beta`, or the classic
 * one) framed full screen with one slim header, Crema's theme, and CSS fixes for what users trip over:
 *  - with a preview record Desk hides every section toolbar (`.section--preview .section-toolbar`), so an emptied
 *    section has no remove button; the selected section keeps its toolbar here
 *  - the letter head zone can't be deleted (it isn't a section); selecting it says where it comes from
 */
import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import LegacyPage from "@/components/views/LegacyPage";
import { useUIStore } from "@/lib/stores/ui.store";

const FRAME_CSS = `
.print-format-section-container.section--preview.pfb-section-active .section-toolbar { display: flex !important; }
.lh-zone--selected::after {
  content: "This block comes from the Letter Head. To remove it, set Letter head to None in the page settings (click the empty canvas); to change it, edit the Letter Head.";
  display: block; margin-top: 6px; padding: 6px 8px; border-radius: 6px;
  font-size: 12px; line-height: 1.4; color: var(--text-muted); background: var(--subtle-accent);
}
`;

export default function PrintFormatBuilderHost({ name, classic }: { name: string; classic?: boolean }) {
  // Desk folds its sidebar for the builder; do the same with Crema's and restore it on the way out
  useEffect(() => {
    const ui = useUIStore.getState();
    const was = ui.sidebarOpen;
    ui.setSidebarOpen(false);
    return () => useUIStore.getState().setSidebarOpen(was);
  }, []);

  const route = `${classic ? "print-format-builder" : "print-format-builder-beta"}/${encodeURIComponent(name)}`;
  const formHref = `/desk/doctype/Print%20Format/${encodeURIComponent(name)}`;
  return (
    <div className="-mx-gutter -my-stack">
      <LegacyPage
        route={route}
        frameCss={FRAME_CSS}
        header={
          <div className="flex items-center gap-3 border-b border-zinc-200 px-gutter py-2 dark:border-zinc-800">
            <Link href={formHref} aria-label={`Back to ${name}`} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="font-normal text-zinc-500">Print Format Builder ·</span> {name}
            </h1>
            <a href={`/app/${route}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline dark:text-zinc-300">
              Open in Desk <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>
        }
      />
    </div>
  );
}
