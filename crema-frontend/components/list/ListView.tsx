"use client";

/**
 * Desk list view (frappe/public/js/frappe/list/list_view.js), rebuilt:
 *  - columns: title (title_field / name) · status indicator · in_list_view fields · updated
 *  - indicator from the app's own listview_settings.get_indicator (__list_js)
 *  - one filter model: ID/title search, inline standard filters, filter editor,
 *    removable chips; synced to the URL (?status=Draft or ?filters=[…])
 *  - sort, group-by counts, page size + load more, bulk actions (components/list/BulkActions)
 *  - only the views that make sense for the DocType; quick entry for New when allowed
 * State lives in hooks next to it (useListLayouts → useSavedListState → useListFilters, useListColumns, useListRows,
 * useListNavigation), pure helpers in listModel.ts, and the UI in ListHeader / ListFilterBar / ListRows / ListFooter.
 */
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDoctype } from "@/lib/hooks/useDoctype";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { useShortcuts } from "@/lib/shortcuts";
import { useListSettings } from "@/lib/list/useListSettings";
import { lvsKey } from "@/lib/list/useListViewSettings";
import type { DocTypeMeta } from "@/lib/frappe/types";
import QuickEntry from "@/components/form/QuickEntry";
import ExportDialog from "@/components/list/ExportDialog";
import ListSettingsDialog from "@/components/list/ListSettingsDialog";
import { docHref, newDocHref, rowHref, standardFiltersOf } from "@/components/list/listModel";
import { useListLayouts } from "@/components/list/useListLayouts";
import { useListColumns, useListViewConfig } from "@/components/list/useListColumns";
import { useListRows, useListviewHooks, useSelection } from "@/components/list/useListRows";
import { useAddAction, useListRedirects } from "@/components/list/useListNavigation";
import { ListHeader } from "@/components/list/ListHeader";
import { ActiveFilters, ListFilterBar } from "@/components/list/ListFilterBar";
import { ListBody } from "@/components/list/ListBody";
import type { RowContext } from "@/components/list/ListRows";
import { ListLayoutDialogs, type LayoutDialogState } from "@/components/list/ListLayoutDialogs";
import { ListFacetsPane } from "@/components/list/ListFacetsPane";
import { ListPreviewPane } from "@/components/list/ListPreviewPane";
import { useListPreview } from "@/components/list/useListPreview";
import { useListKeys } from "@/components/list/useListKeys";
import { usePane } from "@/lib/ui/pane";
import { ListPanes, PreviewModeButton, ShowFiltersButton } from "@/components/list/ListPaneButtons";

const Skeleton = () => (
  <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
);

export default function ListView({ doctype }: { doctype: string }) {
  const { data: meta, isLoading, error } = useDoctype(doctype);
  const { data: ctx } = useDeskContext();
  const user = ctx?.user ?? "";
  const settings = useListSettings(meta);
  const config = useListViewConfig(doctype);
  const state = useListLayouts({ doctype, meta, settings, user });
  // saved layouts: the active one's columns replace the List View Settings columns
  const colSettings = state.layoutCols ?? config.columns;
  const columns = useListColumns(meta, settings, colSettings);
  useListRedirects({ doctype, meta, settings, view: state.view, wantNew: state.wantNew });

  if (error) return <p className="p-6 text-sm text-red-600">{(error as Error).message}</p>;
  if (isLoading || !meta || meta.issingle) return <Skeleton />;
  return (
    <ListPage
      doctype={doctype}
      meta={meta}
      settings={settings}
      ctx={ctx}
      config={config}
      state={state}
      colSettings={colSettings}
      columns={columns}
    />
  );
}

type DeskCtx = ReturnType<typeof useDeskContext>["data"];

