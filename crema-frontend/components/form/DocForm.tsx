"use client";

/**
 * Desk-style document form — one page for viewing and editing, like
 * /desk/<doctype>/<name>. Built on FormController (the live doc, scripts,
 * fetch_from, child events) and FormBody/Grid (layout).
 *
 * Save pipeline = Desk's frappe.ui.form.save:
 *   validate → before_save → mandatory check → savedocs → reload → after_save → refresh
 * Submit adds before_submit / on_submit; Cancel before_cancel / after_cancel.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import FormBody from "@/components/form/FormBody";
import Grid from "@/components/form/Grid";
import FormBuilder from "@/components/form/FormBuilder";
import FormSidebar from "@/components/form/FormSidebar";
import Timeline from "@/components/form/Timeline";
import Connections from "@/components/form/Connections";
import HtmlHost from "@/components/form/HtmlHost";
import FormDashboard, { FormHeadlines } from "@/components/form/FormDashboard";
import WorkflowBar from "@/components/form/WorkflowBar";
import { getHtmlWidget } from "@/components/form/widgets";
import { LinksDialog, ReminderDialog, RenameDialog } from "@/components/form/FormDialogs";
import { ConfirmDialog, JumpToField, MissingFieldsDialog, PageError, WorkflowHelpDialog } from "@/components/form/DocFormDialogs";
import { DocFormBottomBar, DocFormHeader, type MainActionsProps, type MoreMenuProps } from "@/components/form/DocFormHeader";
import { builderTabOf, connectionsTabOf, formView, type FormView } from "@/components/form/docFormRules";
import { useDocForm, type Loaded } from "@/components/form/useDocForm";
import { useDocWorkflow } from "@/components/form/useDocWorkflow";
import { useDocActions } from "@/components/form/useDocActions";
import { useFormMetas } from "@/lib/hooks/useFormMetas";
import { useDeskContext } from "@/lib/hooks/useDeskContext";
import { useIsPhone } from "@/lib/hooks/useIsPhone";
import { isNewDoc, type Doc } from "@/lib/frappe/form";
import { asksForName, withNewNameField } from "@/lib/form/newName";
import { defaultState } from "@/lib/form/workflow";
import type { FormController, FormSnapshot } from "@/lib/form/FormController";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import TableMultiSelectField from "@/lib/crema-form/controls/TableMultiSelectField";
import { FormSkeleton } from "@/components/Skeleton";
import { doctypeUrl } from "@/lib/navigation/deskUrl";

const enc = encodeURIComponent;

interface Props {
  doctype: string;
  /** Omit for a new document */
  name?: string;
}

export default function DocForm({ doctype, name }: Props) {
  const { data: metas, error: metaError } = useFormMetas(doctype);
  const { data: ctx } = useDeskContext();
  const form = useDocForm(doctype, name, metas, ctx);
  const { ctl, snap, loadError } = form;

  const pageError = loadError ?? (metaError ? { message: (metaError as Error).message, status: (metaError as { status?: number }).status } : null);
  if (pageError) return <PageError error={pageError} doctype={doctype} name={name} />;
  if (!metas || !ctl || !snap) return <FormSkeleton />;
  return <DocFormView doctype={doctype} isNew={!name} meta={metas.meta} childMetas={metas.children} form={form} ctl={ctl} snap={snap} />;
}

type FormState = ReturnType<typeof useDocForm>;

