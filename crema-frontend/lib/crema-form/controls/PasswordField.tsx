"use client";

/**
 * Password (Desk: form/controls/password.js): a saved password comes back masked ("********") and stays that way
 * unless retyped; the eye shows what you typed (not offered for the mask); typing shows the strength
 * (frappe.core.doctype.user.user.test_password_strength, debounced 500 ms: Weak / Average / Strong / Excellent).
 */
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { frappeMethod } from "@/lib/frappe/client";
import type { FieldControlProps } from "./index";

// set_strength_indicator: score 0–4 → colour → [label, width]
const STRENGTH: Array<[string, string, number]> = [
  ["Weak", "bg-red-500", 25],
  ["Weak", "bg-red-500", 25],
  ["Average", "bg-amber-500", 50],
  ["Strong", "bg-blue-500", 75],
  ["Excellent", "bg-green-500", 100],
];

type Strength = (typeof STRENGTH)[number];

/** test_password_strength for what was typed, debounced 500 ms; null for a masked / empty / read-only value */
function usePasswordStrength(str: string, enabled: boolean): Strength | null {
  const [score, setScore] = useState<{ for: string; score: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      void frappeMethod<{ score?: number }>("frappe.core.doctype.user.user.test_password_strength", { new_password: str })
        .then((r) => typeof r?.score === "number" && setScore({ for: str, score: r.score }))
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [str, enabled]);
  if (!enabled || score?.for !== str) return null;
  return STRENGTH[Math.max(0, Math.min(4, score.score))];
}

function StrengthMeter({ strength: [label, colour, width] }: { strength: Strength }) {
  return (
    <div className="mt-1.5" data-password-strength={label}>
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
      <div role="progressbar" aria-label="Password strength" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100} className="mt-0.5 h-1 w-full rounded bg-zinc-200 dark:bg-zinc-700">
        <div className={`h-1 rounded ${colour}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

const inputClass = (error: unknown, readOnly: boolean) =>
  `w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"} ${readOnly ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "bg-white"}`;

export default function PasswordField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = value == null ? "" : String(value);
  const [show, setShow] = useState(false);
  const readOnly = disabled || !!field.read_only;
  const masked = str.includes("*");
  const editable = !masked && !readOnly;
  const strength = usePasswordStrength(str, editable && !!str);

  return (
    <div>
      <div className="relative">
        <input
          id={inputId ?? field.fieldname}
          type={show && !masked ? "text" : "password"}
          value={str}
          autoComplete="new-password"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={readOnly}
          placeholder={String(field.placeholder ?? "")}
          className={inputClass(error, readOnly)}
        />
        {editable && (
          <button
            aria-label={show ? "Hide password" : "Show password"}
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {strength && <StrengthMeter strength={strength} />}
    </div>
  );
}
