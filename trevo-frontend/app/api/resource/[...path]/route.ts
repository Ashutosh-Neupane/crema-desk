/** /api/resource/* on Trevo's origin → Frappe (used by Frappe's own Desk pages framed at /app/*). */
import { proxyHandlers } from "@/lib/frappe/proxy";

export const { GET, POST, PUT, DELETE } = proxyHandlers("api/resource");
