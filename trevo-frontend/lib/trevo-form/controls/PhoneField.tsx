"use client";

import type { FieldControlProps } from "./index";

/**
 * Phone field — maps to Frappe fieldtype "Phone".
 * Tel input with an optional country-code prefix selector.
 */

const DIAL_CODES = [
  { code: "+1",   label: "🇺🇸 +1" },
  { code: "+44",  label: "🇬🇧 +44" },
  { code: "+91",  label: "🇮🇳 +91" },
  { code: "+61",  label: "🇦🇺 +61" },
  { code: "+49",  label: "🇩🇪 +49" },
  { code: "+33",  label: "🇫🇷 +33" },
  { code: "+81",  label: "🇯🇵 +81" },
  { code: "+86",  label: "🇨🇳 +86" },
  { code: "+55",  label: "🇧🇷 +55" },
  { code: "+27",  label: "🇿🇦 +27" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+65",  label: "🇸🇬 +65" },
  { code: "+60",  label: "🇲🇾 +60" },
  { code: "+977", label: "🇳🇵 +977" },
];

function splitPhone(val: string): { dialCode: string; number: string } {
  for (const { code } of DIAL_CODES) {
    if (val.startsWith(code)) {
      return { dialCode: code, number: val.slice(code.length).trim() };
    }
  }
  return { dialCode: "", number: val };
}

export default function PhoneField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" ? value : "";
  const { dialCode, number } = splitPhone(str);
  const isDisabled = disabled || !!field.read_only;

  const handleDialCode = (code: string) => {
    onChange(code ? `${code} ${number}`.trim() : number);
  };

  const handleNumber = (num: string) => {
    onChange(dialCode ? `${dialCode} ${num}`.trim() : num);
  };

  return (
    <div className="flex gap-2">
      {/* Dial code selector */}
      <select
        value={dialCode}
        onChange={(e) => handleDialCode(e.target.value)}
        disabled={isDisabled}
        aria-label="Country dial code"
        className={[
          "w-32 flex-shrink-0 rounded-lg border px-2 py-2 text-sm transition-colors",
          error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 focus:ring-zinc-900/20 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
          isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
        ].join(" ")}
      >
        <option value="">Any</option>
        {DIAL_CODES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>

      {/* Phone number input */}
      <input
        type="tel"
        id={inputId ?? field.fieldname}
        value={number}
        onChange={(e) => handleNumber(e.target.value)}
        disabled={isDisabled}
        placeholder="Phone number"
        aria-label={field.label || field.fieldname}
        aria-required={!!field.reqd}
        aria-invalid={!!error}
        className={[
          "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
          error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
          "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
          isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
        ].join(" ")}
      />
    </div>
  );
}
