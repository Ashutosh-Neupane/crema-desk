"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { getRecentDocs, type RecentDoc } from "@/lib/utils/recentDocs";
import { fetchAssignments, fetchMyDocs, fetchShortcuts, fetchWorkflowActions, fetchWorkspacePages, pickWorkspace } from "./api";
import { byRecent, dedupeByDoc, docHref, parseDeskRoute, workDoctypes, type WorkItem } from "./data";

const EMPTY_RECENT: RecentDoc[] = [];
let recentCache: { raw: string; list: RecentDoc[] } = { raw: "", list: EMPTY_RECENT };
function readRecent(): RecentDoc[] {
  const list = getRecentDocs();
  const raw = JSON.stringify(list);
  if (raw !== recentCache.raw) recentCache = { raw, list };
  return recentCache.list;
}
function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Documents opened in Crema's form (DocForm → addRecentDoc), per browser. */
export function useRecentlyOpened(): RecentDoc[] {
  return useSyncExternalStore(subscribeStorage, readRecent, () => EMPTY_RECENT);
}

function useSession() {
  const { data: ctx, isError } = useDeskContext();
  const canRead = useMemo(() => new Set(ctx?.perms?.can_read ?? []), [ctx]);
  const visited = useMemo(() => {
    const links = (ctx?.boot?.frequently_visited_links ?? []) as Array<{ route?: string }>;
    return links.map((l) => parseDeskRoute(String(l.route ?? "")));
  }, [ctx]);
  return { user: ctx?.user ?? "", fullName: ctx?.full_name ?? "", canRead, visited, failed: isError };
}

export function useWaitingOnMe(user: string, canRead: ReadonlySet<string>) {
  return useQuery<WorkItem[]>({
    queryKey: ["my-work", "waiting", user],
    enabled: !!user,
    queryFn: async () => {
      const [approvals, todos] = await Promise.all([fetchWorkflowActions(canRead), fetchAssignments(user, canRead)]);
      return dedupeByDoc([...approvals, ...todos]);
    },
    staleTime: 30_000,
  });
}

export function useShortcuts(user: string) {
  return useQuery({
    queryKey: ["my-work", "shortcuts", user],
    enabled: !!user,
    queryFn: async () => {
      const page = pickWorkspace(await fetchWorkspacePages(), user);
      return { workspace: page?.name, shortcuts: page ? await fetchShortcuts(page) : [] };
    },
    staleTime: 5 * 60_000,
  });
}

export function useMyWork() {
  const session = useSession();
  const { user, canRead, visited } = session;
  const opened = useRecentlyOpened();
  const waiting = useWaitingOnMe(user, canRead);
  const shortcuts = useShortcuts(user);

  // wait for approvals / assignments and shortcuts so their doctypes count as "the doctypes I work in"
  const doctypes = useMemo(() => {
    if (!user || waiting.isPending || shortcuts.isPending) return null;
    return workDoctypes(
      [
        (waiting.data ?? []).map((w) => w.doctype),
        opened.map((o) => o.doctype),
        visited.map((v) => v.doctype),
        (shortcuts.data?.shortcuts ?? []).map((s) => s.doctype),
      ],
      canRead,
    );
  }, [user, waiting.isPending, waiting.data, shortcuts.isPending, shortcuts.data, opened, visited, canRead]);

  const mine = useQuery({
    queryKey: ["my-work", "mine", user, doctypes],
    enabled: !!doctypes,
    queryFn: () => fetchMyDocs(user, doctypes ?? []),
    staleTime: 30_000,
  });

  const drafts = useMemo(() => (mine.data?.drafts ?? []).slice().sort(byRecent), [mine.data]);

  const recent = useMemo<WorkItem[]>(() => {
    const viewed: WorkItem[] = opened.map((o) => ({
      key: `view:${o.doctype}:${o.name}`,
      kind: "viewed",
      doctype: o.doctype,
      name: o.name,
      title: o.title || o.name,
      href: docHref(o.doctype, o.name),
      detail: "Viewed",
      at: o.at,
    }));
    const fromDesk: WorkItem[] = visited
      .filter((v): v is { doctype: string; name: string } => !!v.doctype && !!v.name && canRead.has(v.doctype))
      .map((v) => ({ key: `visit:${v.doctype}:${v.name}`, kind: "viewed", doctype: v.doctype, name: v.name, title: v.name, href: docHref(v.doctype, v.name), detail: "Viewed" }));
    return dedupeByDoc([...viewed, ...(mine.data?.edited ?? [])].sort(byRecent).concat(fromDesk));
  }, [opened, visited, canRead, mine.data]);

  // a failed session never yields doctypes: show the error instead of a skeleton forever
  const draftsLoading = !session.failed && (!doctypes || mine.isPending);
  return { session, waiting, drafts, draftsLoading, draftsError: mine.isError || session.failed, refetchMine: mine.refetch, recent, shortcuts };
}
