"use client";

/**
 * The New layout's desk home (docs/PHASE2_DESIGN.md § 4.1): a ranked list of cards worked out on every load from the
 * user's permissions and usage (useDynamicHome). Cards pack into a 12-column grid (dense flow); how many show before
 * "Show more" depends on the width. Edit lets the user pin and hide cards (user_settings "Crema Home").
 */
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FilePen,
  Inbox,
  LayoutGrid,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useNavigation } from "@/lib/hooks/useNavigation";
import { ChartCard, NumberCard } from "@/components/desk/Widgets";
import { useDashboardChart } from "@/lib/hooks/useDashboardChart";
import { ModuleGrid } from "@/components/desk/ModuleGrid";
import { Kbd, StatusPill, Tooltip } from "@/components/crema-ui";
import { newDocUrl } from "@/lib/navigation/deskUrl";
import { guessColour } from "@/lib/desk-runtime";
import { EmptyNext, WorkSection } from "./WorkSection";
import { WorkList } from "./WorkList";
import { focusRing, type WorkItem } from "./data";
import { useDynamicHome, useHomeLayout, type CardSize, type HomeCard } from "./useDynamicHome";

const noSubscribe = () => () => {};

/** column span per card size: one column on phones, 2 / 3 per row on tablets, the 12-col grid from 1024 */
const SPAN: Record<CardSize, string> = {
  2: "col-span-6 md:col-span-4 lg:col-span-2",
  4: "col-span-12 md:col-span-6 lg:col-span-4",
  6: "col-span-12 lg:col-span-6",
  12: "col-span-12",
};
/** Needs you spans two rows when it has a list to show */
const rowSpan = (card: HomeCard) =>
  card.type === "needs-you" && card.items.length > 2 ? "lg:row-span-2" : "";

