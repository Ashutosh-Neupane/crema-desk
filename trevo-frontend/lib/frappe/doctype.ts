/**
 * DocType meta fetching (both server-side for RSC and client-side for hooks).
 * Server function wrapped in React.cache() for dedup within a single SSR pass.
 */
import { cache } from "react";
import type { DocTypeMeta } from "./types";

// ---------------------------------------------------------------------------
// Server-side (for RSC pages + route handlers)
// ---------------------------------------------------------------------------

import { frappeServerFetch, getCookieHeader } from "./server";

/** Fetch DocType meta from the server (SSR). Deduplicated per request via React.cache(). */
export const fetchDoctypeMetaServer = cache(async (doctype: string): Promise<DocTypeMeta> => {
  const cookie = await getCookieHeader();
  const { data } = await frappeServerFetch<DocTypeMeta>(
    cookie,
    `api/resource/DocType/${encodeURIComponent(doctype)}`,
  );
  if (!data) throw new Error(`DocType "${doctype}" not found`);
  return data;
});

// ---------------------------------------------------------------------------
// Client-side (for React Query hooks / client components)
// ---------------------------------------------------------------------------

import { frappeGet } from "./client";

export async function fetchDoctypeMetaClient(doctype: string): Promise<DocTypeMeta> {
  const meta = await frappeGet<DocTypeMeta>(`DocType/${encodeURIComponent(doctype)}`);
  if (!meta) throw new Error(`DocType "${doctype}" not found`);
  return meta;
}
