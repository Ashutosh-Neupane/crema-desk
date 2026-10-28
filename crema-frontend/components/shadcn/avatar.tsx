"use client";

import * as React from "react";

export function Avatar({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 ${className}`}
      {...props}
    />
  );
}

export function AvatarImage({ className = "", alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`aspect-square h-full w-full ${className}`}
      alt={alt}
      {...props}
    />
  );
}

export function AvatarFallback({ className = "", children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`flex h-full w-full items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
