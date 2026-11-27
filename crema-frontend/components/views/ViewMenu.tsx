"use client";

/**
 * The view switcher (Desk v16 list_view_select.js): one button naming the current view, opening the views this
 * DocType has, then its Kanban boards and "New Kanban Board". Used by the list and every view's header.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronsUpDown, GanttChart, Image as ImageIcon, LayoutList, Network, Plus, SquareKanban, Table2, Folder, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { deskCall } from "@/lib/frappe/form";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { doctypeUrl } from "@/lib/navigation/deskUrl";
import { listViews } from "@/components/list/listModel";
import type { DocTypeMeta } from "@/lib/frappe/types";

const ICONS: Record<string, LucideIcon> = { list: LayoutList, report: Table2, calendar: Calendar, gantt: GanttChart, image: ImageIcon, tree: Network, kanban: SquareKanban, home: Folder };

function useKanbanBoards(doctype: string, enabled: boolean) {
  return useQuery({
    queryKey: ["kanban-boards", doctype],
    queryFn: async () => ((await deskCall("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards", { doctype })).env.message as Array<{ name: string }>) ?? [],
    enabled,
    staleTime: 60_000,
  });
}

/** `current`: list / report / calendar / gantt / image / tree / kanban; `label` overrides the button text (a board's name) */
export function ViewMenu({ meta, doctype, current, label }: { meta: DocTypeMeta | undefined; doctype: string; current: string; label?: string }) {
  const router = useRouter();
  const { data: ctx } = useDeskContext();
  const [opened, setOpened] = useState(false);
  const canReport = ctx?.perms?.can_get_report ? (ctx.perms.can_get_report as string[]).includes(doctype) : undefined;
  const views = listViews(meta, doctype, { canReport });
  const kanban = doctype !== "File" && !meta?.istable;
  const { data: boards = [] } = useKanbanBoards(doctype, opened && kanban);
  if (!meta) return null;
  const Icon = ICONS[current] ?? LayoutList;
  const text = label ?? views.find((v) => v.id === current)?.label ?? (current === "kanban" ? "Kanban" : "List");
  const base = doctypeUrl(doctype);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`View: ${text}`}
        onClick={() => setOpened(true)}
        className="inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-2.5 text-sm text-[var(--ink-default)] hover:bg-[var(--surface-hover)]"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
        <span className="truncate">{text}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[70vh] w-56 overflow-y-auto">
        {views.map((v) => {
          const VIcon = ICONS[v.id] ?? LayoutList;
          return (
            <DropdownMenuItem key={v.id} aria-current={v.id === current ? "page" : undefined} onClick={() => router.push(v.href)} className={v.id === current ? "font-medium" : ""}>
              <VIcon className="mr-2 h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" /> {v.label}
            </DropdownMenuItem>
          );
        })}
        {kanban && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Kanban</DropdownMenuLabel>
            {boards.map((b) => (
              <DropdownMenuItem key={b.name} aria-current={current === "kanban" && label === b.name ? "page" : undefined} onClick={() => router.push(`${base}/view/kanban/${encodeURIComponent(b.name)}`)}>
                <SquareKanban className="mr-2 h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" /> <span className="truncate">{b.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => router.push(`${base}/view/kanban?new=1`)}>
              <Plus className="mr-2 h-3.5 w-3.5 text-[var(--ink-muted)]" aria-hidden="true" /> New Kanban board
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
