"use client";

/**
 * The list's title row (list_view.js + ui/page.js): title and page indicator, saved layouts, the view switcher,
 * an app's toolbar buttons, refresh, the settings menu, and Add / bulk Actions.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Settings2 } from "lucide-react";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import type { Row } from "@/lib/list/api";
import type { PageItem, PageState } from "@/lib/list/listviewShim";
import { DEFAULT_LAYOUT, type ListLayout } from "@/lib/list/layouts";
import { INDICATOR_PILL } from "@/lib/list/indicator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import BulkActions from "@/components/list/BulkActions";
import { LayoutMenu } from "@/components/list/Layouts";
import { ToolbarButtons } from "@/components/list/ListHooksUI";
import { listViews, runItem, type ListSettings } from "@/components/list/listModel";

const enc = encodeURIComponent;
const iconBtn = "rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

function ViewSwitcher({ views }: { views: Array<{ id: string; label: string; href: string }> }) {
  if (views.length <= 1) return null;
  return (
    <nav aria-label="Views" className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {views.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          prefetch={false}
          aria-current={v.id === "list" ? "page" : undefined}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${v.id === "list" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

function PageTitle({ doctype, pageState }: { doctype: string; pageState: PageState }) {
  return (
    <>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{pageState.title || doctype}</h1>
      {/* page.set_indicator from an app's onload / refresh */}
      {pageState.indicator && <span data-page-indicator className={`rounded-full px-2 py-0.5 text-xs font-medium ${INDICATOR_PILL[pageState.indicator.color] ?? INDICATOR_PILL.gray}`}>{pageState.indicator.label}</span>}
    </>
  );
}

function RefreshButton({ onClick, spinning }: { onClick: () => void; spinning: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label="Refresh" className={iconBtn}>
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
    </button>
  );
}

function ListSettingsMenu({ doctype, meta, systemManager, appItems, onListSettings, onExport }: { doctype: string; meta: DocTypeMeta; systemManager: boolean; appItems: PageItem[]; onListSettings: () => void; onExport: () => void }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="List settings" className={iconBtn}>
        <Settings2 className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => router.push(`/desk/customize Form/Customize Form?doc_type=${enc(doctype)}`)}>Customize</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/desk/doctype/${enc(doctype)}`)}>Edit DocType</DropdownMenuItem>
        <DropdownMenuItem onClick={onListSettings}>List settings</DropdownMenuItem>
        {!!meta.allow_import && <DropdownMenuItem onClick={() => router.push(`/desk/data-import?doctype=${enc(doctype)}`)}>Import</DropdownMenuItem>}
        <DropdownMenuItem onClick={onExport}>Export</DropdownMenuItem>
        {/* Desk list_view.js: System Manager only */}
        {systemManager && <DropdownMenuItem onClick={() => router.push(`/desk/user-permission?allow=${enc(doctype)}`)}>User Permissions</DropdownMenuItem>}
        {systemManager && <DropdownMenuItem onClick={() => router.push(`/desk/permission-manager/${enc(doctype)}`)}>Role Permissions Manager</DropdownMenuItem>}
        {/* page.add_menu_item from the app's listview_settings */}
        {appItems.length > 0 && <DropdownMenuSeparator />}
        {appItems.map((m) => (
          <DropdownMenuItem key={m.label} onClick={() => runItem(m.action)}>
            {m.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddButton({ doctype, onAdd, disabled }: { doctype: string; onAdd: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      <Plus className="h-4 w-4" /> Add {doctype}
    </button>
  );
}

export function ListHeader({
  doctype,
  meta,
  settings,
  pageState,
  user,
  systemManager,
  layouts,
  onCreateLayout,
  onManageLayouts,
  refresh,
  fetching,
  onListSettings,
  onExport,
  selectedRows,
  listFields,
  onBulkDone,
  onAdd,
}: {
  doctype: string;
  meta: DocTypeMeta;
  settings: ListSettings;
  pageState: PageState;
  user: string;
  systemManager: boolean;
  layouts: { layouts: ListLayout[]; layoutsLoaded: boolean; activeLayout: string | null; selectLayout: (name: string) => void };
  onCreateLayout: () => void;
  onManageLayouts: () => void;
  refresh: () => void;
  fetching: boolean;
  onListSettings: () => void;
  onExport: () => void;
  selectedRows: Row[];
  listFields: DocField[];
  onBulkDone: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <PageTitle doctype={doctype} pageState={pageState} />
      {layouts.layoutsLoaded && <LayoutMenu layouts={layouts.layouts} active={layouts.activeLayout ?? DEFAULT_LAYOUT} user={user} onSelect={layouts.selectLayout} onCreate={onCreateLayout} onManage={onManageLayouts} />}
      <ViewSwitcher views={listViews(meta, doctype)} />
      <div className="ml-auto flex items-center gap-2">
        <ToolbarButtons items={pageState.inner} />
        <RefreshButton onClick={refresh} spinning={fetching} />
        <ListSettingsMenu doctype={doctype} meta={meta} systemManager={systemManager} appItems={pageState.menu} onListSettings={onListSettings} onExport={onExport} />
        {selectedRows.length > 0 ? (
          <BulkActions meta={meta} extraActions={pageState.actions} rows={selectedRows} columns={listFields.map((f) => ({ fieldname: f.fieldname, label: f.label ?? f.fieldname, fieldtype: f.fieldtype }))} onDone={onBulkDone} />
        ) : (
          // the app's listview_settings (primary_action) must be in before Add means the same as in Desk
          !meta.istable && <AddButton doctype={doctype} onAdd={onAdd} disabled={settings === undefined} />
        )}
      </div>
    </div>
  );
}
