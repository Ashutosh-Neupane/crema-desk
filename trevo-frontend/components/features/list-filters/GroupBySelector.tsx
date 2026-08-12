"use client";

import { useState, useRef, useEffect } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import type { DocField } from "@/lib/frappe/types";

interface GroupBySelectorProps {
  fields: DocField[];
  value: string;
  onChange: (fieldname: string) => void;
}

/** Fields that make sense to group by */
const GROUPABLE_TYPES = ["Select", "Link", "Data", "Check", "Status", "Autocomplete"];

export function GroupBySelector({ fields, value, onChange }: GroupBySelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const groupableFields = fields.filter(
    (f) =>
      GROUPABLE_TYPES.includes(f.fieldtype) &&
      !["Section Break", "Column Break", "Tab Break", "Heading"].includes(f.fieldtype) &&
      !f.hidden,
  );

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Group by field"
        aria-expanded={open}
        className={[
          "gap-1.5",
          value ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300" : "",
        ].join(" ")}
      >
        <Layers className="h-4 w-4" />
        {value ? (
          <>
            Group: <span className="font-semibold">{fields.find((f) => f.fieldname === value)?.label || value}</span>
          </>
        ) : (
          "Group By"
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="p-1">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                aria-label="Clear group by"
              >
                ✕ Clear grouping
              </button>
            )}
            {groupableFields.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">No groupable fields</p>
            ) : (
              groupableFields.map((f) => (
                <button
                  key={f.fieldname}
                  type="button"
                  onClick={() => { onChange(f.fieldname); setOpen(false); }}
                  className={[
                    "flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors",
                    value === f.fieldname
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700",
                  ].join(" ")}
                  aria-pressed={value === f.fieldname}
                >
                  <span>{f.label || f.fieldname}</span>
                  <span className="text-xs text-zinc-400">{f.fieldtype}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
