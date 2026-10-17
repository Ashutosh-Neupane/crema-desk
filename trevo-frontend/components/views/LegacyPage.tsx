"use client";

/**
 * Legacy page host, client side (docs/GAPS.md L4). Frames Frappe's own page from /app/<route> (same origin,
 * see app/app/[[...path]]/route.ts), mirrors its title, and turns Form/List/Report navigation inside the page
 * into Trevo routes so records open in Trevo's native views.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";

const enc = encodeURIComponent;

/** Desk route array → Trevo URL */
export function trevoUrlForRoute(route: string[]): string | null {
  const [kind, a, b] = route;
  if (kind === "Form" && a) return b ? `/desk/doctype/${enc(a)}/${enc(b)}` : `/desk/doctype/${enc(a)}/new`;
  if (kind === "List" && a) return b === "Report" ? `/desk/doctype/${enc(a)}/view/report` : `/desk/doctype/${enc(a)}`;
  if (kind === "Tree" && a) return `/desk/doctype/${enc(a)}/view/tree`;
  if (kind === "query-report" && a) return `/desk/query-report/${enc(a)}`;
  return null;
}

export default function LegacyPage({ route }: { route: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [title, setTitle] = useState(route);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { source?: string; type?: string; route?: string[]; title?: string };
      if (m?.source !== "trevo-legacy") return;
      if (m.title) setTitle(m.title.replace(/\s*\|\s*.*$/, ""));
      if (m.type === "navigate" && m.route) {
        const url = trevoUrlForRoute(m.route);
        if (url) router.push(url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h1 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Loading" />}
        <span className="ml-auto text-xs text-zinc-500">Frappe page</span>
        <a href={`/app/${route}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline dark:text-zinc-300">
          Open full screen <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
      <iframe
        ref={frame}
        title={`Frappe page ${route}`}
        src={`/app/${route}`}
        onLoad={() => setLoading(false)}
        // Frappe's own Desk page: needs scripts, same-origin session/storage, forms, dialogs, downloads
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
