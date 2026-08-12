"use client";

import { useNumberCard } from "@/lib/hooks/useDashboardChart";
import { Card } from "@/components/shadcn/card";
import { TrendingUp } from "lucide-react";

interface NumberCardItem {
  number_card_name: string;
  label?: string;
}

/**
 * Client island — live number cards with auto-refresh.
 * Rendered separately from the workspace shell so the shell stays server-rendered.
 */
export function WorkspaceNumberCardsClient({
  numberCards,
}: {
  numberCards: NumberCardItem[];
}) {
  return (
    <div className="space-y-3">
      {numberCards.map((card) => (
        <NumberCardLive key={card.number_card_name} card={card} />
      ))}
    </div>
  );
}

function NumberCardLive({ card }: { card: NumberCardItem }) {
  const { data, isLoading } = useNumberCard(card.number_card_name);

  const displayValue =
    isLoading
      ? null
      : data?.value != null
      ? typeof data.value === "number"
        ? data.value.toLocaleString()
        : String(data.value)
      : "—";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {data?.label ?? card.label ?? card.number_card_name}
          </p>
          {isLoading ? (
            <div
              className="mt-1 h-8 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-700"
              aria-label="Loading"
            />
          ) : (
            <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {displayValue}
            </p>
          )}
          {data?.doctype && (
            <p className="mt-0.5 text-xs text-zinc-400">{data.doctype}</p>
          )}
        </div>
        <div
          className="rounded-lg p-2"
          style={{ backgroundColor: `${data?.color ?? "#2490ef"}18` }}
          aria-hidden="true"
        >
          <TrendingUp
            className="h-5 w-5"
            style={{ color: data?.color ?? "#2490ef" }}
          />
        </div>
      </div>
    </Card>
  );
}
