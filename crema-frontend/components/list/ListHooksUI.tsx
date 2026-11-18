"use client";

/**
 * What an app's listview_settings adds to the list (Desk list/list_view.js, ui/page.js):
 *  - ToolbarButtons: page.add_inner_button(label, action, group) — grouped ones share a dropdown
 *  - RowButtons: settings.button ({ show, get_label, get_description, action }) and settings.dropdown_button
 *    ({ get_label, buttons: [{ show?, get_label, get_description?, action }] }) per row (generate_button_html,
 *    generate_dropdown_html)
 */
import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import type { PageItem } from "@/lib/list/listviewShim";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch (e) {
    console.warn("listview_settings:", e);
    return fallback;
  }
};
const text = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").trim();
const btn = "inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function ToolbarButtons({ items }: { items: PageItem[] }) {
  if (!items.length) return null;
  const groups = [...new Set(items.filter((i) => i.group).map((i) => i.group as string))];
  return (
    <>
      {items
        .filter((i) => !i.group)
        .map((i) => (
          <button key={i.label} type="button" onClick={() => safe(i.action, undefined)} className={btn}>
            {i.label}
          </button>
        ))}
      {groups.map((g) => (
        <DropdownMenu key={g}>
          <DropdownMenuTrigger className={btn}>
            {g} <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <DropdownMenuItem key={i.label} onClick={() => safe(i.action, undefined)}>
                  {i.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </>
  );
}

type Fn = (...a: unknown[]) => unknown;
interface ButtonSetting {
  show?: Fn;
  get_label?: Fn | string;
  get_description?: Fn;
  action?: Fn;
}

export function RowButtons({ settings, doc }: { settings: Record<string, unknown>; doc: Record<string, unknown> & { name: string } }) {
  const button = settings.button as ButtonSetting | undefined;
  const dropdown = settings.dropdown_button as { get_label?: string; buttons?: ButtonSetting[] } | undefined;
  const call = (b: ButtonSetting, name: keyof ButtonSetting, fallback: unknown) => {
    const f = b[name];
    return typeof f === "function" ? safe(() => f.call(b, doc), fallback) : (f ?? fallback);
  };
  const showButton = !!button && !!call(button, "show", true);
  const items = (dropdown?.buttons ?? []).map((b, i) => ({ b, i })).filter(({ b }) => !b.show || call(b, "show", false));
  return (
    <span className="inline-flex items-center gap-1.5">
      {showButton && button && (
        <button
          type="button"
          data-row-button={doc.name}
          title={text(call(button, "get_description", ""))}
          onClick={(e) => {
            e.stopPropagation();
            call(button, "action", undefined);
          }}
          className="max-w-[10rem] truncate rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {text(call(button, "get_label", ""))}
        </button>
      )}
      {dropdown && items.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
            {text(dropdown.get_label)} <ChevronsUpDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map(({ b, i }) => (
              <DropdownMenuItem key={i} title={text(call(b, "get_description", ""))} onClick={() => call(b, "action", undefined)}>
                {text(typeof b.get_label === "function" ? call(b, "get_label", "") : b.get_label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}
