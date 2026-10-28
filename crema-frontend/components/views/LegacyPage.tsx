"use client";

/**
 * Legacy page host, client side (docs/GAPS.md L4). Frames Frappe's own page from /app/<route> (same origin,
 * see app/app/[[...path]]/route.ts), mirrors its title, and turns Form/List/Report navigation inside the page
 * into Crema routes so records open in Crema's native views. The frame follows Crema's light / dark theme.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { cremaUrlForRoute } from "@/lib/navigation/deskRoute";

export { cremaUrlForRoute } from "@/lib/navigation/deskRoute";

/** Copy Crema's `data-theme` onto the framed Desk page (Desk reads the same attribute) and keep following it */
function syncTheme(frame: HTMLIFrameElement | null): () => void {
  const doc = frame?.contentDocument;
  if (!doc) return () => {};
  const apply = () => {
    const theme = document.documentElement.getAttribute("data-theme") ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (doc.documentElement.getAttribute("data-theme") !== theme) doc.documentElement.setAttribute("data-theme", theme);
  };
  apply();
  const parentObs = new MutationObserver(apply);
  parentObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  // Desk sets its own theme from the user's desk_theme on boot; Crema's choice wins
  const frameObs = new MutationObserver(apply);
  frameObs.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    parentObs.disconnect();
    frameObs.disconnect();
  };
}

export default function LegacyPage({
  route,
  header,
  frameCss,
}: {
  route: string;
  /** replaces the default title bar (full-screen tools like the Print Format Builder bring their own) */
  header?: ReactNode;
  /** extra CSS injected into the framed page */
  frameCss?: string;
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [title, setTitle] = useState(route);
  const [loading, setLoading] = useState(true);
  const unsync = useRef<() => void>(() => {});

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const m = e.data as { source?: string; type?: string; route?: string[]; title?: string };
      if (m?.source !== "crema-legacy") return;
      if (m.title) setTitle(m.title.replace(/\s*\|\s*.*$/, ""));
      if (m.type === "navigate" && m.route) {
        const url = cremaUrlForRoute(m.route);
        if (url) router.push(url);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      unsync.current();
    };
  }, [router]);

  const onLoad = () => {
    setLoading(false);
    unsync.current();
    unsync.current = syncTheme(frame.current);
    const doc = frame.current?.contentDocument;
    if (frameCss && doc && !doc.getElementById("crema-frame-css")) {
      const style = doc.createElement("style");
      style.id = "crema-frame-css";
      style.textContent = frameCss;
      doc.head.appendChild(style);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {header ?? (
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <h1 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-label="Loading" />}
          <span className="ml-auto text-xs text-zinc-500">Frappe page</span>
          <a href={`/app/${route}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline dark:text-zinc-300">
            Open full screen <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {loading && header && <Loader2 className="absolute left-1/2 top-1/3 h-5 w-5 -translate-x-1/2 animate-spin text-zinc-400" aria-label="Loading" />}
        <iframe
          ref={frame}
          title={`Frappe page ${route}`}
          src={`/app/${route}`}
          onLoad={onLoad}
          // Frappe's own Desk page: needs scripts, same-origin session/storage, forms, dialogs, downloads
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          className="h-full w-full border-0 bg-[var(--bg-color)]"
        />
      </div>
    </div>
  );
}
