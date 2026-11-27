"use client";

/** The saved-layout dialogs a list opens: create / edit / duplicate a layout, and manage them. */
import type { DocTypeMeta } from "@/lib/frappe/types";
import type { Filter } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import type { ListLayout } from "@/lib/list/layouts";
import { LayoutDialog, ManageLayoutsDialog } from "@/components/list/Layouts";

export type LayoutDialogState = {
  layout: ListLayout | null;
  duplicateFrom: ListLayout | null;
} | null;
type Ctx = { user: string; roles: string[]; developerMode: boolean };

export function ListLayoutDialogs({
  meta,
  ctx,
  layouts,
  dialog,
  setDialog,
  manage,
  setManage,
  current,
  onSaved,
  onDeleted,
}: {
  meta: DocTypeMeta;
  ctx: Ctx;
  layouts: ListLayout[];
  dialog: LayoutDialogState;
  setDialog: (d: LayoutDialogState) => void;
  manage: boolean;
  setManage: (v: boolean) => void;
  current: {
    filters: Filter[];
    sort_field: string;
    sort_order: string;
    columns: ListColumnSetting[];
  };
  onSaved: (l: ListLayout) => void;
  onDeleted: (l: ListLayout) => void;
}) {
  return (
    <>
      {dialog && (
        <LayoutDialog
          meta={meta}
          layout={dialog.layout}
          duplicateFrom={dialog.duplicateFrom}
          ctx={ctx}
          layouts={layouts}
          current={current}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null);
            onSaved(saved);
          }}
        />
      )}
      {manage && (
        <ManageLayoutsDialog
          layouts={layouts}
          ctx={ctx}
          onClose={() => setManage(false)}
          onEdit={(l) => {
            setManage(false);
            setDialog({ layout: l, duplicateFrom: null });
          }}
          onDuplicate={(l) => {
            setManage(false);
            setDialog({ layout: null, duplicateFrom: l });
          }}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
