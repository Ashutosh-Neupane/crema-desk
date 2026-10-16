"use client";

/**
 * Desk sidebar modelled on Frappe v16: one module ("shell") at a time —
 * Selling, Stock, Accounts, … — chosen from a switcher grouped by app (the
 * dock), with that module's links and collapsible groups underneath. The
 * active module follows the route, so opening Sales Order shows Selling.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Circle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import type { DeskNavigation, NavLinkItem, NavSection } from "@/lib/navigation";

const ICONS = new Set<string>(iconNames);

/** Frappe icon names are lucide names, sometimes with a style suffix. */
function toLucide(name?: string | null): IconName | null {
  if (!name) return null;
  const base = name.replace(/-(duotone|soft|fill|bold|light|thin)$/, "");
  return ICONS.has(base) ? (base as IconName) : null;
}

export function SidebarIcon({ name, className = "h-4 w-4" }: { name?: string | null; className?: string }) {
  const icon = toLucide(name);
  if (!icon) return <Circle className={`${className} scale-[0.4] opacity-50`} />;
  return <DynamicIcon name={icon} className={className} />;
}

function isActive(pathname: string, href: string): boolean {
  const path = decodeURIComponent(pathname);
  const target = decodeURIComponent(href.split("?")[0]);
  return path === target || path.startsWith(target + "/");
}

function links(section: NavSection): NavLinkItem[] {
  return section.items.flatMap((i) => (i.type === "link" ? [i] : links(i)));
}

/** Module whose links best match the current path (longest href wins). */
function moduleForPath(sections: NavSection[], pathname: string): NavSection | undefined {
  let best: { s: NavSection; len: number } | undefined;
  for (const s of sections) {
    for (const l of [...links(s), ...(s.href ? [{ href: s.href } as NavLinkItem] : [])]) {
      if (isActive(pathname, l.href) && (!best || l.href.length > best.len)) best = { s, len: l.href.length };
    }
  }
  return best?.s;
}

const APP_TITLES: Record<string, string> = { frappe: "Framework", erpnext: "ERPNext" };

function SidebarLink({ item, nested }: { item: NavLinkItem; nested?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={[
        "group flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors",
        nested ? "pl-7" : "",
        active
          ? "bg-white font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.06)] dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
      ].join(" ")}
    >
      {!nested && (
        <span className={active ? "text-zinc-700 dark:text-zinc-200" : "text-zinc-400 group-hover:text-zinc-600"}>
          <SidebarIcon name={item.icon} />
        </span>
      )}
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SidebarGroup({ group }: { group: NavSection }) {
  const pathname = usePathname();
  const containsActive = links(group).some((l) => isActive(pathname, l.href));
  const [open, setOpen] = useState(true);
  const expanded = open || containsActive;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span className="text-zinc-400">
          <SidebarIcon name={group.icon} />
        </span>
        <span className="truncate">{group.label}</span>
        {expanded ? (
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-zinc-400" />
        ) : (
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
      {expanded && (
        <div className="mt-0.5 flex flex-col gap-px">
          {group.items.map((i) =>
            i.type === "link" ? <SidebarLink key={i.href + i.label} item={i} nested /> : <SidebarGroup key={i.id} group={i} />,
          )}
        </div>
      )}
    </div>
  );
}

export default function DeskSidebar({ navigation }: { navigation: DeskNavigation }) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = navigation.sections;
  const [picked, setPicked] = useState<string | null>(null);

  const modules = useMemo(() => sections.filter((s) => s.id.startsWith("module:")), [sections]);
  const tools = useMemo(() => sections.filter((s) => !s.id.startsWith("module:")), [sections]);
  const byApp = useMemo(() => {
    const groups = new Map<string, NavSection[]>();
    for (const m of modules) {
      const app = m.app ?? "";
      if (!groups.has(app)) groups.set(app, []);
      groups.get(app)!.push(m);
    }
    return [...groups.entries()];
  }, [modules]);

  // Route decides first; an explicit pick from the switcher holds until the route says otherwise
  const routeModule = moduleForPath(sections, pathname);
  const active =
    routeModule ?? sections.find((s) => s.id === picked) ?? modules[0] ?? sections[0];

  if (!active) return null;

  const choose = (s: NavSection) => {
    setPicked(s.id);
    const first = s.href ?? links(s)[0]?.href;
    if (first) router.push(first);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <span className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-zinc-200/60 dark:hover:bg-zinc-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <SidebarIcon name={active.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{active.label}</span>
                {active.app && (
                  <span className="block truncate text-[11px] text-zinc-500">{APP_TITLES[active.app] ?? active.app}</span>
                )}
              </span>
              <ChevronsUpDown className="h-4 w-4 text-zinc-400" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
            {byApp.map(([app, mods], gi) => (
              <div key={app || gi}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  {APP_TITLES[app] ?? (app || "Modules")}
                </DropdownMenuLabel>
                {mods.map((m) => (
                  <DropdownMenuItem key={m.id} onClick={() => choose(m)} className="gap-2">
                    <SidebarIcon name={m.icon} />
                    <span className="truncate">{m.label}</span>
                    {m.id === active.id && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
            {tools.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Trevo</DropdownMenuLabel>
                {tools.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => choose(t)}>
                    <span className="truncate">{t.label}</span>
                    {t.id === active.id && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex flex-col gap-px">
          {active.items.map((i) =>
            i.type === "link" ? <SidebarLink key={i.href + i.label} item={i} /> : <SidebarGroup key={i.id} group={i} />,
          )}
        </div>
      </nav>
    </div>
  );
}
