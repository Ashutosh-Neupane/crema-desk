/**
 * frappe.markdown (frappe/public/js/frappe/utils/tools.js): showdown 2.1.0 — the version Frappe pins — with tables and
 * CommonMark-style nested-list indents, leading blank lines / shared indent trimmed, then Desk's whitelist sanitizer
 * (showdown does not sanitize). Used by the Markdown Editor preview and by app scripts (frappe.markdown).
 */
import showdown from "showdown";

const ALLOWED = new Set(["p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "em", "strong", "del", "b", "i", "a", "img", "table", "thead", "tbody", "tr", "th", "td"]);
const SAFE_URL = /^(https?:|mailto:|tel:|#|\/(?!\/))/i;
const SAFE_IMG_SRC = /^(https?:|\/(?!\/)|data:image\/)/i;
const SAFE_ALIGN = /^text-align:\s*(left|right|center|justify);?$/i;

/** tools.js sanitize_markdown_html */
export function sanitizeMarkdownHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]+>/g, "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  (function walk(node: Element) {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      walk(el);
      if (!ALLOWED.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const keep =
          name === "title" ||
          name === "alt" ||
          (tag === "a" && name === "href" && SAFE_URL.test(attr.value)) ||
          (tag === "img" && name === "src" && SAFE_IMG_SRC.test(attr.value)) ||
          ((tag === "code" || tag === "pre") && name === "class") ||
          ((tag === "th" || tag === "td") && name === "style" && SAFE_ALIGN.test(attr.value));
        if (!keep) el.removeAttribute(attr.name);
      }
      if (tag === "a") {
        const href = el.getAttribute("href") || "";
        if (href && !href.startsWith("#")) {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      }
    }
  })(doc.body);
  return doc.body.innerHTML;
}

let converter: showdown.Converter | null = null;

export function markdownToHtml(txt: unknown): string {
  converter ??= new showdown.Converter({ tables: true, disableForced4SpacesIndentedSublists: true });
  let text = String(txt ?? "").replace(/^\n+/, "");
  // remove a leading indent shared by the text (tools.js: whitespace of the first line)
  const lead = /^[\n\t]*/.exec(text.split("\n")[0])?.[0].length ?? 0;
  if (lead && lead !== text.split("\n")[0].length) text = text.split("\n").map((l) => l.slice(lead)).join("\n");
  return sanitizeMarkdownHtml(converter.makeHtml(text));
}
