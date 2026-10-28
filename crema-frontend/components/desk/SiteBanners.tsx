"use client";

/**
 * Site-state banners, transcribed from Frappe's public/js/frappe/ui/site_banners.js: the read-only-mode banner
 * (boot.read_only) and the impersonation banner (boot.user.impersonated_by), shown once at the top of the
 * content column. Desk has no "stop" button here — an impersonated session ends with Log out.
 */
import { useDeskContext } from "@/lib/hooks/useDeskContext";

export default function SiteBanners() {
  const { data: ctx } = useDeskContext();
  if (!ctx) return null;
  const banners: { key: string; cls: string; message: string }[] = [];
  if (ctx.boot?.read_only) {
    banners.push({
      key: "read-only",
      cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
      message: "This site is in read-only mode - it is undergoing maintenance or being updated.",
    });
  }
  if (ctx.impersonated_by) {
    banners.push({
      key: "impersonating",
      cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
      message: `You are impersonating ${ctx.user}.`,
    });
  }
  if (!banners.length) return null;
  return (
    <div className="site-banners -mx-gutter -mt-stack mb-stack" data-testid="site-banners">
      {banners.map((b) => (
        <div key={b.key} role="status" data-banner={b.key} className={`${b.cls} px-4 py-2.5 text-sm`}>
          {b.message}
        </div>
      ))}
    </div>
  );
}
