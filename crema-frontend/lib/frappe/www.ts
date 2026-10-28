/**
 * Frappe www-page renderer (server-side).
 *
 * Frappe serves its public website pages (`frappe/www/*.html` + apps' www
 * folders) as Jinja templates rendered by the website module — e.g. /login,
 * /404, /message, /update-password, /about. This module fetches the fully
 * rendered HTML from the Frappe backend, extracts the head styles + body
 * markup, and rewrites asset/form URLs to point at the backend origin so the
 * page keeps working when mounted inside the crema frontend.
 */

import { FRAPPE_BACKEND_URL, backendFetch } from "./server";

export interface WwwPageResult {
  ok: boolean;
  status: number;
  title: string;
  /** <link rel="stylesheet"> and <style> tags pulled from the backend <head> */
  stylesHtml: string;
  /** rendered <body> inner HTML with URLs rewritten */
  bodyHtml: string;
  error?: string;
}

/** Rewrite absolute-path URLs (assets, files, api, links) to the backend origin. */
function rewriteUrls(html: string): string {
  return html
    .replace(/((?:src|href|action|poster)=["'])(?!https?:\/\/|data:|\/\/|#|mailto:|tel:)(\/)/g, `$1${FRAPPE_BACKEND_URL}/`)
    .replace(/(url\(\s*["']?)(?!https?:\/\/|data:|\/\/|#)(\/)/g, `$1${FRAPPE_BACKEND_URL}/`);
}

function extractTag(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = html.match(re);
  return m ? m[1] : null;
}

/** Keep only stylesheet links + inline styles from the backend <head>. */
function extractStyles(head: string): string {
  const links = [...head.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)].map((m) => m[0]);
  const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]);
  return [...links, ...styles].join("\n");
}

export async function fetchWwwPage(path: string, cookieHeader: string): Promise<WwwPageResult> {
  const cleanPath = path.replace(/^\/+/, "") || "message";
  const url = `${FRAPPE_BACKEND_URL}/${cleanPath}`;

  let res: Response;
  try {
    res = await backendFetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return {
      ok: false,
      status: 502,
      title: "Backend unavailable",
      stylesHtml: "",
      bodyHtml: `<div class="www-error"><h2>Frappe backend unreachable</h2><p>Could not connect to <code>${FRAPPE_BACKEND_URL}</code>. Start the backend (docker) and retry.</p></div>`,
    };
  }

  // Follow one hop of backend redirects (e.g. / → /app or /login)
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (location) {
      const target = new URL(location, FRAPPE_BACKEND_URL);
      if (target.origin === FRAPPE_BACKEND_URL) {
        return fetchWwwPage(target.pathname + target.search, cookieHeader);
      }
    }
  }

  const html = await res.text();
  const title = extractTag(html, "title")?.trim() || cleanPath;
  const head = extractTag(html, "head") ?? "";
  const body = extractTag(html, "body") ?? html;

  return {
    ok: res.ok,
    status: res.status,
    title,
    stylesHtml: rewriteUrls(extractStyles(head)),
    bodyHtml: rewriteUrls(body),
    error: res.ok ? undefined : `Frappe returned ${res.status} for /${cleanPath}`,
  };
}

/** Well-known Frappe framework www pages (frappe/frappe/www/). */
export const KNOWN_WWW_PAGES: { path: string; label: string }[] = [
  { path: "login", label: "Login" },
  { path: "message", label: "Message" },
  { path: "about", label: "About" },
  { path: "contact", label: "Contact" },
  { path: "me", label: "My Profile (me)" },
  { path: "update-password", label: "Update Password" },
  { path: "third_party_apps", label: "Third Party Apps" },
  { path: "portal", label: "Portal" },
  { path: "404", label: "404 Page" },
];
