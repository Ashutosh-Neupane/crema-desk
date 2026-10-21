import { notFound, redirect } from "next/navigation";
import { getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";
import { resolveDeskPath } from "@/lib/navigation/deskRoute";

interface Props {
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Desk URLs (`/desk/sales-invoice/new`, `/desk/selling`, `/desk/stock/item`, `/desk/List/User`) — links pasted from
 * Desk, Navbar Settings routes, frappe.set_route("/app/…") — resolved from the session's boot like Desk's router
 * and redirected to the Trevo route. Trevo's own static routes (/desk/doctype, /desk/page, …) never reach here.
 */
export default async function DeskSlugRoute({ params, searchParams }: Props) {
  const [{ slug, rest = [] }, sp, boot] = await Promise.all([params, searchParams, getCookieHeader().then(getDeskBoot)]);
  if (!boot) notFound();
  const user = (boot.user ?? {}) as { can_read?: string[] };
  const pages = ((boot.workspaces as { pages?: Array<{ name: string }> } | undefined)?.pages ?? []).map((p) => p.name);
  const search = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]])),
  ).toString();
  redirect(
    resolveDeskPath([slug, ...rest].join("/"), { doctypes: user.can_read ?? [], workspaces: pages, shells: Object.keys(boot.module_sidebars ?? {}) }, search),
  );
}
