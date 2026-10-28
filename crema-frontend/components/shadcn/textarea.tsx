"use client";

import * as React from "react";

export function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`flex min-h-[60px] w-full rounded-lg border border-[var(--control-bg)] bg-[var(--control-bg)] px-2 py-1.5 text-sm text-foreground transition-colors placeholder:text-[var(--placeholder-color)] focus-visible:outline-none focus-visible:shadow-[var(--focus-default)] disabled:cursor-not-allowed disabled:bg-[var(--disabled-control-bg)] disabled:opacity-70 dark:border-[var(--control-bg)] dark:bg-[var(--control-bg)] dark:text-foreground ${className}`}
      {...props}
    />
  );
}
