import type { QueryClient } from "@tanstack/react-query";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";

/** frappe.ui.toolbar.clear_cache: the server's boot cache and the client caches, then a reload */
export async function clearDeskCache(qc: QueryClient) {
  clearDoctypeMetaCache();
  qc.clear();
  await fetch("/api/desk/shell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear-cache" }), credentials: "include" }).catch(() => undefined);
  window.location.reload();
}
