"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/frappe/auth";
import { useUIStore } from "@/lib/stores/ui.store";
import { useNavigation } from "@/lib/hooks/useNavigation";
import CommandPalette from "@/components/CommandPalette";
import DeskSidebar from "@/components/DeskSidebar";
import DialogHost from "@/components/desk/DialogHost";
import MultiSelectHost from "@/components/desk/MultiSelectHost";
import ShortcutsDialog from "@/components/desk/ShortcutsDialog";
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

export default function TrevoShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, theme, setTheme } = useUIStore();
  const { data: navigation } = useNavigation();
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const realtimeStatus = useRealtimeStatus();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  // Desk saves the choice on the user (User.desk_theme) so it follows them across devices
  const pickTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    setThemeMenuOpen(false);
    void deskCall("frappe.core.doctype.user.user.switch_theme", { theme: t === "system" ? "Automatic" : t === "dark" ? "Dark" : "Light" }).catch(() => undefined);
  };
  const queryClient = useQueryClient();
  // Desk's global shortcuts (frappe/public/js/frappe/ui/keyboard.js, desk.js, sidebar.js)
  useShortcuts(
    [
      { keys: "mod+k", description: "Open awesomebar", group: "Global", allowInInput: true, action: () => document.dispatchEvent(new CustomEvent("trevo:command-palette")) },
      { keys: "mod+g", description: "Open global search", group: "Global", allowInInput: true, action: () => document.dispatchEvent(new CustomEvent("trevo:command-palette")) },
      { keys: "mod+/", description: "Toggle sidebar", group: "Global", allowInInput: true, action: () => toggleSidebar() },
      { keys: "shift+mod+g", description: "Switch theme", group: "Global", action: () => setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark") },
      { keys: "shift+?", description: "Show keyboard shortcuts", group: "Global", action: () => setShortcutsOpen(true) },
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
    [toggleSidebar, setTheme, queryClient],
  );

  const sections = navigation?.sections?.length ? navigation.sections : FALLBACK_NAV.sections;
  const apps = navigation?.apps ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      {/* Header — Frappe navbar: 48px tall, surface-base bg, outline-gray-1 border */}
      <header className="sticky top-0 z-40 h-12 border-b border-[var(--border-color)] bg-[var(--bg-color)]">
        {realtimeStatus === "reconnecting" && (
          <div className="flex items-center justify-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-1 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
            Reconnecting to server…
          </div>
        )}
        <div className="flex h-full items-center justify-between px-3">
          <div className="flex items-center gap-2">
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

            <Link href="/desk" className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Layout className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold text-foreground">Trevo</span>
            </Link>

            <DropdownMenu open={appMenuOpen} onOpenChange={setAppMenuOpen}>
              <DropdownMenuTrigger>
                <span className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors">
                  <Layout className="h-4 w-4 text-zinc-400" />
                  {apps.length > 0 ? apps[0].app_title ?? apps[0].app_name : "trevo"}
                  <ChevronsUpDown className="h-3 w-3 text-zinc-400" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {apps.length === 0 && (
                  <DropdownMenuItem>No apps detected</DropdownMenuItem>
                )}
                {apps.map((app) => (
                  <DropdownMenuItem key={app.app_name}>
                    <Layout className="mr-2 h-4 w-4" />
                    {app.app_title ?? app.app_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-0.5">
            <CommandPalette />

            {/* Theme switcher */}
            <DropdownMenu open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
              <DropdownMenuTrigger>
                <span className="rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors inline-flex" aria-label="Theme" title="Theme">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  ) : theme === "light" ? (
                    <Sun className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  ) : (
                    <Monitor className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <button
                  onClick={() => pickTheme("light")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 text-left"
                >
                  <Sun className="mr-1 h-4 w-4" /> Light
                </button>
                <button
                  onClick={() => pickTheme("dark")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 text-left"
                >
                  <Moon className="mr-1 h-4 w-4" /> Dark
                </button>
                <button
                  onClick={() => pickTheme("system")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 text-left"
                >
                  <Monitor className="mr-1 h-4 w-4" /> System
                </button>
              </DropdownMenuContent>
            </DropdownMenu>

            <NotificationsPanel />

            {/* User menu (Desk v16 sidebar_header.js + Navbar Settings rows) */}
            <UserMenu fullName={user?.full_name} email={user?.email} onLogout={() => void logout()} onShortcuts={openShortcuts} />
          </div>
        </div>
      </header>

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
            "flex-1 p-4 transition-all duration-300 ease-in-out min-w-0",
            sidebarOpen ? "md:ml-[var(--sidebar-width)]" : "ml-0",
          ].join(" ")}
          id="main-content"
        >
          <div className="mb-4">
            <Breadcrumbs />
          </div>
          {children}
        </main>
        <DialogHost />
        <MultiSelectHost />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </div>
    </div>
  );
}

