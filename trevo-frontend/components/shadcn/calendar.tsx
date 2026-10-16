"use client";

/** shadcn/ui Calendar (react-day-picker v9) styled with Trevo tokens, light + dark. */
import { DayPicker, getDefaultClassNames, type DayPickerProps } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({ className = "", classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  const d = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={`p-3 ${className}`}
      classNames={{
        root: `${d.root} text-sm`,
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-3",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: "inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        button_next: "inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
        month_caption: "flex h-7 items-center justify-center",
        // dropdown caption (shadcn): the native <select> is an invisible overlay on the
        // label, so "October" shows once (without rdp's stylesheet both rendered)
        caption_label: "flex h-7 items-center gap-1 rounded-md pl-2 pr-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500",
        dropdowns: "flex h-7 items-center justify-center gap-1.5 text-sm font-medium",
        dropdown_root: "relative rounded-md border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
        dropdown: "absolute inset-0 w-full cursor-pointer opacity-0",
        months_dropdown: "",
        years_dropdown: "",
        weekdays: "flex",
        weekday: "w-8 text-center text-[11px] font-normal text-zinc-400",
        week: "mt-1 flex w-full",
        day: "h-8 w-8 p-0 text-center",
        day_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-sm text-zinc-800 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-200 dark:hover:bg-zinc-800",
        selected: "[&>button]:bg-zinc-900 [&>button]:text-white [&>button]:hover:bg-zinc-900 dark:[&>button]:bg-zinc-100 dark:[&>button]:text-zinc-900",
        today: "[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4",
        outside: "[&>button]:text-zinc-300 dark:[&>button]:text-zinc-600",
        disabled: "[&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : orientation === "down" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
