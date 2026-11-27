"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/frappe/auth";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { useUIStore } from "@/lib/stores/ui.store";
import { useNavigation } from "@/lib/hooks/useNavigation";
import CommandPalette from "@/components/CommandPalette";
import DeskSidebar from "@/components/DeskSidebar";
import DialogHost from "@/components/desk/DialogHost";
import MultiSelectHost from "@/components/desk/MultiSelectHost";
import ShortcutsDialog from "@/components/desk/ShortcutsDialog";
import SiteBanners from "@/components/desk/SiteBanners";
import UserMenu from "@/components/desk/UserMenu";
import { deskCall } from "@/lib/frappe/form";
import { useShortcuts } from "@/lib/shortcuts";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";
import { useQueryClient } from "@tanstack/react-query";
import NotificationsPanel from "@/components/NotificationsPanel";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useRealtimeStatus } from "@/lib/services/realtime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import type { DeskNavigation } from "@/lib/navigation";
import { useNewLayout } from "@/lib/ui/newLayout";
import {
  Moon,
  Sun,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  FileText,
  BarChart3,
  Settings,
  Calendar,
  FolderOpen,
  Tag,
  Bell,
  Printer,
  GitBranch,
  MapPin,
  Image,
  Mail,
  Languages,
  Shield,
  Terminal,
  UserPlus,
  Puzzle,
  Settings2,
  Globe,
  Layout,
  Users,
  ScrollText,
  StickyNote,
  ClipboardList,
  Wrench,
  Search,
  ChevronsUpDown,
  Boxes,
  Activity,
} from "lucide-react";

/** Fallback navigation used when /api/navigation is unavailable (offline/backend down). */
const FALLBACK_NAV: DeskNavigation = {
  sections: [
    {
      type: "section",
      id: "home",
      label: "Home",
      items: [
        { type: "link", label: "Dashboard", href: "/desk", icon: "Home" },
      ],
    },
    {
      type: "section",
      id: "tools",
      label: "Tools",
      items: [
        { type: "link", label: "DocTypes", href: "/desk/doctype", icon: "FileText" },
        { type: "link", label: "Reports", href: "/desk/reports", icon: "BarChart3" },
        { type: "link", label: "Calendar", href: "/desk/calendar", icon: "Calendar" },
        { type: "link", label: "Files", href: "/desk/files", icon: "FolderOpen" },
        { type: "link", label: "Tags", href: "/desk/tags", icon: "Tag" },
        { type: "link", label: "Inbox", href: "/desk/inbox", icon: "Mail" },
        { type: "link", label: "Translations", href: "/desk/translations", icon: "Languages" },
        { type: "link", label: "Route History", href: "/desk/route-history", icon: "ScrollText" },
        { type: "link", label: "System Health", href: "/desk/system-health", icon: "Activity" },
      ],
    },
    {
      type: "section",
      id: "developer",
      label: "Developer",
      items: [
        { type: "link", label: "Print Format Builder", href: "/desk/print-format", icon: "Printer" },
        { type: "link", label: "Workflow Builder", href: "/desk/workflow-builder", icon: "GitBranch" },
        { type: "link", label: "Web Forms", href: "/desk/web-forms", icon: "Globe" },
        { type: "link", label: "Website Pages (www)", href: "/www", icon: "Globe" },
        { type: "link", label: "Website Builder", href: "/desk/website-builder", icon: "Layout" },
        { type: "link", label: "Modules", href: "/desk/modules", icon: "Puzzle" },
        { type: "link", label: "Permissions", href: "/desk/permissions", icon: "Shield" },
        { type: "link", label: "System Console", href: "/desk/system-console", icon: "Terminal" },
        { type: "link", label: "Onboarding", href: "/desk/onboarding", icon: "UserPlus" },
      ],
    },
    {
      type: "section",
      id: "settings",
      label: "Settings",
      items: [
        { type: "link", label: "List View Settings", href: "/desk/list-view-settings", icon: "Settings2" },
        { type: "link", label: "Settings", href: "/desk/settings", icon: "Settings" },
        { type: "link", label: "Notification Settings", href: "/desk/notification-settings", icon: "Bell" },
        { type: "link", label: "Global Search Settings", href: "/desk/global-search-settings", icon: "Search" },
        { type: "link", label: "Dashboard Settings", href: "/desk/dashboard-settings", icon: "Layout" },
      ],
    },
  ],
  apps: [],
  modules: [],
};

