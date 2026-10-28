/**
 * List view data fetching — supports filtering, sorting, pagination.
 */
import type { FrappeDocument, FilterCondition, ListParams } from "./types";
import { frappeServerFetch, getCookieHeader } from "./server";
import { frappeGet, frappeMethod } from "./client";
import { encodeFilters } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Server-side
// ---------------------------------------------------------------------------

export interface ListResult<T = FrappeDocument> {
  data: T[];
  count: number;
}

export async function fetchListServer<T = FrappeDocument>(
  doctype: string,
  params: ListParams = {},
): Promise<{ data: T[] }> {
  const cookie = await getCookieHeader();
  const queryParams: Record<string, string | number | boolean | object | null | undefined> = {
    limit_page_length: params.limit ?? 20,
    limit_start: params.limit_start ?? 0,
  };
  if (params.fields) queryParams.fields = JSON.stringify(params.fields);
  if (params.filters) queryParams.filters = encodeFilters(params.filters);
  if (params.order_by) queryParams.order_by = params.order_by;

  const { data } = await frappeServerFetch<T[]>(
    cookie,
    `api/resource/${encodeURIComponent(doctype)}`,
    { params: queryParams },
  );
  return { data: data ?? [] };
}

export async function fetchCountServer(
  doctype: string,
  filters?: FilterCondition[],
): Promise<number> {
  const cookie = await getCookieHeader();
  const params: Record<string, string | number | boolean | object | null | undefined> = { doctype };
  if (filters) params.filters = encodeFilters(filters);
  const { data } = await frappeServerFetch<number>(
    cookie,
    "api/method/frappe.client.get_count",
    { params },
  );
  return data ?? 0;
}

// ---------------------------------------------------------------------------
// Client-side
// ---------------------------------------------------------------------------

export async function fetchListClient<T = FrappeDocument>(
  doctype: string,
  params: ListParams = {},
): Promise<{ data: T[] }> {
  const queryParams: Record<string, unknown> = {
    limit_page_length: params.limit ?? 20,
    limit_start: params.limit_start ?? 0,
  };
  if (params.fields) queryParams.fields = JSON.stringify(params.fields);
  if (params.filters) queryParams.filters = encodeFilters(filters_to_array(params.filters));
  if (params.order_by) queryParams.order_by = params.order_by;

  const data = await frappeGet<T[]>(encodeURIComponent(doctype), queryParams);
  return { data: data ?? [] };
}

export async function fetchCountClient(
  doctype: string,
  filters?: FilterCondition[],
): Promise<number> {
  const params: Record<string, unknown> = { doctype };
  if (filters) params.filters = encodeFilters(filters);
  return frappeMethod<number>("frappe.client.get_count", params);
}

/** Normalize filters to Frappe-style 2/3-tuples */
function filters_to_array(filters?: FilterCondition[]): unknown[] | undefined {
  if (!filters || filters.length === 0) return undefined;
  return filters.map((f) => f.length === 4 ? [f[0], f[1], f[2], f[3]] : [f[0], f[1], f[2]]);
}
