/**
 * Legacy page host, server side (docs/GAPS.md L4): serves Frappe's own Desk HTML for /desk/<path> at
 * Trevo's /app/<path> (Frappe's router accepts the /app prefix), so jQuery/Vue Desk pages (POS, setup
 * wizard, app pages) run unmodified in a same-origin frame. Their /assets, /files, /api/method and
 * /api/resource calls hit Trevo's proxies. An injected style hides Desk's chrome; an injected script
 * reports title/route to the parent and hands Form/List navigation back to Trevo.
 */
import { NextResponse, type NextRequest } from "next/server";
import { FRAPPE_BACKEND_URL, FRAPPE_SITE_NAME, backendFetch } from "@/lib/frappe/server";

const CHROME_CSS = `<style id="trevo-legacy">
  .navbar, header.navbar, .body-sidebar-container, .body-sidebar, .navbar-breadcrumbs, #desk-dock, .dock { display: none !important; }
  body { padding-top: 0 !important; }
  .main-section { margin-left: 0 !important; }
</style>`;

// before Desk's bundles: Frappe's router resolves routes from /desk/<route>; the frame is loaded from
// /app/<route> (Trevo owns /desk), so rewrite the address in place — no navigation happens
const PRE_ROUTER_JS = `<script id="trevo-legacy-route">
(function () { if (location.pathname.indexOf("/app") === 0) history.replaceState(history.state, "", "/desk" + location.pathname.slice(4) + location.search + location.hash); })();
</script>`;

const BRIDGE_JS = `<script id="trevo-legacy-bridge">
(function () {
  if (window.parent === window) return;
  var post = function (msg) { try { window.parent.postMessage(Object.assign({ source: "trevo-legacy" }, msg), window.location.origin); } catch (e) {} };
  var hook = function () {
    if (!window.frappe || !frappe.router || !frappe.router.on) return setTimeout(hook, 200);
    var report = function () {
      var route = frappe.get_route ? frappe.get_route() : [];
      var kind = route && route[0];
      // leaving the page for a form/list/report → let Trevo render it natively
      if (kind === "Form" || kind === "List" || kind === "query-report" || kind === "Tree") {
        post({ type: "navigate", route: route });
        return;
      }
      post({ type: "route", route: route, title: document.title });
    };
    frappe.router.on("change", report);
    window.__trevoBridgeReady = true;
    report();
  };
  hook();
  new MutationObserver(function () { post({ type: "title", title: document.title }); }).observe(document.querySelector("title") || document.head, { childList: true, subtree: true, characterData: true });
})();
</script>`;

function origin(): string {
  // like the file proxy: a *.localhost site is reached by its own host name (Desk resolves the site from Host)
  try {
    const u = new URL(FRAPPE_BACKEND_URL);
    if (FRAPPE_SITE_NAME.endsWith(".localhost") && ["localhost", "127.0.0.1"].includes(u.hostname)) u.hostname = FRAPPE_SITE_NAME;
    return u.origin;
  } catch {
    return FRAPPE_BACKEND_URL;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const parts = (await params).path ?? [];
  const target = new URL(`${origin()}/desk/${parts.map(encodeURIComponent).join("/")}`);
  req.nextUrl.searchParams.forEach((v, k) => target.searchParams.append(k, v));
  const res = await backendFetch(target.toString(), { headers: { cookie: req.headers.get("cookie") ?? "", accept: "text/html" }, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    // e.g. not logged in → Frappe's /login; Trevo has its own
    return NextResponse.redirect(new URL("/login", req.url));
  }
  let html = await res.text();
  // the bench publishes socket.io on another host port than it believes (docker): point the framed page at it
  const sio = process.env.NEXT_PUBLIC_SOCKETIO_URL ? new URL(process.env.NEXT_PUBLIC_SOCKETIO_URL).port : "";
  if (sio) html = html.replace(/"socketio_port":\s*"?\d+"?/, `"socketio_port":"${sio}"`);
  html = html.replace(/<head([^>]*)>/i, `<head$1>${PRE_ROUTER_JS}`).replace("</head>", `${CHROME_CSS}</head>`).replace("</body>", `${BRIDGE_JS}</body>`);
  return new NextResponse(html, { status: res.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" } });
}
