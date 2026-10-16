"use client";

/**
 * ⌘K awesomebar — mirrors Frappe Desk's search bar:
 *  - DocTypes the user can read → "<DocType> List" / open Single, and "New <DocType>"
 *  - Reports (allowed_reports) and module workspaces
 *  - Full-text document search (frappe.utils.global_search) for 2+ chars
 * Opens on ⌘K / Ctrl+K (TrevoShell dispatches `trevo:command-palette`) or the trigger button.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Search, FileText, Plus, List, BarChart3, LayoutGrid, Settings2, Moon, Sun, Monitor } from "lucide-react";
import { useGlobalSearch } from "@/lib/hooks/useSearch";
import { useUIStore } from "@/lib/stores/ui.store";
import type { AwesomebarIndex } from "@/app/api/awesomebar/route";

const MAX_PER_GROUP = 8;

interface Entry {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: typeof FileText;
  /** text matched against the query */
  key: string;
}

/** Desk-like ranking: exact > prefix > word-start > substring; null = no match. */
function score(key: string, q: string): number | null {
  const k = key.toLowerCase();
  if (k === q) return 0;
  if (k.startsWith(q)) return 1;
  if (k.split(/[\s_-]+/).some((w) => w.startsWith(q))) return 2;
  if (k.includes(q)) return 3;
  return null;
}

function rank(entries: Entry[], q: string): Entry[] {
  return entries
    .map((e) => ({ e, s: score(e.key, q) }))
    .filter((x): x is { e: Entry; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.e.key.length - b.e.key.length)
    .slice(0, MAX_PER_GROUP)
    .map((x) => x.e);
}

const enc = encodeURIComponent;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const uiStore = useUIStore();
  const q = search.trim().toLowerCase();

  const { data: index } = useQuery<AwesomebarIndex>({
    queryKey: ["awesomebar-index"],
    queryFn: async () => {
      const res = await fetch("/api/awesomebar", { credentials: "include" });
      return res.ok ? res.json() : { doctypes: [], reports: [], workspaces: [] };
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  // Debounce full-text search so typing doesn't fire a request per keystroke
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(open ? search.trim() : ""), 250);
    return () => clearTimeout(t);
  }, [search, open]);
  const { data: searchResults, isFetching: searching } = useGlobalSearch(debounced);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("trevo:command-palette", onToggle);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("trevo:command-palette", onToggle);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const { lists, creates, reports, workspaces } = useMemo(() => {
    const listEntries: Entry[] = [];
    const createEntries: Entry[] = [];
    for (const d of index?.doctypes ?? []) {
      listEntries.push({
        id: `list:${d.name}`,
        label: d.single ? d.name : `${d.name} List`,
        href: d.single ? `/desk/doctype/${enc(d.name)}/${enc(d.name)}` : `/desk/doctype/${enc(d.name)}`,
        icon: d.single ? Settings2 : List,
        key: d.name,
      });
      if (d.create) {
        createEntries.push({
          id: `new:${d.name}`,
          label: `New ${d.name}`,
          href: `/desk/doctype/${enc(d.name)}/new`,
          icon: Plus,
          key: d.name,
        });
      }
    }
    const reportEntries: Entry[] = (index?.reports ?? []).map((r) => ({
      id: `report:${r.name}`,
      label: r.name,
      hint: [r.report_type, r.ref_doctype].filter(Boolean).join(" · "),
      href: `/desk/query-report/${enc(r.name)}`,
      icon: BarChart3,
      key: r.name,
    }));
    const wsEntries: Entry[] = (index?.workspaces ?? []).map((w) => ({
      id: `ws:${w.name}`,
      label: w.name,
      hint: w.module,
      href: `/desk/workspace/${enc(w.name)}`,
      icon: LayoutGrid,
      key: w.name,
    }));
    if (!q) return { lists: [], creates: [], reports: [], workspaces: wsEntries.slice(0, MAX_PER_GROUP) };
    return {
      lists: rank(listEntries, q),
      creates: rank(createEntries, q).slice(0, 3),
      reports: rank(reportEntries, q),
      workspaces: rank(wsEntries, q),
    };
  }, [index, q]);

  const docs = (Array.isArray(searchResults) ? searchResults : []) as Array<{
    doctype?: string;
    name?: string;
    content?: string;
    title?: string;
  }>;

  const item = (e: Entry) => (
    <Command.Item
      key={e.id}
      value={e.id}
      onSelect={() => go(e.href)}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-800 data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800"
    >
      <e.icon className="h-4 w-4 shrink-0 text-zinc-500" />
      <span className="truncate">{e.label}</span>
      {e.hint && <span className="ml-auto truncate text-xs text-zinc-400">{e.hint}</span>}
    </Command.Item>
  );

  const group = (heading: string, entries: Entry[]) =>
    entries.length > 0 && (
      <Command.Group
        heading={heading}
        className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-400"
      >
        {entries.map(item)}
      </Command.Group>
    );

  const nothing = q && !lists.length && !creates.length && !reports.length && !workspaces.length && !docs.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center gap-2 rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        <Search className="h-4 w-4" />
        <span>Search or type a command</span>
        <kbd className="ml-auto rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium dark:border-zinc-700 dark:bg-zinc-900">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mt-[12vh] w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <Command shouldFilter={false} loop className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-700">
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search for anything — e.g. Sales Order, new customer, a document name"
                  className="h-12 w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                />
                <kbd className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700">ESC</kbd>
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                {group("Lists", lists)}
                {group("Create", creates)}
                {group("Reports", reports)}
                {group(q ? "Workspaces" : "Go to workspace", workspaces)}

                {q.length >= 2 && docs.length > 0 && (
                  <Command.Group
                    heading={`Documents matching “${search.trim()}”`}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-400"
                  >
                    {docs.slice(0, MAX_PER_GROUP).map((r, i) => (
                      <Command.Item
                        key={`doc:${r.doctype}:${r.name}:${i}`}
                        value={`doc:${r.doctype}:${r.name}`}
                        onSelect={() => r.doctype && r.name && go(`/desk/doctype/${enc(r.doctype)}/${enc(r.name)}`)}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                        <div className="min-w-0">
                          <div className="truncate text-zinc-800 dark:text-zinc-200">{r.title || r.name}</div>
                          <div className="truncate text-xs text-zinc-400">
                            {r.doctype}
                            {r.content ? ` · ${r.content.replace(/<[^>]+>/g, "").slice(0, 90)}` : ""}
                          </div>
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {!q && (
                  <Command.Group
                    heading="Theme"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-400"
                  >
                    {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(
                      ([value, label, Icon]) => (
                        <Command.Item
                          key={value}
                          value={`theme:${value}`}
                          onSelect={() => {
                            uiStore.setTheme(value);
                            close();
                          }}
                          className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
                        >
                          <Icon className="h-4 w-4 text-zinc-500" />
                          <span>{label} theme</span>
                        </Command.Item>
                      ),
                    )}
                  </Command.Group>
                )}

                {nothing && !searching && (
                  <div className="px-3 py-8 text-center text-sm text-zinc-500">No results for “{search.trim()}”</div>
                )}
              </Command.List>

              <div className="flex items-center gap-4 border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-400 dark:border-zinc-700">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
              </div>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}
