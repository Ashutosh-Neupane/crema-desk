import { notFound, redirect } from "next/navigation";
import { getCookieHeader } from "@/lib/frappe/server";
import { getDeskBoot } from "@/lib/frappe/deskBoot";
import { resolveDeskPath } from "@/lib/navigation/deskRoute";
import { registryFromBoot } from "@/lib/navigation/deskRegistry";

interface Props {
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Desk URLs (`/desk/sales-invoice/new`, `/desk/selling`, `/desk/stock/item`, `/desk/List/User`) — links pasted from
 * Desk, Navbar Settings routes, frappe.set_route("/app/…") — resolved from the session's boot like Desk's router
 * and redirected to the Crema route. Crema's own static routes (/desk/doctype, /desk/page, …) never reach here.
 */
export default async function DeskSlugRoute({ params, searchParams }: Props) {
  const [{ slug, rest = [] }, sp, boot] = await Promise.all([params, searchParams, getCookieHeader().then(getDeskBoot)]);
  if (!boot) notFound();
  const search = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]])),
  ).toString();
  redirect(
    resolveDeskPath([slug, ...rest].join("/"), registryFromBoot(boot), search),
  );
}
