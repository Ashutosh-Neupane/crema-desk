/**
 * Generic BFF proxy: /api/frappe/<frappe path> → Frappe backend (e.g. /api/frappe/api/method/frappe.client.get).
 * All client-side Frappe calls flow through here (no CORS, backend URL never exposed).
 */
import { proxyHandlers } from "@/lib/frappe/proxy";

export const { GET, POST, PUT, DELETE } = proxyHandlers("");
