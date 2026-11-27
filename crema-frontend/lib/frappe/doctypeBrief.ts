/**
 * A DocType's summary facts from /api/doctype/:doctype/brief (a few bytes instead of the full meta), cached per page
 * session and shared between concurrent callers.
 */
export interface DoctypeBrief {
  /** a real column to show as the title, or null (use the name) */
  title_field: string | null;
  is_submittable: boolean;
  /** has a `status` Select field */
  has_status: boolean;
}

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; brief: Promise<DoctypeBrief> }>();

export function fetchDoctypeBrief(doctype: string): Promise<DoctypeBrief> {
  const hit = cache.get(doctype);
  if (hit && Date.now() - hit.at < TTL) return hit.brief;
  const brief = fetch(`/api/doctype/${encodeURIComponent(doctype)}/brief`, { credentials: "include" }).then(async (r) => {
    if (!r.ok) throw new Error(`Failed to load ${doctype}`);
    return (await r.json()) as DoctypeBrief;
  });
  cache.set(doctype, { at: Date.now(), brief });
  brief.catch(() => cache.delete(doctype));
  return brief;
}