function DocFormView({
  doctype,
  isNew,
  meta,
  childMetas,
  form,
  ctl,
  snap,
}: {
  doctype: string;
  isNew: boolean;
  meta: DocTypeMeta;
  childMetas: DocTypeMeta[];
  form: FormState;
  ctl: FormController;
  snap: FormSnapshot;
}) {
  const { data: ctx } = useDeskContext();
  const desk = deskInfo(ctx);
  const phone = useIsPhone();
  const { loaded, load, ctlRef } = form;
  const doc = snap.doc;
  const roles = desk.roles;
  const wf = useDocWorkflow({ doctype, meta, doc, dirty: snap.dirty, user: desk.user, roles, ctlRef, load });
  const actions = useDocActions({ doctype, meta, ctlRef, ctl, load, setLoaded: form.setLoaded });
  const [formDialog, setFormDialog] = useState<FormDialogKind | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ fieldname: string; n: number } | null>(null);
  const view = formView({
    doctype,
    meta,
    doc,
    dirty: snap.dirty,
    overrides: snap.overrides,
    isNew,
    perms: loaded?.docinfo.permissions ?? {},
    roles,
    workflow: wf.workflow,
    styles: wf.styles,
    hasTransitions: wf.transitions.length > 0,
  });
  const mainActions = mainActionsOf(view, wf, actions);
  const moreMenu = moreMenuOf({ doctype, meta, doc, view, desk, actions, load, onDialog: setFormDialog, getDoc: () => ctl.getDoc() });
  const hasBottomBar = phone && (snap.buttons.length > 0 || view.hasMainActions);

  return (
    <div className={`space-y-stack ${hasBottomBar ? "pb-28" : "pb-16"}`}>
      <DocFormHeader
        title={view.title}
        onRename={view.canRename ? () => setFormDialog("rename") : undefined}
        indicator={view.indicator}
        viewers={form.viewers}
        phone={phone}
        saved={view.saved}
        showNav={view.saved && !meta.issingle && desk.navButtons}
        onNavigate={(prev) => void actions.navigate(prev)}
        buttons={snap.buttons}
        more={moreMenu}
        actions={mainActions}
      />
      {hasBottomBar && <DocFormBottomBar buttons={snap.buttons} actions={mainActions} />}
      {form.conflict && <ConflictBanner onReload={() => void load()} />}
      <FormHeadlines state={snap.dashboard} onDismiss={(id) => ctl.dash.removeHeadline(id)} extra={view.submitHint ? [{ key: "submit", html: "Submit this document to confirm", color: "blue" }] : undefined} />
      <DocFormWorkflow wf={wf} ctl={ctl} doc={doc} docinfo={loaded?.docinfo} dirty={snap.dirty} user={desk.user} />
      <FormDashboard state={snap.dashboard} />
      {view.docstatus === 2 && <p className="text-xs text-zinc-500">Cancelled. Use Amend to create a corrected copy.</p>}

      <DocFormMain doctype={doctype} meta={meta} childMetas={childMetas} ctl={ctl} snap={snap} loaded={loaded} view={view} desk={desk} load={load} focusRequest={focusRequest} />

      <FormDialogHost kind={formDialog} onClose={() => setFormDialog(null)} doctype={doctype} doc={doc} meta={meta} view={view} load={load} />
      {actions.jumpOpen && (
        <JumpToField
          meta={meta}
          onClose={() => actions.setJumpOpen(false)}
          onPick={(fieldname) => {
            actions.setJumpOpen(false);
            setFocusRequest((r) => ({ fieldname, n: (r?.n ?? 0) + 1 }));
          }}
        />
      )}
      <MissingFieldsDialog doctype={doctype} missing={actions.missing} onClose={() => actions.setMissing(null)} />
      <ConfirmDialog kind={actions.confirm} name={doc.name} onClose={() => actions.setConfirm(null)} onConfirm={actions.confirmed} />
    </div>
  );
}

type DeskInfo = ReturnType<typeof deskInfo>;

function deskInfo(ctx: ReturnType<typeof useDeskContext>["data"]) {
  return {
    user: ctx?.user,
    fullName: ctx?.full_name,
    roles: ctx?.roles ?? [],
    developerMode: !!ctx?.developer_mode,
    navButtons: (ctx?.boot?.desk_settings as { form_navigation_buttons?: number } | undefined)?.form_navigation_buttons !== 0,
  };
}

function moreMenuOf(o: {
  doctype: string;
  meta: DocTypeMeta;
  doc: Doc;
  view: FormView;
  desk: DeskInfo;
  actions: ReturnType<typeof useDocActions>;
  load: () => Promise<void>;
  onDialog: (d: FormDialogKind) => void;
  getDoc: () => Doc;
}): MoreMenuProps {
  const { view, actions } = o;
  return {
    doctype: o.doctype,
    name: o.doc.name,
    can: view.can,
    allowCopy: o.meta.allow_copy !== 0,
    canRename: view.canRename,
    canDelete: view.can("delete") && view.docstatus !== 1,
    isSystemManager: o.desk.roles.includes("System Manager"),
    developerMode: o.desk.developerMode,
    onDuplicate: () => actions.openCopy(false),
    onReload: () => void o.load(),
    onDialog: o.onDialog,
    onCopyJson: () => {
      void navigator.clipboard.writeText(JSON.stringify(o.getDoc(), null, 2));
      toast.success("Document copied as JSON");
    },
    onDelete: () => actions.setConfirm("delete"),
  };
}

