"use client";

/**
 * Mounts the DOM node behind an HTML field (FormController.htmlWrapper) into the form. Site scripts write into
 * that node with real jQuery (frm.fields_dict.x.$wrapper.html(...)); the field's `options` HTML is the initial
 * content and is re-applied when a script changes it via set_df_property(f, "options", html), like Desk.
 */
import { useEffect, useRef } from "react";

// the node is owned imperatively (scripts write into it), so mutations live outside React's render model
function attach(host: HTMLElement, node: HTMLElement) {
  host.appendChild(node);
  return () => {
    if (node.parentNode === host) host.removeChild(node);
  };
}
function fill(node: HTMLElement, html: string | null | undefined, first: boolean) {
  if (first ? !node.innerHTML && html : true) node.innerHTML = html ?? "";
}

export default function HtmlHost({ el, html }: { el: HTMLDivElement | null; html?: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const applied = useRef<{ html: string | null | undefined } | null>(null);

  useEffect(() => (host.current && el ? attach(host.current, el) : undefined), [el]);

  useEffect(() => {
    if (!el) return;
    // first render: only fill an empty node (a script may already have drawn into it); later: options changed
    if (!applied.current || applied.current.html !== html) fill(el, html, !applied.current);
    applied.current = { html };
  }, [el, html]);

  return <div ref={host} className="prose prose-sm max-w-none text-zinc-700 dark:prose-invert dark:text-zinc-300" />;
}
