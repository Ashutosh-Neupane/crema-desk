"use client";

/**
 * Workspace "Custom Block" (Desk: widgets/custom_block_widget.js + frappe.create_shadow_element in dom.js).
 * The Custom HTML Block's html (scripts/styles/links stripped, as frappe.dom.remove_script_and_style does) and style
 * are rendered inside an open shadow root; its script runs with `root_element` set to that shadow root. The script is
 * site-authored JS with the same trust as in Desk.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface CustomHtmlBlock {
  name: string;
  html?: string | null;
  style?: string | null;
  script?: string | null;
}

/** frappe.dom.remove_script_and_style */
function removeScriptAndStyle(txt: string): string {
  const evil = ["script", "style", "noscript", "title", "meta", "base", "head", "link"];
  if (!txt || !new RegExp(evil.map((t) => `<([\\s]*)${t}`).join("|"), "im").test(txt)) return txt;
  const doc = new DOMParser().parseFromString(txt, "text/html");
  for (const tag of evil) for (const el of Array.from(doc.body.getElementsByTagName(tag))) el.parentNode?.removeChild(el);
  return doc.body.innerHTML;
}

export default function CustomBlock({ name }: { name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const { data: doc } = useQuery<CustomHtmlBlock | null>({
    queryKey: ["custom-html-block", name],
    queryFn: async () => {
      const res = await fetch(`/api/frappe/api/resource/Custom HTML Block/${encodeURIComponent(name)}`, { credentials: "include" });
      return res.ok ? ((await res.json()) as { data: CustomHtmlBlock }).data : null;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const el = host.current;
    if (!el || !doc) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.replaceChildren();
    const div = document.createElement("div");
    div.innerHTML = removeScriptAndStyle(doc.html ?? "");
    const style = document.createElement("style");
    style.textContent = doc.style ?? "";
    root.append(div, style);
    if (doc.script) {
      try {
        // site-authored script, same trust as Desk (frappe.create_shadow_element)
        // eslint-disable-next-line no-new-func
        new Function("root_element", doc.script)(root);
      } catch (e) {
        console.error(`Custom HTML Block "${name}" script failed`, e);
      }
    }
  }, [doc, name]);

  if (doc === null) return null;
  return <div ref={host} data-custom-block={name} className="custom-block-widget-box" />;
}