/** the fields, the timeline and the sidebar */
function DocFormMain({
  doctype,
  meta,
  childMetas,
  ctl,
  snap,
  loaded,
  view,
  desk,
  load,
  focusRequest,
}: {
  doctype: string;
  meta: DocTypeMeta;
  childMetas: DocTypeMeta[];
  ctl: FormController;
  snap: FormSnapshot;
  loaded: Loaded | null;
  view: FormView;
  desk: DeskInfo;
  load: () => Promise<void>;
  focusRequest: { fieldname: string; n: number } | null;
}) {
  const shownDoc = (loaded?.doc ?? snap.doc) as Doc;
  const docinfo = loaded?.docinfo ?? {};
  return (
    <div className="grid grid-cols-1 gap-stack xl:grid-cols-[minmax(0,1fr)_clamp(13rem,18vw,16rem)]">
      <div className="min-w-0 space-y-4">
        <DocFormBody doctype={doctype} meta={meta} childMetas={childMetas} ctl={ctl} snap={snap} readOnly={view.readOnly} focusRequest={focusRequest} />
        {view.saved && <Timeline doc={shownDoc} docinfo={docinfo} meta={meta} childMetas={childMetas} user={desk.user} fullName={desk.fullName} onChanged={load} fieldPerm={ctl.fieldStatus} />}
      </div>

      {/* Form sidebar (Desk: assigned / attachments / tags / shared / follow / like) */}
      {view.saved && <FormSidebar doc={shownDoc} docinfo={docinfo} user={desk.user} canWrite={view.can("write")} trackChanges={!!meta.track_changes} onChanged={load} />}
    </div>
  );
}

function mainActionsOf(view: FormView, wf: ReturnType<typeof useDocWorkflow>, actions: ReturnType<typeof useDocActions>): MainActionsProps {
  return {
    canAmend: view.canAmend,
    onAmend: () => actions.openCopy(true),
    transitions: view.showTransitions ? wf.transitions : null,
    wfBusy: wf.busy,
    onTransition: (t) => void wf.run(t),
    onWorkflowHelp: () => wf.setHelpOpen(true),
    primary: view.primary,
    busy: !!actions.busy,
    onPrimary: (p) => (p.kind === "save" ? void actions.run("save", "Save") : actions.setConfirm(p.kind)),
  };
}

function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      This document was changed by someone else after you opened it.
      <button type="button" onClick={onReload} className="ml-auto font-medium underline">
        Reload (discards your changes)
      </button>
    </div>
  );
}

/** the workflow bar and its help dialog, when the DocType has an active Workflow */
function DocFormWorkflow({ wf, ctl, doc, docinfo, dirty, user }: { wf: ReturnType<typeof useDocWorkflow>; ctl: FormController; doc: Doc; docinfo: Record<string, unknown> | undefined; dirty: boolean; user?: string }) {
  const { workflow, status } = wf;
  if (!workflow || !status) return null;
  const docstatus = Number(doc.docstatus ?? 0);
  return (
    <>
      <WorkflowBar
        workflow={workflow}
        doc={doc}
        status={status}
        docinfo={docinfo}
        styles={wf.styles}
        user={user}
        dirty={dirty}
        busy={wf.busy}
        defaultState={defaultState(workflow, docstatus)}
        onRun={(t) => void wf.run(t)}
        onSetDefault={() => void ctl.set_value(workflow.workflow_state_field, defaultState(workflow, docstatus))}
        onHelp={() => wf.setHelpOpen(true)}
      />
      <WorkflowHelpDialog open={wf.helpOpen} onOpenChange={wf.setHelpOpen} workflow={workflow} status={status} />
    </>
  );
}