const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  FileText,
  BarChart3,
  Settings,
  Calendar,
  FolderOpen,
  Tag,
  Bell,
  Printer,
  GitBranch,
  MapPin,
  Image,
  Mail,
  Languages,
  Shield,
  Terminal,
  UserPlus,
  Puzzle,
  Settings2,
  Globe,
  Users,
  ScrollText,
  StickyNote,
  ClipboardList,
  Wrench,
  Search,
  Layout,
  Boxes,
  Activity,
};

function NavIcon({ icon, color }: { icon?: string | null; color?: string }) {
  const Icon = icon ? ICON_MAP[icon] : undefined;
  if (Icon) return <Icon className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />;
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ? mapColor(color) : undefined }}
    />
  );
}

function NavLink({
  href,
  label,
  icon,
  depth = 0,
  color,
}: {
  href: string;
  label: string;
  icon?: string | null;
  depth?: number;
  color?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      style={depth > 0 ? { paddingLeft: 12 + depth * 8 } : undefined}
      className={[
        // Frappe sidebar item: 13px, rounded-lg, active = white pill w/ shadow
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-card text-foreground shadow-[var(--shadow-xs)] dark:bg-zinc-800"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
      ].join(" ")}
    >
      <NavIcon icon={icon} color={color} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function mapColor(color: string): string {
  const palette: Record<string, string> = {
    blue: "#3b82f6",
    green: "#22c55e",
    purple: "#a855f7",
    yellow: "#eab308",
    red: "#ef4444",
    orange: "#f97316",
    cyan: "#06b6d4",
    gray: "#6b7280",
  };
  return palette[color?.toLowerCase()] ?? color ?? "#6b7280";
}

function NavSection({ section, depth = 0 }: { section: DeskNavigation["sections"][number]; depth?: number }) {
  const pathname = usePathname();
  const sectionActive = section.href
    ? pathname === section.href || pathname.startsWith(section.href + "/")
    : false;

  return (
    <div className="mb-4">
      {section.href ? (
        <Link
          href={section.href}
          className={[
            "mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider",
            sectionActive
              ? "text-primary"
              : "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300",
          ].join(" ")}
        >
          {section.label}
        </Link>
      ) : (
        <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {section.label}
        </div>
      )}
      <nav className="flex flex-col gap-0.5">
        {section.items.map((item) =>
          item.type === "link" ? (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} color={item.color} depth={depth} />
          ) : (
            <NavSection key={item.id} section={item} depth={depth + 1} />
          ),
        )}
      </nav>
    </div>
  );
}

const noopSubscribe = () => () => {};

type ThemeChoice = "light" | "dark" | "system";
const THEME_ICONS = { dark: Moon, light: Sun, system: Monitor } as const;
const DESK_THEME_NAMES = { system: "Automatic", dark: "Dark", light: "Light" } as const;
const THEME_OPTIONS = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
] as const;

/** phones: the sidebar is an overlay, so it starts closed and closes after each navigation (Desk: sidebar.js on mobile) */
function useCloseSidebarOnMobileNavigation(path: string) {
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) useUIStore.getState().setSidebarOpen(false);
  }, [path]);
  // narrowing the window to phone width closes it too, so it doesn't cover the page as an overlay
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => e.matches && useUIStore.getState().setSidebarOpen(false);
    narrow.addEventListener("change", onChange);
    return () => narrow.removeEventListener("change", onChange);
  }, []);
}