/** cards shown before "Show more" (§ 4.1.5: ≈ 8 at 1280, 14 at 1920) */
function useCardBudget(): number {
  const subscribe = (cb: () => void) => {
    const mq = [window.matchMedia("(min-width: 1600px)"), window.matchMedia("(min-width: 1920px)")];
    mq.forEach((m) => m.addEventListener("change", cb));
    return () => mq.forEach((m) => m.removeEventListener("change", cb));
  };
  return useSyncExternalStore(
    subscribe,
    () => (window.innerWidth >= 1920 ? 14 : window.innerWidth >= 1600 ? 11 : 8),
    () => 8
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function matches(card: HomeCard, q: string): boolean {
  if (!q) return true;
  const hay = [card.title];
  if ("items" in card) hay.push(...card.items.flatMap((i) => [i.title, i.name, i.doctype]));
  if (card.type === "quick-create") hay.push(...card.doctypes);
  if (card.type === "status") hay.push(...card.counts.map((c) => c.status));
  if (card.type === "today") hay.push(...card.events.map((e) => e.subject));
  if (card.type === "kpi" || card.type === "chart") hay.push(card.card.doctype);
  return hay.some((h) => h?.toLowerCase().includes(q));
}

const filterItems = (items: WorkItem[], q: string) =>
  q
    ? items.filter((i) => [i.title, i.name, i.doctype].some((h) => h.toLowerCase().includes(q)))
    : items;

export default function DynamicHome() {
  const { work, cards, loading } = useDynamicHome();
  const { user, fullName } = work.session;
  const { layout, togglePin, hide, restore, reset } = useHomeLayout(user);
  const { data: nav } = useNavigation();
  const budget = useCardBudget();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const q = query.trim().toLowerCase();

  // pins first (in pin order, after Needs you), hidden ones out, then the learned order
  const ordered = useMemo(() => {
    const hidden = new Set(layout.hidden);
    const pinnedIds = new Set(layout.pinned);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const pinned = layout.pinned
      .map((id) => byId.get(id))
      .filter((c): c is HomeCard => !!c && !hidden.has(c.id));
    const rest = cards.filter((c) => !hidden.has(c.id) && !pinnedIds.has(c.id));
    const needs = rest.filter((c) => c.type === "needs-you");
    return [...needs, ...pinned, ...rest.filter((c) => c.type !== "needs-you")];
  }, [cards, layout]);
  const visible = ordered.filter((c) => matches(c, q));
  const shown = showAll || q || editing ? visible : visible.slice(0, budget);
  const more = visible.length - shown.length;
  const hiddenCards = useMemo(() => {
    const hidden = new Set(layout.hidden);
    return cards.filter((c) => hidden.has(c.id));
  }, [cards, layout.hidden]);
  const pinnedIds = useMemo(() => new Set(layout.pinned), [layout.pinned]);

  return (
    <div className="pb-12" data-testid="dynamic-home">
      <HomeHeader
        fullName={fullName}
        query={query}
        onQuery={setQuery}
        editing={editing}
        onEdit={() => setEditing((e) => !e)}
      />

      {editing && <EditBanner onReset={reset} />}

      {loading ? (
        <HomeSkeleton />
      ) : (
        <ul className="grid grid-flow-row-dense grid-cols-12 gap-4" aria-label="Home cards">
          {shown.map((card) => (
            <li
              key={card.id}
              className={`${SPAN[card.size]} ${rowSpan(card)} relative min-w-0 has-[>[data-empty]]:hidden`}
              data-card={card.id}
            >
              {editing && card.type !== "needs-you" && (
                <CardControls
                  pinned={pinnedIds.has(card.id)}
                  title={card.title}
                  onPin={() => togglePin(card.id)}
                  onHide={() => hide(card.id)}
                />
              )}
              <CardBody
                card={card}
                q={q}
                retry={() => void work.refetchMine()}
                loadingDrafts={work.draftsLoading}
              />
            </li>
          ))}
          {!shown.length && (
            <li className="col-span-12">
              <EmptyNext
                icon={<Search className="h-5 w-5" />}
                message={`Nothing on this page matches “${query}”.`}
                action={{ label: "Clear filter", onClick: () => setQuery("") }}
              />
            </li>
          )}
        </ul>
      )}

      {more > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[var(--ink-default)] hover:bg-[var(--surface-hover)] ${focusRing}`}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" /> Show more ({more})
        </button>
      )}

      <HiddenCards cards={hiddenCards} onRestore={restore} />

      <details className="group mt-8" open={!!q || undefined}>
        <summary
          className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold text-[var(--ink-default)] ${focusRing}`}
        >
          <LayoutGrid className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
          All workspaces
          <ChevronDown
            className="h-4 w-4 text-[var(--ink-muted)] transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-4 space-y-6">
          <ModuleGrid sections={nav?.sections ?? []} filter={query} />
        </div>
      </details>
    </div>
  );
}

function HomeHeader({
  fullName,
  query,
  onQuery,
  editing,
  onEdit,
}: {
  fullName: string;
  query: string;
  onQuery: (q: string) => void;
  editing: boolean;
  onEdit: () => void;
}) {
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
  return (
    <header className="flex flex-wrap items-center gap-3 pt-2 pb-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-h1 font-semibold tracking-tight text-[var(--ink-default)]">
          {hydrated ? greeting() : "Welcome"}
          {hydrated && fullName && !fullName.includes("@") ? `, ${fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--ink-muted)]" suppressHydrationWarning>
          {hydrated
            ? new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : " "}
        </p>
      </div>
      <label className="relative flex min-w-0 basis-full items-center sm:basis-64">
        <span className="sr-only">Filter this page</span>
        <Search
          className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--ink-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter this page…"
          className={`h-10 w-full rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] pr-3 pl-8 text-sm text-[var(--ink-default)] placeholder:text-[var(--ink-muted)] ${focusRing}`}
        />
      </label>
      <Tooltip label="Search everything" shortcut="Mod+K">
        <button
          type="button"
          aria-label="Search everything"
          onClick={() => document.dispatchEvent(new CustomEvent("crema:command-palette"))}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-hover)] ${focusRing}`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <Kbd keys="Mod+K" />
        </button>
      </Tooltip>
      <button
        type="button"
        aria-pressed={editing}
        onClick={onEdit}
        className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${editing ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]" : "border-[var(--outline-default)] bg-[var(--surface-raised)] text-[var(--ink-default)] hover:bg-[var(--surface-hover)]"} ${focusRing}`}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
        {editing ? "Done" : "Edit"}
      </button>
    </header>
  );
}

function EditBanner({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-[var(--outline-strong)] px-3 py-2 text-sm text-[var(--ink-muted)]"
      role="status"
    >
      Pin a card to keep it near the top, or hide it. The rest follow what you use.
      <button
        type="button"
        onClick={onReset}
        className={`ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 font-medium text-[var(--ink-default)] hover:bg-[var(--surface-hover)] ${focusRing}`}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
      </button>
    </div>
  );
}

function HiddenCards({ cards, onRestore }: { cards: HomeCard[]; onRestore: (id: string) => void }) {
  if (!cards.length) return null;
  return (
    <details className="mt-6 text-sm">
      <summary
        className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[var(--ink-muted)] ${focusRing}`}
      >
        <EyeOff className="h-4 w-4" aria-hidden="true" /> Hidden cards ({cards.length})
      </summary>
      <ul className="mt-2 flex flex-wrap gap-2">
        {cards.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onRestore(c.id)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--outline-default)] px-3 hover:bg-[var(--surface-hover)] ${focusRing}`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" /> Show {c.title}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CardControls({
  pinned,
  title,
  onPin,
  onHide,
}: {
  pinned: boolean;
  title: string;
  onPin: () => void;
  onHide: () => void;
}) {
  const btn = `inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-raised)] text-[var(--ink-muted)] shadow-[var(--elevation-1)] hover:text-[var(--ink-default)] ${focusRing}`;
  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      <Tooltip label={pinned ? "Unpin" : "Pin"}>
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${title}`}
          onClick={onPin}
          className={btn}
        >
          {pinned ? (
            <PinOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Pin className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </Tooltip>
      <Tooltip label="Hide">
        <button type="button" aria-label={`Hide ${title}`} onClick={onHide} className={btn}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}

function CardBody({
  card,
  q,
  retry,
  loadingDrafts,
}: {
  card: HomeCard;
  q: string;
  retry: () => void;
  loadingDrafts: boolean;
}): ReactNode {
  switch (card.type) {
    case "needs-you": {
      const items = filterItems(card.items, q);
      return (
        <WorkSection
          id="home-needs-you"
          title={card.title}
          icon={<Inbox className="h-4 w-4" />}
          count={card.items.length}
          viewAll={{ href: "/desk/my-work", label: "See all" }}
          loading={false}
          empty={
            <EmptyNext
              icon={<CheckCircle2 className="h-5 w-5" />}
              message="All clear. Nothing is waiting on you."
            />
          }
          className="h-full"
        >
          {items.length ? <WorkList items={items.slice(0, 6)} label="Needs you" /> : undefined}
        </WorkSection>
      );
    }
    case "quick-create":
      return (
        <WorkSection
          id="home-quick-create"
          title={card.title}
          icon={<Plus className="h-4 w-4" />}
          loading={false}
          empty={null}
          className="h-full"
        >
          <ul className="grid grid-cols-2 gap-2" aria-label="Quick create">
            {card.doctypes.map((dt) => (
              <li key={dt}>
                <Link
                  href={newDocUrl(dt)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--outline-default)] px-2.5 text-sm font-medium text-[var(--ink-default)] hover:bg-[var(--surface-hover)] ${focusRing}`}
                >
                  <Plus
                    className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]"
                    aria-hidden="true"
                  />
                  <span className="truncate">{dt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </WorkSection>
      );
    case "continue": {
      const items = filterItems(card.items, q);
      return (
        <WorkSection
          id="home-continue"
          title={card.title}
          icon={<FilePen className="h-4 w-4" />}
          count={card.items.length}
          loading={loadingDrafts}
          onRetry={retry}
          empty={null}
          className="h-full"
        >
          {items.length ? <WorkList items={items} label="Continue" /> : undefined}
        </WorkSection>
      );
    }
    case "recent": {
      const items = filterItems(card.items, q);
      return (
        <WorkSection
          id="home-recent"
          title={card.title}
          icon={<Clock className="h-4 w-4" />}
          loading={false}
          empty={null}
          className="h-full"
        >
          {items.length ? <WorkList items={items} label="Recent" /> : undefined}
        </WorkSection>
      );
    }
    case "today":
      return (
        <WorkSection
          id="home-today"
          title={card.title}
          icon={<CalendarDays className="h-4 w-4" />}
          viewAll={{ href: "/desk/event/view/calendar", label: "Calendar" }}
          loading={false}
          empty={null}
          className="h-full"
        >
          <ul className="flex flex-col gap-1" aria-label="Events">
            {card.events.map((e) => (
              <li key={`${e.name}-${e.start}`}>
                <Link
                  href={`/desk/event/${encodeURIComponent(e.name)}`}
                  className={`flex min-h-10 items-center gap-3 rounded-md px-2 text-sm hover:bg-[var(--surface-hover)] ${focusRing}`}
                >
                  <span className="w-24 shrink-0 text-xs tabular-nums text-[var(--ink-muted)]">
                    {e.when}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[var(--ink-default)]">
                    {e.subject}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </WorkSection>
      );
    case "status":
      return (
        <section
          aria-labelledby={`h-${card.id}`}
          className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <h2
            id={`h-${card.id}`}
            className="mb-2 truncate text-xs font-medium text-[var(--ink-muted)]"
          >
            {card.title} by status
          </h2>
          <ul className="flex flex-col gap-1">
            {card.counts.map((c) => (
              <li key={c.status}>
                <Link
                  href={c.href}
                  className={`flex min-h-8 items-center gap-2 rounded-md px-1 text-sm hover:bg-[var(--surface-hover)] ${focusRing}`}
                >
                  <StatusPill indicator={guessColour(c.status)}>{c.status}</StatusPill>
                  <span className="ml-auto font-semibold tabular-nums text-[var(--ink-default)]">
                    {c.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    case "kpi":
      return <NumberCard name={card.card.name} label={card.title} />;
    case "chart":
      return <HomeChart name={card.card.name} title={card.title} />;
  }
}

/** a chart whose period has no data is left out (§ 4.1.5: no empty tiles); same query as ChartCard, so one request */
function HomeChart({ name, title }: { name: string; title: string }) {
  const { data } = useDashboardChart(name);
  const empty =
    !!data &&
    (!data.labels.length ||
      !data.datasets.length ||
      data.datasets.every((d) => d.values.every((v) => !v)));
  if (empty) return <div data-empty hidden />;
  return <ChartCard name={name} label={title} height={200} />;
}

function HomeSkeleton() {
  return (
    <div className="grid grid-cols-12 gap-4" role="status" aria-label="Loading your home">
      {[4, 4, 4, 2, 2, 2, 2].map((w, i) => (
        <div
          key={i}
          className={`${SPAN[w as CardSize]} h-40 animate-pulse rounded-xl bg-[var(--surface-sunken)]`}
        />
      ))}
    </div>
  );
}
