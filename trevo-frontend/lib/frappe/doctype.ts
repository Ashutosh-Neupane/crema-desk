/**
 * DocType meta fetching (both server-side for RSC and client-side for hooks).
 *
 * Uses `frappe.desk.form.load.getdoctype` — the same call Desk makes — rather
 * than `api/resource/DocType/<name>`. The raw DocType record misses Custom
 * Fields and Property Setters (everything done via Customize Form), and is not
 * readable by most non-admin users. getdoctype returns the merged meta of the
 * DocType *and* every child DocType it uses, plus `__js`, `__custom_js`,
 * `__list_js`, `__workflow_docs`, `__dashboard`, `__print_formats`, …
 * Server function wrapped in React.cache() for dedup within a single SSR pass.
 */
import { cache } from "react";
import type { DocTypeMeta } from "./types";

const GETDOCTYPE = "frappe.desk.form.load.getdoctype";

/** Response shape of getdoctype: `{ docs: [parent, ...childMetas] }` */
interface GetDoctypeResponse {
  docs?: DocTypeMeta[];
}

function pickMeta(res: GetDoctypeResponse | null | undefined, doctype: string): DocTypeMeta {
  const docs = res?.docs ?? [];
  const meta = docs.find((d) => d.name === doctype) ?? docs[0];
  if (!meta) throw new Error(`DocType "${doctype}" not found`);
  return meta;
}

// ---------------------------------------------------------------------------
// Server-side (for RSC pages + route handlers)
// ---------------------------------------------------------------------------

import { frappeServerFetch, getCookieHeader } from "./server";

/** Fetch all metas getdoctype returns for `doctype` (parent first). */
export async function fetchDoctypeMetasServer(cookie: string, doctype: string): Promise<DocTypeMeta[]> {
  const { envelope } = await frappeServerFetch<GetDoctypeResponse>(cookie, `api/method/${GETDOCTYPE}`, {
    params: { doctype, with_parent: 1 },
  });
  return (envelope as GetDoctypeResponse | null)?.docs ?? [];
}

/** Fetch DocType meta from the server (SSR). Deduplicated per request via React.cache(). */
export const fetchDoctypeMetaServer = cache(async (doctype: string): Promise<DocTypeMeta> => {
  const cookie = await getCookieHeader();
  return pickMeta({ docs: await fetchDoctypeMetasServer(cookie, doctype) }, doctype);
});

// ---------------------------------------------------------------------------
// Client-side (for React Query hooks / client components)
// ---------------------------------------------------------------------------

/**
 * Child metas arrive with their parent, so cache every meta getdoctype returns;
 * a child Table control asking for its row DocType then needs no extra request.
 * Short TTL so Customize Form changes show up without a hard reload.
 */
const META_TTL_MS = 60_000;
const metaCache = new Map<string, { meta: DocTypeMeta; at: number }>();

export function primeDoctypeMetaCache(metas: DocTypeMeta[]): void {
  const at = Date.now();
  for (const m of metas) if (m?.name) metaCache.set(m.name, { meta: m, at });
}

export function clearDoctypeMetaCache(doctype?: string): void {
  if (doctype) metaCache.delete(doctype);
  else metaCache.clear();
}

export async function fetchDoctypeMetaClient(doctype: string): Promise<DocTypeMeta> {
  const hit = metaCache.get(doctype);
  if (hit && Date.now() - hit.at < META_TTL_MS) return hit.meta;

  const params = new URLSearchParams({ doctype, with_parent: "1" });
  const res = await fetch(`/api/frappe/api/method/${GETDOCTYPE}?${params}`, {
    credentials: "include",
    cache: "no-store", // meta changes as soon as a DocType / Customize Form is saved
    headers: { Accept: "application/json" },
  });
  const json = (await res.json().catch(() => null)) as (GetDoctypeResponse & { exception?: string }) | null;
  if (!res.ok) {
    throw new Error(json?.exception?.split("\n").filter(Boolean).pop() ?? `Failed to load DocType "${doctype}"`);
  }
  primeDoctypeMetaCache(json?.docs ?? []);
  return pickMeta(json, doctype);
}
