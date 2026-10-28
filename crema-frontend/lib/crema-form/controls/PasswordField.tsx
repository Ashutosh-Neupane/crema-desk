"use client";

import { useState } from "react";
import type { FieldControlProps } from "./index";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({ field, inputId, value, onChange, disabled }: FieldControlProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={inputId ?? field.fieldname}
        type={show ? "text" : "password"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value || null)}
        readOnly={!!field.read_only}
        disabled={disabled || !!field.read_only}
        placeholder={String(field.placeholder ?? "")}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-10 text-sm focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2"
      />
      <button aria-label={show ? "Hide password" : "Show password"}
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