function ListPage({
  doctype,
  meta,
  settings,
  ctx,
  config,
  state,
  colSettings,
  columns,
}: {
  doctype: string;
  meta: DocTypeMeta;
  settings: ReturnType<typeof useListSettings>;
  ctx: DeskCtx;
  config: ReturnType<typeof useListViewConfig>;
  state: ReturnType<typeof useListLayouts>;
  colSettings: ReturnType<typeof useListViewConfig>["columns"];
  columns: ReturnType<typeof useListColumns>;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const phone = useIsPhone();
  const user = ctx?.user ?? "";
  const { filters, setFilters } = state;
  const { selected, setSelected, clearSelected, toggle } = useSelection(filters);

  const [pageLength, setPageLength] = useState(20);
  const list = useListRows({
    doctype,
    meta,
    settings,
    enabled: config.ready && state.stateReady,
    fields: columns.fetchFields,
    filters: state.allFilters,
    sort: state.sort,
    pageLength,
    disableCount: config.disableCount,
    disableCommentCount: config.disableCommentCount,
    disableAutoRefresh: config.disableAutoRefresh,
  });
  const { rows, refresh } = list;
  const pageState = useListviewHooks({
    doctype,
    meta,
    settings,
    ready: state.stateReady,
    loadedAt: list.isSuccess ? list.dataUpdatedAt : 0,
    host: { rows, selected, clearSelected, filters, setFilters, refresh },
  });

  const [quickEntry, setQuickEntry] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [layoutDialog, setLayoutDialog] = useState<LayoutDialogState>(null);
  const [manageLayouts, setManageLayouts] = useState(false);
  const onAdd = useAddAction(doctype, meta, settings, () => setQuickEntry(true));
  // Desk list shortcut: Ctrl/⌘+B = New (list_view.js)
  useShortcuts(
    [
      {
        keys: "mod+b",
        description: `New ${doctype}`,
        group: "List",
        allowInInput: true,
        action: () => router.push(newDocHref(doctype)),
      },
    ],
    [doctype, router]
  );
  const deskCtx = { user, roles: ctx?.roles ?? [], developerMode: !!ctx?.developer_mode };
  const onLikeChanged = useCallback(
    () => qc.invalidateQueries({ queryKey: ["list", doctype] }),
    [qc, doctype]
  );
  const dateFormat = String(ctx?.sysdefaults?.date_format ?? "yyyy-mm-dd");
  const currency = (ctx?.defaults?.currency as string) || undefined;
  const { titleField, listFields, hasIndicator } = columns;
  const { disableCommentCount } = config;
  const { addFilter } = state;
  // stable across a selection change, so checking rows doesn't re-render every cell (largelist: 1000 rows)
  const pane = usePane("list-filters", 1920);
  // wide screens: a row click previews the record on the right (§ 3.8)
  const preview = useListPreview(rows);
  useListKeys({
    rows,
    preview,
    toggle,
    hrefOf: (name) => rowHref(settings, doctype, rows.find((r) => r.name === name) ?? { name }),
  });
  const previewing = preview.current;
  const onPreview = preview.onPreview;
  const rowCtx = useMemo<RowContext>(
    () => ({
      doctype,
      meta,
      settings,
      user,
      titleField,
      listFields,
      hasIndicator,
      disableCommentCount,
      dateFormat,
      currency,
      filters,
      setFilters,
      addFilter,
      onLikeChanged,
      previewing,
      onPreview,
    }),
    [
      doctype,
      meta,
      settings,
      user,
      titleField,
      listFields,
      hasIndicator,
      disableCommentCount,
      dateFormat,
      currency,
      filters,
      setFilters,
      addFilter,
      onLikeChanged,
      previewing,
      onPreview,
    ]
  );

  return (
    <ListPanes
      left={pane.open}
      leftPane={
        <ListFacetsPane
          meta={meta}
          filters={filters}
          setFilters={setFilters}
          user={user}
          onClose={pane.toggle}
        />
      }
      right={preview.row}
      rightPane={(row) => (
        <ListPreviewPane
          meta={meta}
          name={row.name}
          href={rowHref(settings, doctype, row)}
          settings={settings}
          titleField={titleField}
          onClose={preview.close}
          onPrev={preview.prev}
          onNext={preview.next}
        />
      )}
    >
      <div className="min-w-0 space-y-3">
        <ListHeader
          doctype={doctype}
          meta={meta}
          settings={settings}
          pageState={pageState}
          user={user}
          systemManager={deskCtx.roles.includes("System Manager")}
          layouts={state}
          onCreateLayout={() => setLayoutDialog({ layout: null, duplicateFrom: null })}
          onManageLayouts={() => setManageLayouts(true)}
          refresh={refresh}
          fetching={list.isFetching}
          onListSettings={() => setListSettingsOpen(true)}
          onExport={() => setExporting(true)}
          selectedRows={rows.filter((r) => selected.has(r.name))}
          listFields={columns.listFields}
          onBulkDone={() => {
            clearSelected();
            refresh();
          }}
          onAdd={onAdd}
        />
        <div className="flex items-start gap-2">
          <ShowFiltersButton pane={pane} />
          <PreviewModeButton preview={preview} />
          <div className="min-w-0 flex-1">
            <ListFilterBar
              doctype={doctype}
              meta={meta}
              user={user}
              phone={phone}
              standardFilters={standardFiltersOf(meta)}
              showSidebar={config.showSidebar}
              search={state.search}
              setSearch={state.setSearch}
              subjectLabel={columns.subjectLabel}
              filters={filters}
              allFilters={state.allFilters}
              setFilters={setFilters}
              addFilter={state.addFilter}
              sort={state.sort}
              setSort={state.setSort}
            />
          </div>
        </div>
        <ActiveFilters meta={meta} filters={filters} setFilters={setFilters} inline={phone ? [] : standardFiltersOf(meta).map((f) => f.fieldname)} />
        <ListBody
          phone={phone}
          list={list}
          showCount={!config.disableCount}
          colSettings={colSettings}
          subjectLabel={columns.subjectLabel}
          pageLength={pageLength}
          setPageLength={setPageLength}
          filtered={filters.length > 0 || !!state.debounced}
          canCreate={!meta.istable}
          addDisabled={settings === undefined}
          onAdd={onAdd}
          onClear={() => {
            state.setSearch("");
            setFilters([]);
          }}
          c={rowCtx}
          sel={{ selected, setSelected, toggle }}
        />

        {listSettingsOpen && (
          <ListSettingsDialog
            meta={meta}
            settings={config.lvs}
            hasIndicator={columns.canIndicate}
            onClose={() => setListSettingsOpen(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: lvsKey(doctype) });
              qc.invalidateQueries({ queryKey: ["doctype", doctype] });
              refresh();
            }}
          />
        )}
        <ListLayoutDialogs
          meta={meta}
          ctx={deskCtx}
          layouts={state.layouts}
          dialog={layoutDialog}
          setDialog={setLayoutDialog}
          manage={manageLayouts}
          setManage={setManageLayouts}
          current={{
            filters,
            sort_field: state.sort.field,
            sort_order: state.sort.order,
            columns: columns.currentColumns,
          }}
          onSaved={(l) => void state.onLayoutSaved(l)}
          onDeleted={state.onLayoutDeleted}
        />
        {exporting && (
          <ExportDialog
            doctype={doctype}
            filters={state.allFilters}
            onClose={() => setExporting(false)}
          />
        )}
        {quickEntry && (
          <QuickEntry
            meta={meta}
            onClose={() => setQuickEntry(false)}
            onCreated={(name) => {
              setQuickEntry(false);
              refresh();
              toast.success(`${doctype} ${name} created`, {
                action: { label: "Open", onClick: () => router.push(docHref(doctype, name)) },
              });
            }}
          />
        )}
      </div>
    </ListPanes>
  );
}
