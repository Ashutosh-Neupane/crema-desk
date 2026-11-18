/**
 * Desk's icon sprites (frappe hooks.py app_include_icons: lucide + timeless, inlined in desk.html as #all-symbols).
 * Loaded once through the /assets proxy and added to the page, so `<use href="#icon-<name>">` draws Desk's icons;
 * frappe.symbols (icon.js get_all_icons) is the list of names.
 */
const SPRITES = ["/assets/frappe/icons/lucide/icons.svg", "/assets/frappe/icons/timeless/icons.svg"];

let loading: Promise<string[]> | null = null;

export function loadDeskIcons(): Promise<string[]> {
  loading ??= (async () => {
    if (typeof document === "undefined") return [];
    let host = document.getElementById("crema-symbols");
    if (!host) {
      host = document.createElement("div");
      host.id = "crema-symbols";
      host.setAttribute("aria-hidden", "true");
      host.style.display = "none";
      const texts = await Promise.all(SPRITES.map((u) => fetch(u).then((r) => (r.ok ? r.text() : "")).catch(() => "")));
      for (const t of texts) {
        // the sprite files are Frappe's own static SVG (symbols only); parse as XML, no scripts run
        const svg = new DOMParser().parseFromString(t.replace(/<!--[\s\S]*?-->/g, ""), "image/svg+xml").querySelector("svg");
        if (!svg) continue;
        svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
        host.appendChild(document.importNode(svg, true));
      }
      document.body.appendChild(host);
    }
    const names = new Set<string>();
    host.querySelectorAll("symbol[id^='icon-']").forEach((s) => names.add(s.id.slice(5)));
    return [...names];
  })();
  return loading;
}
