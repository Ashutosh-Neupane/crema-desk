"use client";

/**
 * Phase 2 Home — "My work" (docs/GAPS.md § 3.4): what a clerk / storekeeper / accountant / approver comes back for,
 * instead of a module grid. Each row has one action: open the document.
 */
import { useSyncExternalStore } from "react";
import { Clock, FilePen, Inbox, Pin, Search } from "lucide-react";
import { useMyWork } from "./useMyWork";
import { EmptyNext, WorkSection } from "./WorkSection";
import { WorkList } from "./WorkList";
import { ShortcutGrid } from "./ShortcutGrid";
import { focusRing } from "./data";

const SHOW = 8;
const noopSubscribe = () => () => {};
const openPalette = () => document.dispatchEvent(new CustomEvent("crema:command-palette"));

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function MyWorkHeader({ fullName, waiting, drafts }: { fullName: string; waiting?: number; drafts?: number }) {
  // time of day comes from the browser clock: shown after hydration so server and client markup match
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const first = fullName.split(" ")[0];
  const summary: string[] = [];
  if (waiting !== undefined) summary.push(waiting ? `${waiting} waiting on you` : "Nothing waiting on you");
  if (drafts) summary.push(`${drafts} draft${drafts === 1 ? "" : "s"} to finish`);
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{hydrated ? `${greeting()}${first ? `, ${first}` : ""}` : "Welcome"}</p>
        <h1 className="text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] font-semibold tracking-tight text-foreground">My work</h1>
        <p className="mt-0.5 min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {summary.join(" · ")}
        </p>
      </div>
      <button
        type="button"
        onClick={openPalette}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-sm hover:bg-muted sm:w-72 ${focusRing}`}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        Find or create anything
        <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </button>
    </header>
  );
}

type MyWork = ReturnType<typeof useMyWork>;

function WaitingSection({ waiting, sessionLoading, sessionFailed }: { waiting: MyWork["waiting"]; sessionLoading: boolean; sessionFailed: boolean }) {
  const items = waiting.data ?? [];
  return (
    <WorkSection
      id="my-work-waiting"
      title="Waiting on me"
      icon={<Inbox className="h-4 w-4" />}
      count={items.length}
      viewAll={{ href: "/desk/doctype/ToDo", label: "All ToDos" }}
      loading={sessionLoading || waiting.isPending}
      error={waiting.isError || sessionFailed}
      onRetry={() => void waiting.refetch()}
      empty={<EmptyNext icon={<Inbox className="h-6 w-6" />} message="Nothing is waiting on you. Approvals and documents assigned to you show up here." action={{ label: "See all ToDos", href: "/desk/doctype/ToDo" }} />}
    >
      {items.length > 0 && <WorkList items={items.slice(0, SHOW)} label="Waiting on me" />}
    </WorkSection>
  );
}

function DraftsSection({ drafts, loading, error, onRetry }: { drafts: MyWork["drafts"]; loading: boolean; error: boolean; onRetry: () => void }) {
  return (
    <WorkSection
      id="my-work-drafts"
      title="Drafts I started"
      icon={<FilePen className="h-4 w-4" />}
      count={drafts.length}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={<EmptyNext icon={<FilePen className="h-6 w-6" />} message="No unfinished drafts. Documents you save but don't submit wait here." action={{ label: "Create something", onClick: openPalette }} />}
    >
      {drafts.length > 0 && <WorkList items={drafts.slice(0, SHOW)} label="Drafts I started" />}
    </WorkSection>
  );
}

function RecentSection({ recent, loading }: { recent: MyWork["recent"]; loading: boolean }) {
  return (
    <WorkSection
      id="my-work-recent"
      title="Recent"
      icon={<Clock className="h-4 w-4" />}
      loading={recent.length === 0 && loading}
      empty={<EmptyNext icon={<Clock className="h-6 w-6" />} message="Documents you open or change show up here." action={{ label: "Search documents", onClick: openPalette }} />}
    >
      {recent.length > 0 && <WorkList items={recent.slice(0, SHOW)} label="Recently viewed and edited" />}
    </WorkSection>
  );
}

function ShortcutsSection({ shortcuts, sessionLoading }: { shortcuts: MyWork["shortcuts"]; sessionLoading: boolean }) {
  const items = shortcuts.data?.shortcuts ?? [];
  const workspace = shortcuts.data?.workspace;
  return (
    <WorkSection
      id="my-work-shortcuts"
      title="Shortcuts"
      icon={<Pin className="h-4 w-4" />}
      viewAll={workspace ? { href: `/desk/workspace/${encodeURIComponent(workspace)}`, label: "Workspace" } : undefined}
      loading={sessionLoading || shortcuts.isPending}
      error={shortcuts.isError}
      onRetry={() => void shortcuts.refetch()}
      empty={<EmptyNext icon={<Pin className="h-6 w-6" />} message="No shortcuts yet. Add them to your workspace and they appear here." action={{ label: "Open workspaces", href: "/desk" }} />}
    >
      {items.length > 0 && <ShortcutGrid shortcuts={items} />}
    </WorkSection>
  );
}

export default function MyWorkView() {
  const { session, waiting, drafts, draftsLoading, draftsError, refetchMine, recent, shortcuts } = useMyWork();
  const sessionLoading = !session.user && !session.failed;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-stack pb-12">
      <MyWorkHeader fullName={session.fullName} waiting={waiting.data?.length} drafts={draftsLoading ? undefined : drafts.length} />
      <div className="grid grid-cols-1 gap-stack lg:grid-cols-2">
        <WaitingSection waiting={waiting} sessionLoading={sessionLoading} sessionFailed={session.failed} />
        <DraftsSection drafts={drafts} loading={sessionLoading || draftsLoading} error={draftsError} onRetry={() => void refetchMine()} />
        <RecentSection recent={recent} loading={sessionLoading || draftsLoading} />
        <ShortcutsSection shortcuts={shortcuts} sessionLoading={sessionLoading} />
      </div>
    </div>
  );
}
