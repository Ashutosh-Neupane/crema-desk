"use client";

/**
 * DocForm's header (Desk: frappe/public/js/frappe/form/toolbar.js): title (click to rename), indicator, who else is
 * viewing, the script's custom buttons, previous / next, print, the ⋯ menu and the primary action. On phones the custom
 * buttons and the main actions move to a bottom bar (thumb reach).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlarmClock, ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy, Copy, CopyPlus, FileCode, Link2, Loader2, MoreHorizontal, Pencil, Plus, Printer, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { INDICATOR_PILL } from "@/lib/list/indicator";
import type { CustomButton } from "@/lib/form/FormController";
import type { Transition } from "@/lib/form/workflow";
import type { PrimaryAction } from "@/components/form/docFormRules";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const enc = encodeURIComponent;
const btnCls = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
const iconBtn = "rounded-lg border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800";
const darkBtn = "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

/** custom buttons: ungrouped as buttons, grouped as dropdowns (Desk "Create ▾") */
export function CustomButtons({ buttons }: { buttons: CustomButton[] }) {
  const groups = new Map<string, CustomButton[]>();
  for (const b of buttons) {
    const g = b.group ?? "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(b);
  }
  return (
    <>
      {[...groups.entries()].map(([g, btns]) =>
        g ? (
          <DropdownMenu key={g}>
            <DropdownMenuTrigger className={`inline-flex items-center gap-1 ${btnCls}`}>
              {g} <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {btns.map((b) => (
                <DropdownMenuItem key={b.label} onClick={() => void b.action()}>{b.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          btns.map((b) => (
            // a script that adds btn-primary to its button (Desk) gets the dark primary style
            <button key={b.label} type="button" onClick={() => void b.action()} className={b.primary ? `rounded-lg border border-transparent px-3 py-2 text-sm ${darkBtn}` : btnCls}>
              {b.label}
            </button>
          ))
        ),
      )}
    </>
  );
}

export interface MainActionsProps {
  canAmend: boolean;
  onAmend: () => void;
  /** workflow transitions replace the primary button (Desk workflow setup_btn) */
  transitions: Transition[] | null;
  wfBusy: boolean;
  onTransition: (t: Transition) => void;
  onWorkflowHelp: () => void;
  primary: PrimaryAction | null;
  busy: boolean;
  onPrimary: (p: PrimaryAction) => void;
}

export function MainActions({ canAmend, onAmend, transitions, wfBusy, onTransition, onWorkflowHelp, primary, busy, onPrimary }: MainActionsProps) {
  return (
    <>
      {canAmend && (
        <button type="button" onClick={onAmend} className={`rounded-lg px-4 py-2 text-sm font-medium ${darkBtn}`}>Amend</button>
      )}
      {transitions && (
        <DropdownMenu>
          <DropdownMenuTrigger disabled={wfBusy} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${darkBtn}`}>
            {wfBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Actions <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {transitions.map((t) => (
              <DropdownMenuItem key={`${t.action}|${t.next_state}`} onClick={() => onTransition(t)}>
                {t.action}
              </DropdownMenuItem>
            ))}
            {/* Desk FormStates.setup_help */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onWorkflowHelp}>Help</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {primary && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onPrimary(primary)}
          className={[
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60",
            primary.kind === "cancel" ? "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100" : darkBtn,
          ].join(" ")}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {primary.label}
        </button>
      )}
    </>
  );
}

export interface MoreMenuProps {
  doctype: string;
  name: string;
  can: (perm: string) => boolean;
  allowCopy: boolean;
  canRename: boolean;
  canDelete: boolean;
  isSystemManager: boolean;
  developerMode: boolean;
  onDuplicate: () => void;
  onReload: () => void;
  onDialog: (d: "rename" | "links" | "remind") => void;
  onCopyJson: () => void;
  onDelete: () => void;
}

function MoreMenu({ doctype, name, can, allowCopy, canRename, canDelete, isSystemManager, developerMode, onDuplicate, onReload, onDialog, onCopyJson, onDelete }: MoreMenuProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="More actions" className={iconBtn}>
        <MoreHorizontal className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {can("create") && <DropdownMenuItem onClick={() => router.push(`${doctypeUrl(doctype)}/new`)}><Plus className="h-4 w-4" /> New {doctype}</DropdownMenuItem>}
        {can("create") && allowCopy && <DropdownMenuItem onClick={onDuplicate}><CopyPlus className="h-4 w-4" /> Duplicate</DropdownMenuItem>}
        <DropdownMenuItem onClick={onReload}><RefreshCw className="h-4 w-4" /> Reload</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/desk/print/${enc(doctype)}/${enc(name)}`)}><Printer className="h-4 w-4" /> Print</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDialog("links")}><Link2 className="h-4 w-4" /> Links</DropdownMenuItem>
        {canRename && <DropdownMenuItem onClick={() => onDialog("rename")}><Pencil className="h-4 w-4" /> Rename</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => onDialog("remind")}><AlarmClock className="h-4 w-4" /> Remind Me</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { void navigator.clipboard.writeText(name); toast.success("Copied"); }}><Copy className="h-4 w-4" /> Copy name</DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyJson}><ClipboardCopy className="h-4 w-4" /> Copy to Clipboard</DropdownMenuItem>
        {isSystemManager && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/desk/customize-form/Customize%20Form?doc_type=${enc(doctype)}`)}><Settings2 className="h-4 w-4" /> Customize</DropdownMenuItem>
            {developerMode && <DropdownMenuItem onClick={() => router.push(`/desk/doctype/${enc(doctype)}`)}><FileCode className="h-4 w-4" /> Edit DocType</DropdownMenuItem>}
          </>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Viewers({ viewers }: { viewers: string[] }) {
  if (!viewers.length) return null;
  const label = `Also viewing: ${viewers.join(", ")}`;
  return (
    <span className="flex items-center -space-x-1.5" aria-label={label} title={label}>
      {viewers.slice(0, 4).map((u) => (
        <span key={u} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-[10px] font-semibold uppercase text-emerald-800 dark:border-zinc-950 dark:bg-emerald-900 dark:text-emerald-200">
          {u.charAt(0)}
        </span>
      ))}
    </span>
  );
}

export function DocFormHeader({
  title,
  onRename,
  indicator,
  viewers,
  phone,
  saved,
  showNav,
  onNavigate,
  buttons,
  more,
  actions,
}: {
  title: string;
  /** set when the title is clickable to rename */
  onRename?: () => void;
  indicator: [string, string] | null;
  viewers: string[];
  phone: boolean;
  /** the doc is saved (not new): print, ⋯ menu */
  saved: boolean;
  showNav: boolean;
  onNavigate: (prev: boolean) => void;
  buttons: CustomButton[];
  more: MoreMenuProps;
  actions: MainActionsProps;
}) {
  return (
    // sticks under the navbar so actions stay reachable on long forms
    <div className="sticky top-12 z-20 -mx-gutter flex flex-wrap items-center gap-x-3 gap-y-2 bg-[var(--bg-color)]/95 px-gutter py-2 backdrop-blur">
      <h1 className="min-w-0 truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {onRename ? (
          <button type="button" onClick={onRename} title="Rename" className="max-w-full truncate rounded px-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {title}
          </button>
        ) : (
          title
        )}
      </h1>
      {indicator && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${INDICATOR_PILL[indicator[1]] ?? INDICATOR_PILL.gray}`}>{indicator[0]}</span>}
      <Viewers viewers={viewers} />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!phone && <CustomButtons buttons={buttons} />}
        {showNav && (
          <span className="inline-flex">
            <button type="button" onClick={() => onNavigate(true)} aria-label="Previous document" title="Previous document (⇧⌘<)" className="rounded-l-lg border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <ChevronLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
            </button>
            <button type="button" onClick={() => onNavigate(false)} aria-label="Next document" title="Next document (⇧⌘>)" className="-ml-px rounded-r-lg border border-zinc-200 bg-white p-2 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <ChevronRight className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
            </button>
          </span>
        )}
        {saved && (
          <Link href={`/desk/print/${enc(more.doctype)}/${enc(more.name)}`} aria-label="Print" title="Print (⌘P)" className={iconBtn}>
            <Printer className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
          </Link>
        )}
        {saved && <MoreMenu {...more} />}
        {!phone && <MainActions {...actions} />}
      </div>
    </div>
  );
}

/** phones: custom buttons and the main actions in a bar at the bottom */
export function DocFormBottomBar({ buttons, actions }: { buttons: CustomButton[]; actions: MainActionsProps }) {
  return (
    <div role="toolbar" aria-label="Document actions" className="fixed inset-x-0 bottom-0 z-30 mb-0 flex items-center gap-2 border-t border-zinc-200 bg-[var(--bg-color)]/95 px-gutter pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <CustomButtons buttons={buttons} />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <MainActions {...actions} />
      </div>
    </div>
  );
}
