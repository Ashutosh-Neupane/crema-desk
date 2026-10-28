import * as React from "react";

export function Badge({ className = "", variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" | "destructive" }) {
  const variants = {
    default: "border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
    secondary: "border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
    outline: "text-zinc-950 dark:border-zinc-800 dark:text-zinc-50",
    destructive: "border-transparent bg-red-600 text-white",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