type FormDialogKind = "rename" | "links" | "remind";

/** Rename / Links / Remind Me from the ⋯ menu */
function FormDialogHost({ kind, onClose, doctype, doc, meta, view, load }: { kind: FormDialogKind | null; onClose: () => void; doctype: string; doc: Doc; meta: DocTypeMeta; view: FormView; load: () => Promise<void> }) {
  const router = useRouter();
  if (kind === "links") return <LinksDialog doctype={doctype} name={doc.name} onClose={onClose} />;
  if (kind === "remind") return <ReminderDialog doctype={doctype} name={doc.name} onClose={onClose} />;
  if (kind !== "rename") return null;
  return (
    <RenameDialog
      doctype={doctype}
      name={doc.name}
      titleField={view.titleEditable ? view.titleField : undefined}
      title={view.titleField ? String(doc[view.titleField] ?? "") : undefined}
      allowRename={!!meta.allow_rename}
      onClose={onClose}
      onDone={(n) => {
        onClose();
        if (n !== doc.name) router.replace(`${doctypeUrl(doctype)}/${enc(n)}`);
        else void load();
      }}
    />
  );
}

/** the form's fields: FormBody with child tables (Grid / Table MultiSelect), HTML widgets and the extra tab content */
function DocFormBody({
  doctype,
  meta,
  childMetas,
  ctl,
  snap,
  readOnly,
  focusRequest,
}: {
  doctype: string;
  meta: DocTypeMeta;
  childMetas: DocTypeMeta[];
  ctl: FormController;
  snap: FormSnapshot;
  readOnly: boolean;
  focusRequest: { fieldname: string; n: number } | null;
}) {
  const doc = snap.doc;
  const tabExtras: Record<string, React.ReactNode> = {};
  const connectionsTab = connectionsTabOf(meta);
  if (connectionsTab) tabExtras[connectionsTab] = <Connections meta={meta} doc={doc} />;
  const builderTab = builderTabOf(meta);
  if (builderTab && ctl.field("fields")) {
    tabExtras[builderTab] = <FormBuilder ctl={ctl} childMeta={childMetas.find((m) => m.name === ctl.field("fields")?.options)} readOnly={readOnly} />;
  }
  const renderTable = (df: DocField) =>
    df.fieldtype === "Table MultiSelect" ? (
      <TableMultiSelectField
        field={df}
        value={doc[df.fieldname]}
        onChange={(v) => void ctl.set_value(df.fieldname, v)}
        onAddRow={(values) => ctl.add_child(df.fieldname, values)}
        onRemoveRow={(row) => ctl.remove_rows(df.fieldname, [String(row.name)])}
        disabled={readOnly && !df.allow_on_submit}
        error={snap.errors[df.fieldname]}
        getQuery={() => ctl.getQuery(df.fieldname)?.(ctl.getDoc())}
        doc={doc}
      />
    ) : (
      <Grid
        ctl={ctl}
        df={df}
        meta={childMetas.find((m) => m.name === df.options) ?? ({ name: String(df.options), fields: [] } as unknown as DocTypeMeta)}
        readOnly={readOnly && !df.allow_on_submit}
        overrides={snap.overrides}
        errors={snap.errors}
      />
    );
  return (
    <FormBody
      meta={isNewDoc(doc) && asksForName(meta) ? withNewNameField(meta) : meta}
      values={doc}
      readOnly={readOnly}
      fieldPerm={ctl.fieldStatus}
      overrides={snap.overrides}
      errors={snap.errors}
      onChange={(f, v) => void ctl.set_value(f, v)}
      onButton={(f) => void ctl.clickButton(f)}
      getQuery={(f) => () => ctl.getQuery(f)?.(ctl.getDoc())}
      renderTable={(df) => renderTable(df as DocField)}
      renderHtml={(df) => {
        const widget = getHtmlWidget(doctype, df.fieldname);
        return widget ? widget({ ctl, readOnly }) : <HtmlHost el={ctl.htmlWrapper(df.fieldname)} html={typeof df.options === "string" ? df.options : null} />;
      }}
      tabExtras={tabExtras}
      focusRequest={focusRequest}
    />
  );
}

