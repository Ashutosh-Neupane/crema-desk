"use client";

/**
 * The form's tab bar (Desk form/tab.js): one tab per Tab Break, a red mark on tabs with errors. The New layout shows the
 * first `shown` tabs (and the open one) and puts the rest in a "More" menu, with the number of errors per tab.
 */
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

interface Tab {
  fieldname: string;
  label?: string | null;
}

export default function FormTabs({
  tabs,
  current,
  onSelect,
  errors,
  cards,
  compact,
  shown = 4,
}: {
  tabs: Tab[];
  current: string | undefined;
  onSelect: (fieldname: string) => void;
  /** fields with an error on the tab (0: none) */
  errors: (fieldname: string) => number;
  /** New layout: overflow menu and error counts */
  cards: boolean;
  compact: boolean;
  shown?: number;
}) {
  const overflow = cards && tabs.length > shown + 1 ? tabs.slice(shown).filter((t) => t.fieldname !== current) : [];
  const inMenu = new Set(overflow.map((t) => t.fieldname));
  const inBar = tabs.filter((t) => !inMenu.has(t.fieldname));
  return (
    <div className={`flex items-center gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 ${compact ? "" : cards ? "px-1" : "px-3"}`} role="tablist">
      {inBar.map((t) => {
        const n = errors(t.fieldname);
        return (
          <button
            key={t.fieldname}
            type="button"
            role="tab"
            aria-selected={t.fieldname === current}
            onClick={() => onSelect(t.fieldname)}
            className={[
              "relative whitespace-nowrap px-3 py-3 text-sm transition-colors",
              t.fieldname === current
                ? "font-medium text-zinc-900 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-zinc-900 dark:text-zinc-100 dark:after:bg-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            {t.label}
            {n > 0 &&
              (cards ? (
                <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white" aria-label={`${n} with errors`}>
                  {n}
                </span>
              ) : (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
              ))}
          </button>
        );
      })}
      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 whitespace-nowrap px-3 py-3 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            More {overflow.some((t) => errors(t.fieldname) > 0) && <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {overflow.map((t) => (
              <DropdownMenuItem key={t.fieldname} onClick={() => onSelect(t.fieldname)}>
                {t.label}
                {errors(t.fieldname) > 0 && <span className="ml-auto text-xs text-red-600">{errors(t.fieldname)}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