/** A browser with no stored theme choice (new device) takes the user's saved User.desk_theme, as Desk does at boot */
function useSeedThemeFromDeskUser() {
  const themeSeeded = useUIStore((s) => s.themeSeeded);
  const seedThemeFromUser = useUIStore((s) => s.seedThemeFromUser);
  const { data: deskCtx } = useDeskContext();
  const deskUser = deskCtx?.user;
  useEffect(() => {
    if (themeSeeded || !deskUser) return;
    let cancelled = false;
    deskCall("frappe.client.get_value", { doctype: "User", filters: deskUser, fieldname: "desk_theme" })
      .then(({ env }) => {
        if (cancelled) return;
        const deskTheme = (env.message as { desk_theme?: string | null } | null)?.desk_theme;
        seedThemeFromUser(deskTheme);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [themeSeeded, deskUser, seedThemeFromUser]);
}

/** Desk's global shortcuts (frappe/public/js/frappe/ui/keyboard.js, desk.js, sidebar.js) */
function useGlobalShortcuts(openShortcuts: () => void) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setTheme = useUIStore((s) => s.setTheme);
  const queryClient = useQueryClient();
  useShortcuts(
    [
      { keys: "mod+k", description: "Open awesomebar", group: "Global", allowInInput: true, action: () => document.dispatchEvent(new CustomEvent("crema:command-palette")) },
      { keys: "mod+g", description: "Open global search", group: "Global", allowInInput: true, action: () => document.dispatchEvent(new CustomEvent("crema:command-palette")) },
      { keys: "mod+/", description: "Toggle sidebar", group: "Global", allowInInput: true, action: () => toggleSidebar() },
      { keys: "shift+mod+g", description: "Switch theme", group: "Global", action: () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark") },
      { keys: "shift+?", description: "Show keyboard shortcuts", group: "Global", action: () => openShortcuts() },
      {
        keys: "shift+mod+r",
        description: "Clear cache and reload",
        group: "Global",
        action: () => {
          clearDoctypeMetaCache();
          queryClient.clear();
          window.location.reload();
        },
      },
    ],
    [toggleSidebar, setTheme, queryClient, openShortcuts],
  );
}

function ReconnectingBanner() {
  const realtimeStatus = useRealtimeStatus();
  if (realtimeStatus !== "reconnecting") return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-1 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
      Reconnecting to server…
    </div>
  );
}

function SidebarToggle() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  return (
    <button
      onClick={toggleSidebar}
      className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
    >
      {sidebarOpen ? (
        <PanelLeftClose className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      ) : (
        <PanelLeftOpen className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
      )}
    </button>
  );
}

function AppSwitcher({ apps }: { apps: NonNullable<DeskNavigation["apps"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <span className="flex max-w-[40vw] items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">
          <Layout className="h-4 w-4 text-zinc-400" />
          <span className="hidden truncate sm:inline">{apps.length > 0 ? apps[0].app_title ?? apps[0].app_name : "crema"}</span>
          <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {apps.length === 0 && <DropdownMenuItem>No apps detected</DropdownMenuItem>}
        {apps.map((app) => (
          <DropdownMenuItem key={app.app_name}>
            <Layout className="mr-2 h-4 w-4" />
            {app.app_title ?? app.app_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeMenu() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  // the persisted theme is read from localStorage on the client only: the server and the first client render show
  // the default icon, the stored one after hydration (otherwise React reports a hydration mismatch)
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const ThemeIcon = THEME_ICONS[hydrated ? theme : "light"];
  // Desk saves the choice on the user (User.desk_theme) so it follows them across devices
  const pickTheme = (t: ThemeChoice) => {
    setTheme(t);
    setOpen(false);
    void deskCall("frappe.core.doctype.user.user.switch_theme", { theme: DESK_THEME_NAMES[t] }).catch(() => undefined);
  };
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <span className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex" aria-label="Theme" title="Theme">
          <ThemeIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_OPTIONS.map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => pickTheme(value)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 text-left"
          >
            <Icon className="mr-1 h-4 w-4" /> {label}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ShellHeader({ apps, onShortcuts }: { apps: NonNullable<DeskNavigation["apps"]>; onShortcuts: () => void }) {
  const { user, logout } = useAuth();
  return (
    /* Header — Frappe navbar: 48px tall, surface-base bg, outline-gray-1 border */
    <header className="sticky top-0 z-40 h-12 border-b border-[var(--border-color)] bg-[var(--bg-color)]">
      <ReconnectingBanner />
      <div className="flex h-full items-center justify-between gap-2 px-gutter">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <SidebarToggle />

          <Link href="/desk" className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layout className="h-4 w-4" />
            </div>
            <span className="hidden text-base font-semibold text-foreground sm:inline">Crema</span>
          </Link>

          <AppSwitcher apps={apps} />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-0.5">
          <CommandPalette />
          <ThemeMenu />
          <NotificationsPanel />
          {/* User menu (Desk v16 sidebar_header.js + Navbar Settings rows) */}
          <UserMenu fullName={user?.full_name} email={user?.email} onLogout={() => void logout()} onShortcuts={onShortcuts} />
        </div>
      </div>
    </header>
  );
}

export default function CremaShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const fullWidth = useUIStore((s) => s.fullWidth);
  const hydrateFullWidth = useUIStore((s) => s.hydrateFullWidth);
  const shellPath = usePathname();
  // full-screen tools (Print Format Builder): no breadcrumb row, no width cap — they bring their own header
  const fullScreen = shellPath.startsWith("/desk/print-format-builder/");
  const newLayout = useNewLayout();
  // the New layout is fluid (§ 3.4: wide screens fill with panes and columns); classic keeps Desk's 1290 cap
  const wide = fullWidth || fullScreen || newLayout;
  useCloseSidebarOnMobileNavigation(shellPath);
  useSeedThemeFromDeskUser();
  // Desk's container_fullwidth (localStorage) is read after mount so server and client markup match
  useEffect(() => {
    hydrateFullWidth();
  }, [hydrateFullWidth]);
  const { data: navigation } = useNavigation();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useGlobalShortcuts(openShortcuts);

  const sections = navigation?.sections?.length ? navigation.sections : FALLBACK_NAV.sections;
  const apps = navigation?.apps ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <ShellHeader apps={apps} onShortcuts={openShortcuts} />

      <div className="flex">
        {/* Mobile overlay — click to close sidebar */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 mt-12 bg-black/30 md:hidden"
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar — Frappe: gray-50 sidebar surface, 220px wide */}
        <aside
          className={[
            "fixed inset-y-0 left-0 z-30 mt-12 w-[var(--sidebar-width)] border-r border-[var(--border-color)] bg-[var(--navbar-bg)] transition-all duration-300 ease-in-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
          aria-label="Sidebar navigation"
          aria-hidden={!sidebarOpen}
        >
          <DeskSidebar navigation={{ ...(navigation ?? FALLBACK_NAV), sections }} />
        </aside>

        {/* Main content */}
        <main
          className={[
            "flex-1 px-gutter py-stack transition-all duration-300 ease-in-out min-w-0",
            sidebarOpen ? "md:ml-[var(--sidebar-width)]" : "ml-0",
          ].join(" ")}
          id="main-content"
        >
          {/* Desk's container: capped at its xl width (variables.scss $container-max-widths) unless "Toggle Full Width" is on */}
          <div id="main-container" data-fullwidth={wide ? "true" : "false"} className={wide ? "w-full" : "mx-auto w-full max-w-[1290px]"}>
            <SiteBanners />
            {!fullScreen && (
              <div className="mb-stack">
                <Breadcrumbs />
              </div>
            )}
            {children}
          </div>
        </main>
        <DialogHost />
        <MultiSelectHost />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </div>
  );
}
