import * as React from "react";

export function Button({
  className = "",
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  // Frappe desk metrics: 28px height, 8px radius, 13px text, weight 500
  const base =
    "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-zinc-800 dark:hover:bg-zinc-200",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-zinc-300 bg-card text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-800",
    secondary: "bg-zinc-100 text-foreground hover:bg-zinc-200 dark:bg-zinc-800 dark:text-foreground dark:hover:bg-zinc-700",
    ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-800",
    link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-300",
  };
  const sizes = {
    default: "h-7 px-3 py-1", // Frappe --btn-height: 28px
    sm: "h-6 rounded-md px-2 text-xs",
    lg: "h-9 rounded-lg px-4",
    icon: "h-7 w-7",
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
  );
}
