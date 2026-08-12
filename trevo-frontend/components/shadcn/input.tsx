import * as React from "react";

export function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  // Frappe form control: 28px height, gray-100 bg, transparent border,
  // focus ring via --focus-default box-shadow
  return (
    <input
      className={`flex h-7 w-full rounded-lg border border-[var(--control-bg)] bg-[var(--control-bg)] px-2 py-1 text-sm text-foreground transition-colors placeholder:text-[var(--placeholder-color)] focus-visible:outline-none focus-visible:border-[var(--control-bg)] focus-visible:shadow-[var(--focus-default)] disabled:cursor-not-allowed disabled:bg-[var(--disabled-control-bg)] disabled:opacity-70 dark:border-[var(--control-bg)] dark:bg-[var(--control-bg)] dark:text-foreground ${className}`}
      {...props}
    />
  );
}
