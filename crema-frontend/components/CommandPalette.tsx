"use client";

/**
 * ⌘K awesomebar — mirrors Frappe Desk's search bar:
 *  - DocTypes the user can read → "<DocType> List" / open Single, and "New <DocType>" (after "new")
 *  - "<text> in <DocType>" → that list filtered by the text
 *  - Calculator: "3*7+2" → "3*7+2 = 23" (copies the result)
 *  - Reports (allowed_reports) and module workspaces
 *  - Full-text document search (frappe.utils.global_search) for 2+ chars
 * Opens on ⌘K / Ctrl+K (CremaShell dispatches `crema:command-palette`) or the trigger button.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Search, FileText, Plus, List, BarChart3, LayoutGrid, Settings2, Moon, Sun, Monitor, Calculator } from "lucide-react";
import { useGlobalSearch } from "@/lib/hooks/useSearch";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { useUIStore } from "@/lib/stores/ui.store";
import type { AwesomebarIndex } from "@/app/api/awesomebar/route";
import { calculate } from "@/lib/search/calculator";
import { newDoctypeQuery, score, searchInQuery } from "@/lib/search/awesomebar";

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

function rank(entries: Entry[], q: string): Entry[] {
  return entries
    .map((e) => ({ e, s: score(e.key, q) }))
    .filter((x): x is { e: Entry; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.e.key.length - b.e.key.length)
    .slice(0, MAX_PER_GROUP)
    .map((x) => x.e);
}

const enc = encodeURIComponent;

const GROUP_CLASS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-400";
const ITEM_CLASS =
  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-800 data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800";

interface Groups {
  lists: Entry[];
  creates: Entry[];
  finds: Entry[];
  reports: Entry[];
  workspaces: Entry[];
}

interface DocResult {
  doctype?: string;
  name?: string;
  content?: string;
  title?: string;
}

const EMPTY_INDEX: AwesomebarIndex = { doctypes: [], reports: [], workspaces: [] };

function doctypeEntries(index: AwesomebarIndex | undefined, canCreate: Set<string>) {
  const lists: Entry[] = [];
  const creates: Entry[] = [];
  for (const d of index?.doctypes ?? []) {
    lists.push({
      id: `list:${d.name}`,
      label: d.single ? d.name : `${d.name} List`,
      href: d.single ? `/desk/doctype/${enc(d.name)}/${enc(d.name)}` : `/desk/doctype/${enc(d.name)}`,
      icon: d.single ? Settings2 : List,
      key: d.name,
    });
    // Desk get_creatables: "new" + text → New <DocType> for each doctype in boot.user.can_create
    if (!d.single && canCreate.has(d.name)) {
      creates.push({ id: `new:${d.name}`, label: `New ${d.name}`, href: `/desk/doctype/${enc(d.name)}/new`, icon: Plus, key: d.name });
    }
  }
  return { lists, creates };
}

function findEntries(index: AwesomebarIndex | undefined, search: string): Entry[] {
  // Desk get_search_in_list: "<text> in <DocType>" → the doctype's list with ?q=<text>
  const inQuery = searchInQuery(search);
  if (!inQuery) return [];
  const entries = (index?.doctypes ?? [])
    .filter((d) => !d.single)
    .map((d) => ({ id: `find:${d.name}`, label: `Find ${inQuery.text} in ${d.name}`, href: `/desk/doctype/${enc(d.name)}?q=${enc(inQuery.text)}`, icon: Search, key: d.name }));
  return rank(entries, inQuery.target.toLowerCase());
}

function creatableEntries(creates: Entry[], search: string): Entry[] {
  // Desk get_creatables: a bare "new" lists every creatable doctype, "new <text>" fuzzy-matches them
  const newQuery = newDoctypeQuery(search);
  if (newQuery === null) return [];
  return newQuery === "" ? creates.slice(0, MAX_PER_GROUP) : rank(creates, newQuery);
}

function buildGroups(index: AwesomebarIndex | undefined, canCreate: Set<string>, q: string, search: string): Groups {
  const { lists, creates } = doctypeEntries(index, canCreate);
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
  if (!q) return { lists: [], creates: [], finds: [], reports: [], workspaces: wsEntries.slice(0, MAX_PER_GROUP) };

  return {
    lists: rank(lists, q),
    creates: creatableEntries(creates, search),
    finds: findEntries(index, search),
    reports: rank(reportEntries, q),
    workspaces: rank(wsEntries, q),
  };
}

function groupsEmpty(g: Groups) {
  return !g.lists.length && !g.creates.length && !g.finds.length && !g.reports.length && !g.workspaces.length;
}

/** awesomebar index (doctypes / reports / workspaces); fetched when the palette opens, cached 5 min */
function useAwesomebarIndex() {
  return useQuery<AwesomebarIndex>({
    queryKey: ["awesomebar-index"],
    queryFn: async () => {
      const res = await fetch("/api/awesomebar", { credentials: "include" });
      return res.ok ? res.json() : EMPTY_INDEX;
    },
    staleTime: 5 * 60 * 1000,
  }).data;
}

