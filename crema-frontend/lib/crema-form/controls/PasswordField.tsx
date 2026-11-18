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

export default function PasswordField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = value == null ? "" : String(value);
  const [show, setShow] = useState(false);
  const [score, setScore] = useState<{ for: string; score: number } | null>(null);
  const readOnly = disabled || !!field.read_only;
  const masked = str.includes("*");

  useEffect(() => {
    if (!str || masked || readOnly) return;
    const t = setTimeout(() => {
      void frappeMethod<{ score?: number }>("frappe.core.doctype.user.user.test_password_strength", { new_password: str })
        .then((r) => typeof r?.score === "number" && setScore({ for: str, score: r.score }))
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [str, masked, readOnly]);
  const strength = score && score.for === str && str && !masked ? STRENGTH[Math.max(0, Math.min(4, score.score))] : null;

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
          className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-500 focus:ring-zinc-900/10 dark:border-zinc-700"} ${readOnly ? "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800" : "bg-white"}`}
        />
        {!masked && !readOnly && (
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
      {strength && (
        <div className="mt-1.5" data-password-strength={strength[0]}>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">{strength[0]}</div>
          <div role="progressbar" aria-label="Password strength" aria-valuenow={strength[2]} aria-valuemin={0} aria-valuemax={100} className="mt-0.5 h-1 w-full rounded bg-zinc-200 dark:bg-zinc-700">
            <div className={`h-1 rounded ${strength[1]}`} style={{ width: `${strength[2]}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
