"use client";

/**
 * The list's rows (list_view.js get_list_row_html): a table on wider screens, one card per row on phones.
 * Title (title_field / name) · status indicator · list fields · assignees, modified, comments, like.
 */
import { Fragment, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import type { Filter, Row } from "@/lib/list/api";
import type { DocField, DocTypeMeta } from "@/lib/frappe/types";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import { getIndicator, INDICATOR_PILL, indicatorFilters } from "@/lib/list/indicator";
import { formatCell, timeAgo } from "@/lib/list/format";
import { isUnread, jsonList } from "@/lib/list/rowMeta";
import { sanitizeHtml } from "@/lib/report/columns";
import { AssigneeAvatars, CommentCount, LikeButton } from "@/components/list/RowExtras";
import { RowButtons } from "@/components/list/ListHooksUI";
import {
  formatterFor,
  NUMERIC_TYPES,
  rowHref,
  type ListSettings,
} from "@/components/list/listModel";

/** what every row needs from the list (kept stable, so checking a row re-renders only its checkbox and highlight) */
export interface RowContext {
  doctype: string;
  meta: DocTypeMeta;
  settings: ListSettings;
  user: string;
  titleField: string;
  listFields: DocField[];
  hasIndicator: boolean;
  disableCommentCount: boolean;
  dateFormat: string;
  currency: string | undefined;
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
  addFilter: (f: Filter) => void;
  onLikeChanged: () => void;
  /** wide screens (New layout): the previewed row, and a click previews instead of opening (ListPreviewPane) */
  previewing?: string | null;
  onPreview?: (name: string) => void;
}

/** the checked rows: the set, replace it (select all / none), toggle one row */
export interface Selection {
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  toggle: (name: string) => void;
}

const checkboxCls = "h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100";

function rowInfo(r: Row, c: RowContext) {
  const unread = !!c.meta.track_seen && !!c.user && isUnread(r._seen, c.user);
  return {
    ind: c.hasIndicator ? getIndicator(r, c.meta, c.settings) : null,
    href: rowHref(c.settings, c.doctype, r),
    subject: c.titleField && r[c.titleField] ? String(r[c.titleField]) : r.name,
    unread,
    showName: !c.settings?.hide_name_column,
  };
}

/** avatar_group filterable: an assignee avatar filters the list to that user's assignments */
const RowMeta = memo(function RowMeta({ r, c, cards }: { r: Row; c: RowContext; cards?: boolean }) {
  const avatars = (
    <AssigneeAvatars
      users={jsonList(r._assign)}
      onFilter={(u) => c.addFilter([c.doctype, "_assign", "like", `%${u}%`])}
    />
  );
  const comments = !c.disableCommentCount && <CommentCount count={r._comment_count} />;
  const like = (
    <LikeButton
      doctype={c.doctype}
      name={r.name}
      likedBy={r._liked_by}
      user={c.user}
      onChanged={c.onLikeChanged}
    />
  );
  return cards ? (
    <span className="ml-auto inline-flex shrink-0 items-center gap-2">
      {avatars}
      {comments}
      {like}
      {timeAgo(r.modified)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      {avatars}
      {timeAgo(r.modified)}
      {comments}
      {like}
    </span>
  );
});

function SelectAll({ rows, sel }: { rows: Row[]; sel: Selection }) {
  const all = rows.length > 0 && rows.every((r) => sel.selected.has(r.name));
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      checked={all}
      onChange={() => sel.setSelected(all ? new Set() : new Set(rows.map((r) => r.name)))}
      className={checkboxCls}
    />
  );
}

function SelectRow({
  name,
  checked,
  onToggle,
  className = checkboxCls,
}: {
  name: string;
  checked: boolean;
  onToggle: (name: string) => void;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={`Select ${name}`}
      checked={checked}
      onChange={() => onToggle(name)}
      className={className}
    />
  );
}

// ── Phones: one card per row (title + status, up to three list fields, updated) ──────────────────────────────
const RowCard = memo(function RowCard({
  r,
  c,
  checked,
  onToggle,
}: {
  r: Row;
  c: RowContext;
  checked: boolean;
  onToggle: (name: string) => void;
}) {
  const { ind, href, subject, unread, showName } = rowInfo(r, c);
  return (
    <li
      className={`relative flex gap-3 px-3 py-3 ${checked ? "bg-zinc-50 dark:bg-zinc-800/40" : ""}`}
    >
      <SelectRow
        name={r.name}
        checked={checked}
        onToggle={onToggle}
        className={`relative z-10 mt-0.5 shrink-0 ${checkboxCls}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* the link covers the card (after:inset-0) so the whole card opens the document */}
          <Link
            href={href}
            data-unread={unread || undefined}
            className={`min-w-0 flex-1 truncate text-zinc-900 after:absolute after:inset-0 dark:text-zinc-100 ${unread ? "font-bold" : "font-medium"}`}
          >
            {subject}
          </Link>
          {ind && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${INDICATOR_PILL[ind[1]] ?? INDICATOR_PILL.gray}`}
            >
              {ind[0]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
          {subject !== r.name && showName && <span className="truncate">{r.name}</span>}
          <RowMeta r={r} c={c} cards />
        </div>
        {c.listFields.length > 0 && (
          <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
            {c.listFields.slice(0, 3).map((f) => {
              const text = formatCell(r[f.fieldname], f, r, {
                currency: c.currency,
                dateFormat: c.dateFormat,
              });
              if (!text) return null;
              return (
                <Fragment key={f.fieldname}>
                  <dt className="text-zinc-400">{f.label}</dt>
                  <dd className="truncate text-zinc-700 dark:text-zinc-300">{text}</dd>
                </Fragment>
              );
            })}
          </dl>
        )}
      </div>
    </li>
  );
});

export function ListCards({
  rows,
  total,
  showCount,
  c,
  sel,
}: {
  rows: Row[];
  total: number;
  showCount: boolean;
  c: RowContext;
  sel: Selection;
}) {
  return (
    <>
      {rows.length > 0 && (
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
          <SelectAll rows={rows} sel={sel} />
          <span>{sel.selected.size > 0 ? `${sel.selected.size} selected` : "Select all"}</span>
          {showCount && (
            <span className="ml-auto">
              {rows.length} of {total}
            </span>
          )}
        </div>
      )}
      <ul
        aria-label={`${c.doctype} list`}
        className="divide-y divide-zinc-100 dark:divide-zinc-800/70"
      >
        {rows.map((r) => (
          <RowCard
            key={r.name}
            r={r}
            c={c}
            checked={sel.selected.has(r.name)}
            onToggle={sel.toggle}
          />
        ))}
      </ul>
    </>
  );
}

// ── Wider screens: a table ─────────────────────────────────────────────────────────────────────────────────────
const FieldCell = memo(function FieldCell({ r, f, c }: { r: Row; f: DocField; c: RowContext }) {
  const text = formatCell(r[f.fieldname], f, r, { currency: c.currency, dateFormat: c.dateFormat });
  const fmt = formatterFor(c.settings, f.fieldname);
  let html = "";
  if (fmt) {
    try {
      html = sanitizeHtml(String(fmt(r[f.fieldname], f, r) ?? ""));
    } catch (e) {
      console.warn(`listview_settings.formatters.${f.fieldname}:`, e);
      html = sanitizeHtml(String(r[f.fieldname] ?? ""));
    }
  }
  let body: React.ReactNode = text;
  if (fmt) body = <span data-formatted={f.fieldname} dangerouslySetInnerHTML={{ __html: html }} />;
  else if (f.fieldtype === "Link" && text)
    body = (
      <button
        type="button"
        onClick={() => c.addFilter([c.doctype, f.fieldname, "=", r[f.fieldname]])}
        className="truncate hover:underline"
        title={`Filter by ${text}`}
      >
        {text}
      </button>
    );
  return (
    <td
      className={`max-w-[16rem] truncate whitespace-nowrap px-3 py-2.5 text-zinc-700 dark:text-zinc-300 ${NUMERIC_TYPES.has(f.fieldtype) ? "text-right tabular-nums" : ""}`}
    >
      {body}
    </td>
  );
});

const TableRow = memo(function TableRow({
  r,
  c,
  hasRowButtons,
  checked,
  onToggle,
}: {
  r: Row;
  c: RowContext;
  hasRowButtons: boolean;
  checked: boolean;
  onToggle: (name: string) => void;
}) {
  const router = useRouter();
  const { ind, href, subject, unread, showName } = rowInfo(r, c);
  const onRowClick = (e: React.MouseEvent) => {
    // controls inside the row (links, buttons, an app's row dropdown menu) don't open the record
    if ((e.target as HTMLElement).closest("a,button,input,[role=menu],[role=menuitem]")) return;
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener");
    else if (c.onPreview) c.onPreview(r.name);
    else router.push(href);
  };
  // in preview mode the title link previews too (it stays a real link: ⌘/Ctrl-click, middle-click, copy)
  const onTitleClick = (e: React.MouseEvent) => {
    if (!c.onPreview || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    c.onPreview(r.name);
  };
  const active = c.previewing === r.name;
  return (
    // the row is a shortcut for its title link, which is the keyboard / screen reader path to the record
    <tr
      onClick={onRowClick}
      aria-current={active || undefined}
      data-row={r.name}
      // focusable like Desk's .list-row-container, for ↑ / ↓ / Enter / Space (useListKeys)
      tabIndex={-1}
      className={`group cursor-pointer border-b border-zinc-100 outline-none last:border-0 hover:bg-zinc-50 focus-visible:bg-[var(--surface-selected)] focus-visible:shadow-[inset_3px_0_0_var(--focus-color)] dark:border-zinc-800/70 dark:hover:bg-zinc-800/40 ${active ? "bg-[var(--surface-selected)] shadow-[inset_3px_0_0_var(--focus-color)]" : checked ? "bg-zinc-50 dark:bg-zinc-800/40" : ""}`}
    >
      <td className="px-3 py-2.5">
        <SelectRow name={r.name} checked={checked} onToggle={onToggle} />
      </td>
      <td className="max-w-[18rem] px-3 py-2.5">
        <Link
          href={href}
          onClick={onTitleClick}
          data-unread={unread || undefined}
          className={`block truncate text-zinc-900 hover:underline dark:text-zinc-100 ${unread ? "font-bold" : "font-medium"}`}
        >
          {subject}
        </Link>
        {subject !== r.name && showName && (
          <span className="block truncate text-xs text-zinc-400">{r.name}</span>
        )}
      </td>
      {c.hasIndicator && (
        <td className="whitespace-nowrap px-3 py-2.5">
          {ind && (
            <button
              type="button"
              title={`Filter by ${ind[0]}`}
              onClick={() =>
                ind[2] &&
                c.setFilters([...c.filters, ...(indicatorFilters(c.doctype, ind[2]) as Filter[])])
              }
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${INDICATOR_PILL[ind[1]] ?? INDICATOR_PILL.gray}`}
            >
              {ind[0]}
            </button>
          )}
        </td>
      )}
      {c.listFields.map((f) => (
        <FieldCell key={f.fieldname} r={r} f={f} c={c} />
      ))}
      {hasRowButtons && c.settings && (
        <td className="whitespace-nowrap px-3 py-2.5">
          <RowButtons settings={c.settings} doc={r} />
        </td>
      )}
      <td
        className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-zinc-400"
        title={String(r.modified ?? "")}
      >
        {/* get_meta_html: assignees · modified · comments · like */}
        <RowMeta r={r} c={c} />
      </td>
    </tr>
  );
});

export function ListTable({
  rows,
  total,
  showCount,
  colSettings,
  subjectLabel,
  c,
  sel,
}: {
  rows: Row[];
  total: number;
  showCount: boolean;
  colSettings: ListColumnSetting[];
  subjectLabel: string;
  c: RowContext;
  sel: Selection;
}) {
  const widths = new Map(colSettings.map((x) => [x.fieldname, x.width]));
  const minWidth = (fieldname: string) => {
    const w = widths.get(fieldname);
    return w ? { minWidth: w } : undefined;
  };
  const hasRowButtons = !!c.settings?.button || !!c.settings?.dropdown_button;
  const likedByMe = c.filters.some((f) => f[1] === "_liked_by");
  // .list-liked-by-me: filter to what I liked
  const toggleLikedByMe = () =>
    c.setFilters(
      likedByMe
        ? c.filters.filter((f) => f[1] !== "_liked_by")
        : [...c.filters, [c.doctype, "_liked_by", "like", `%${c.user}%`]]
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
            <th className="w-10 px-3 py-2.5">
              <SelectAll rows={rows} sel={sel} />
            </th>
            <th className="px-3 py-2.5" style={minWidth(colSettings[0]?.fieldname ?? "name")}>
              {subjectLabel}
            </th>
            {c.hasIndicator && <th className="px-3 py-2.5">Status</th>}
            {c.listFields.map((f) => (
              <th
                key={f.fieldname}
                style={minWidth(f.fieldname)}
                className={`whitespace-nowrap px-3 py-2.5 ${NUMERIC_TYPES.has(f.fieldtype) ? "text-right" : ""}`}
              >
                {f.label}
              </th>
            ))}
            {hasRowButtons && <th className="px-3 py-2.5" />}
            <th className="w-24 px-3 py-2.5 text-right">
              <span className="inline-flex items-center gap-2">
                {showCount && `${rows.length} of ${total}`}
                <button
                  type="button"
                  aria-pressed={likedByMe}
                  aria-label="Liked by me"
                  title="Liked by me"
                  onClick={toggleLikedByMe}
                  className="rounded p-0.5 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${likedByMe ? "fill-red-500 text-red-500" : ""}`}
                    aria-hidden
                  />
                </button>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <TableRow
              key={r.name}
              r={r}
              c={c}
              hasRowButtons={hasRowButtons}
              checked={sel.selected.has(r.name)}
              onToggle={sel.toggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