/** full-text document search, debounced so typing doesn't fire a request per keystroke */
function useDocumentSearch(search: string) {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isFetching } = useGlobalSearch(debounced);
  const docs = (Array.isArray(data) ? data : []) as DocResult[];
  return { docs, searching: isFetching };
}

function EntryGroup({ heading, entries, onGo }: { heading: string; entries: Entry[]; onGo: (href: string) => void }) {
  if (entries.length === 0) return null;
  return (
    <Command.Group heading={heading} className={GROUP_CLASS}>
      {entries.map((e) => (
        <Command.Item key={e.id} value={e.id} onSelect={() => onGo(e.href)} className={ITEM_CLASS}>
          <e.icon className="h-4 w-4 shrink-0 text-zinc-500" />
          <span className="truncate">{e.label}</span>
          {e.hint && <span className="ml-auto truncate text-xs text-zinc-400">{e.hint}</span>}
        </Command.Item>
      ))}
    </Command.Group>
  );
}

function CalcGroup({ calc, onDone }: { calc: NonNullable<ReturnType<typeof calculate>>; onDone: () => void }) {
  return (
    <Command.Group>
      <Command.Item
        value={`calc:${calc.expr}`}
        onSelect={() => {
          void navigator.clipboard?.writeText(calc.text).catch(() => {});
          onDone();
        }}
        className={ITEM_CLASS}
      >
        <Calculator className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="truncate">
          {calc.expr} = <span className="font-semibold">{calc.text}</span>
        </span>
        <span className="ml-auto truncate text-xs text-zinc-400">Copy result</span>
      </Command.Item>
    </Command.Group>
  );
}

function DocsGroup({ docs, search, onGo }: { docs: DocResult[]; search: string; onGo: (href: string) => void }) {
  return (
    <Command.Group heading={`Documents matching “${search.trim()}”`} className={GROUP_CLASS}>
      {docs.slice(0, MAX_PER_GROUP).map((r) => (
        <Command.Item
          key={`doc:${r.doctype}:${r.name}`}
          value={`doc:${r.doctype}:${r.name}`}
          onSelect={() => r.doctype && r.name && onGo(`/desk/doctype/${enc(r.doctype)}/${enc(r.name)}`)}
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
  );
}

const THEMES = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
] as const;

function ThemeGroup({ onDone }: { onDone: () => void }) {
  const setTheme = useUIStore((s) => s.setTheme);
  return (
    <Command.Group heading="Theme" className={GROUP_CLASS}>
      {THEMES.map(([value, label, Icon]) => (
        <Command.Item
          key={value}
          value={`theme:${value}`}
          onSelect={() => {
            setTheme(value);
            onDone();
          }}
          className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-zinc-100 dark:data-[selected=true]:bg-zinc-800"
        >
          <Icon className="h-4 w-4 text-zinc-500" />
          <span>{label} theme</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}

function PaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Search or type a command"
      className="flex items-center gap-2 rounded-md bg-zinc-100 p-1.5 sm:w-[clamp(14rem,30vw,28rem)] sm:px-3 text-sm text-zinc-500 transition-colors hover:bg-zinc-200/70 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
    >
      <Search className="h-4 w-4" />
      <span className="hidden truncate sm:inline">Search or type a command</span>
      <kbd className="ml-auto hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-medium dark:border-zinc-700 dark:bg-zinc-900 sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}

/** the palette's result list; mounted only while the palette is open */
function PaletteResults({ search, onGo, onClose }: { search: string; onGo: (href: string) => void; onClose: () => void }) {
  const q = search.trim().toLowerCase();
  const { data: ctx } = useDeskContext();
  const canCreate = useMemo(() => new Set(ctx?.perms?.can_create ?? []), [ctx]);
  const calc = useMemo(() => calculate(search), [search]);
  const index = useAwesomebarIndex();
  const { docs, searching } = useDocumentSearch(search);
  const groups = useMemo(() => buildGroups(index, canCreate, q, search), [index, q, search, canCreate]);
  const nothing = q && !calc && groupsEmpty(groups) && !docs.length;

  return (
    <Command.List className="max-h-[60vh] overflow-y-auto p-2">
      {calc && <CalcGroup calc={calc} onDone={onClose} />}
      <EntryGroup heading="Lists" entries={groups.lists} onGo={onGo} />
      <EntryGroup heading="Create" entries={groups.creates} onGo={onGo} />
      <EntryGroup heading="Find in list" entries={groups.finds} onGo={onGo} />
      <EntryGroup heading="Reports" entries={groups.reports} onGo={onGo} />
      <EntryGroup heading={q ? "Workspaces" : "Go to workspace"} entries={groups.workspaces} onGo={onGo} />
      {q.length >= 2 && docs.length > 0 && <DocsGroup docs={docs} search={search} onGo={onGo} />}
      {!q && <ThemeGroup onDone={onClose} />}
      {nothing && !searching && <div className="px-3 py-8 text-center text-sm text-zinc-500">No results for “{search.trim()}”</div>}
    </Command.List>
  );
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("crema:command-palette", onToggle);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("crema:command-palette", onToggle);
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

  return (
    <>
      <PaletteTrigger onOpen={() => setOpen(true)} />

      {open && (
        <div
          role="presentation"
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

              <PaletteResults search={search} onGo={go} onClose={close} />

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
