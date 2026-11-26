"use client";

/** The rows box: rows (ListRows), the empty state, the loading placeholder, and page size + Load more (base_list.js paging). */
import { useState } from "react";
import type { Row } from "@/lib/list/api";
import type { ListColumnSetting } from "@/lib/list/useListViewSettings";
import { ListCards, ListTable, type RowContext, type Selection } from "@/components/list/ListRows";

const PAGE_SIZES = [20, 100, 500];

function ListEmpty({ doctype, filtered, canCreate, addDisabled, onClear, onAdd }: { doctype: string; filtered: boolean; canCreate: boolean; addDisabled: boolean; onClear: () => void; onAdd: () => void }) {
  const linkCls = "mt-3 text-sm font-medium text-zinc-900 underline dark:text-zinc-100";
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm text-zinc-500">{filtered ? `No ${doctype} matches these filters` : `You haven't created a ${doctype} yet`}</p>
      {filtered ? (
        <button type="button" onClick={onClear} className={linkCls}>
          Clear filters
        </button>
      ) : (
        canCreate && (
          <button type="button" onClick={onAdd} disabled={addDisabled} className={linkCls}>
            Create your first {doctype}
          </button>
        )
      )}
    </div>
  );
}

/** the chosen page size (20 / 100 / 500) is also how many rows "Load more" adds (start += page_length) */
function ListPager({ pageStep, onPageSize, showMore, onMore }: { pageStep: number; onPageSize: (n: number) => void; showMore: boolean; onMore: () => void }) {
  return (
    <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800">
      {PAGE_SIZES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPageSize(n)}
          className={`rounded-md px-2 py-1 ${pageStep === n ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
        >
          {n}
        </button>
      ))}
      {showMore && (
        <button type="button" onClick={onMore} className="ml-auto rounded-md border border-zinc-200 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          Load more
        </button>
      )}
    </div>
  );
}

export function ListBody({
  phone,
  list,
  showCount,
  colSettings,
  subjectLabel,
  pageLength,
  setPageLength,
  filtered,
  canCreate,
  addDisabled,
  onAdd,
  onClear,
  c,
  sel,
}: {
  phone: boolean;
  list: { rows: Row[]; total: number; isLoading: boolean };
  showCount: boolean;
  colSettings: ListColumnSetting[];
  subjectLabel: string;
  pageLength: number;
  setPageLength: (n: number) => void;
  filtered: boolean;
  canCreate: boolean;
  addDisabled: boolean;
  onAdd: () => void;
  onClear: () => void;
  c: RowContext;
  sel: Selection;
}) {
  const { rows, total } = list;
  const [pageStep, setPageStep] = useState(20);
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {phone ? <ListCards rows={rows} total={total} showCount={showCount} c={c} sel={sel} /> : <ListTable rows={rows} total={total} showCount={showCount} colSettings={colSettings} subjectLabel={subjectLabel} c={c} sel={sel} />}
      {!list.isLoading && rows.length === 0 && <ListEmpty doctype={c.doctype} filtered={filtered} canCreate={canCreate} addDisabled={addDisabled} onClear={onClear} onAdd={onAdd} />}
      {list.isLoading && <div className="h-40 animate-pulse bg-zinc-50 dark:bg-zinc-900" />}
      {rows.length > 0 && (
        <ListPager
          pageStep={pageStep}
          onPageSize={(n) => {
            setPageStep(n);
            setPageLength(n);
          }}
          showMore={showCount ? rows.length < total : rows.length >= pageLength}
          onMore={() => setPageLength(pageLength + pageStep)}
        />
      )}
    </div>
  );
}
