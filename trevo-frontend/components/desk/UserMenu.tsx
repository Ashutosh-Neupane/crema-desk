"use client";

/**
 * The user menu (Desk v16: ui/sidebar/sidebar_header.js + ui/toolbar/toolbar.js): My Settings, Session Defaults,
 * Reload (frappe.ui.toolbar.clear_cache), View Website, Apps, then the site's own rows from Navbar Settings
 * (settings_dropdown, then help_dropdown under Help) and Log out. Navbar rows are a route or a stored JS action
 * with an optional `condition`; both run in the desk runtime like Desk's frappe.utils.eval, with
 * frappe.ui.toolbar.show_about / setup_session_defaults / clear_cache / show_shortcuts wired to Trevo.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Globe, LayoutGrid, LogOut, RotateCcw, Settings2, User } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import SessionDefaultsDialog from "@/components/desk/SessionDefaultsDialog";
import AboutDialog from "@/components/desk/AboutDialog";
import { createRuntime } from "@/lib/desk-runtime";
import { clearDoctypeMetaCache } from "@/lib/frappe/doctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";

interface NavbarItem {
  item_label?: string;
  item_type?: string;
  action?: string | null;
  route?: string | null;
  hidden?: 0 | 1;
  condition?: string | null;
}
interface ShellSettings {
  navbar_settings: { settings_dropdown?: NavbarItem[]; help_dropdown?: NavbarItem[] } | null;
}

/** frappe.ui.toolbar.clear_cache: the server's boot cache and the client caches, then a reload */
export async function clearDeskCache(qc: ReturnType<typeof useQueryClient>) {
  clearDoctypeMetaCache();
  qc.clear();
  await fetch("/api/desk/shell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear-cache" }), credentials: "include" }).catch(() => undefined);
  window.location.reload();
}

export default function UserMenu({
  fullName,
  email,
  onLogout,
  onShortcuts,
}: {
  fullName?: string;
  email?: string;
  onLogout: () => void;
  onShortcuts: () => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: ctx } = useDeskContext();
  const [open, setOpen] = useState(false);
  const [sessionDefaults, setSessionDefaults] = useState(false);
  const [about, setAbout] = useState(false);

  const { data: shell } = useQuery<ShellSettings>({
    queryKey: ["desk-shell"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch("/api/desk/shell", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load navbar settings");
      return res.json();
    },
  });

  // Desk evaluates navbar conditions/actions against the real `frappe`; so do we
  const rt = useMemo(() => {
    if (!ctx) return null;
    const r = createRuntime({ ...ctx, navigate: (href) => router.push(href) });
    Object.assign((r.frappe.ui as unknown as { toolbar: Record<string, unknown> }).toolbar, {
      show_about: () => setAbout(true),
      setup_session_defaults: () => setSessionDefaults(true),
      clear_cache: () => void clearDeskCache(qc),
      show_shortcuts: () => onShortcuts(),
    });
    return r;
  }, [ctx, router, qc, onShortcuts]);

  const visible = (rows?: NavbarItem[]) => (rows ?? []).filter((i) => !i.hidden && i.item_label && (!i.condition || !!rt?.evalExpr(i.condition, `navbar condition: ${i.item_label}`)));
  const siteRows = visible(shell?.navbar_settings?.settings_dropdown);
  const helpRows = visible(shell?.navbar_settings?.help_dropdown);

  const go = (route: string) => {
    if (/^https?:\/\//.test(route)) window.open(route, "_blank", "noopener");
    // /app/… and /desk/<slug>/… are resolved by the Desk-URL route (app/(desk)/desk/[slug])
    else router.push(route.replace(/^\/app(\/|$)/, "/desk$1"));
  };
  const run = (item: NavbarItem) => {
    setOpen(false);
    if (item.item_type === "Route" && item.route) return go(item.route);
    if (item.action && !rt?.evalScript(item.action, `navbar action: ${item.item_label}`)) toast.error(`"${item.item_label}" isn't available in Trevo yet`);
  };
  const close = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger>
          <span className="flex items-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="User menu">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {(fullName?.[0] ?? email?.[0] ?? "U").toUpperCase()}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <div className="font-medium text-zinc-900 dark:text-zinc-100">{fullName || email || "User"}</div>
            <div className="truncate text-xs text-zinc-500">{email}</div>
          </div>
          <div className="py-1">
            <DropdownMenuItem onClick={close(() => router.push(`/desk/doctype/User/${encodeURIComponent(ctx?.user ?? email ?? "")}`))}>
              <User className="h-4 w-4" /> My Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => setSessionDefaults(true))}>
              <Settings2 className="h-4 w-4" /> Session Defaults
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => void clearDeskCache(qc))}>
              <RotateCcw className="h-4 w-4" /> Reload
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => window.open(`${process.env.NEXT_PUBLIC_FRAPPE_BASE_URL ?? ""}/`, "_blank", "noopener"))}>
              <Globe className="h-4 w-4" /> View Website
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => router.push("/desk"))}>
              <LayoutGrid className="h-4 w-4" /> Apps
            </DropdownMenuItem>
            {siteRows.map((item, i) => (
              <DropdownMenuItem key={`s-${i}-${item.item_label}`} onClick={() => run(item)}>
                {item.item_label}
              </DropdownMenuItem>
            ))}
          </div>
          {helpRows.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Help</div>
              {helpRows.map((item, i) => (
                <DropdownMenuItem key={`h-${i}-${item.item_label}`} onClick={() => run(item)}>
                  {item.item_label}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={close(onLogout)} className="text-red-600 focus:text-red-600">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SessionDefaultsDialog open={sessionDefaults} onClose={() => setSessionDefaults(false)} isSystemManager={!!ctx?.roles?.includes("System Manager")} />
      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </>
  );
}
