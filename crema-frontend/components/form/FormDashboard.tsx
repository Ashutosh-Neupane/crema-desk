"use client";

/**
 * Renders what scripts put on the form dashboard (lib/form/dashboard.ts): headlines above the form (Desk:
 * layout.show_message — coloured, dismissible unless permanent), then a dashboard card with indicators
 * (add_indicator), progress bars (add_progress) and custom sections (add_section — the script's own DOM node).
 */
import { X } from "lucide-react";
import HtmlHost from "@/components/form/HtmlHost";
import { sanitizeHtml } from "@/lib/report/columns";
import type { DashboardState } from "@/lib/form/dashboard";

const HEADLINE: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  yellow: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  orange: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  white: "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
};
// Desk indicator colours (.indicator.green, …)
const DOT: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-amber-400",
  blue: "bg-blue-500",
  "light-blue": "bg-sky-400",
  cyan: "bg-cyan-500",
  purple: "bg-violet-500",
  pink: "bg-pink-500",
  gray: "bg-zinc-400",
  grey: "bg-zinc-400",
  darkgrey: "bg-zinc-600",
};

export function FormHeadlines({ state, extra, onDismiss }: { state: DashboardState; extra?: Array<{ key: string; html: string; color: string }>; onDismiss: (id: number) => void }) {
  const items = [...(extra ?? []).map((e) => ({ id: e.key, html: e.html, color: e.color, permanent: true })), ...state.headlines];
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      {items.map((h) => (
        <div key={h.id} role="status" className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm ${HEADLINE[h.color] ?? HEADLINE.blue}`}>
          {/* site scripts' HTML (Desk renders it as HTML); sanitized */}
          {/* react-doctor-disable-next-line dangerous-html-sink */}
          <div className="min-w-0 flex-1 [&_a]:underline [&_button]:ml-2 [&_button]:underline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(h.html) }} />
          {!h.permanent && typeof h.id === "number" && (
            <button type="button" aria-label="Dismiss message" onClick={() => onDismiss(h.id as number)} className="rounded p-0.5 opacity-60 hover:opacity-100">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FormDashboard({ state }: { state: DashboardState }) {
  const sections = state.sections.filter((s) => !s.hidden);
  if (state.hidden || (!state.indicators.length && !state.progress.length && !sections.length)) return null;
  return (
    <section aria-label="Dashboard" className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {state.progress.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {state.progress.map((p) => (
            <div key={p.title} title={p.title}>
              <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{p.title}</div>
              <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-label={p.title} aria-valuenow={parseFloat(p.bars[0]?.width ?? "0")} aria-valuemin={0} aria-valuemax={100}>
                {p.bars.map((b, i) => (
                  <div key={i} title={b.title} style={{ width: b.width }} className={/danger/.test(b.progress_class ?? "") ? "bg-red-500" : /warning/.test(b.progress_class ?? "") ? "bg-amber-400" : "bg-emerald-500"} />
                ))}
              </div>
              {p.message && <p className="mt-1 text-xs text-zinc-500">{p.message}</p>}
            </div>
          ))}
        </div>
      )}
      {state.indicators.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4" aria-label="Indicators">
          {state.indicators.map((ind) => (
            <li key={ind.id} className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[ind.color] ?? DOT.gray}`} aria-hidden />
              {/* react-doctor-disable-next-line dangerous-html-sink */}
              <span className="truncate" dangerouslySetInnerHTML={{ __html: sanitizeHtml(ind.label) }} />
            </li>
          ))}
        </ul>
      )}
      {sections.map((s) => (
        <details key={s.id} open className="group">
          {s.label && <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">{s.label}</summary>}
          <div className={s.label ? "mt-2" : ""}>
            <HtmlHost el={s.node} />
          </div>
        </details>
      ))}
    </section>
  );
}
