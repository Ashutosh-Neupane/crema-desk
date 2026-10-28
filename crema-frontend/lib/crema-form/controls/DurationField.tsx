"use client";

import { useState } from "react";
import type { FieldControlProps } from "./index";

export default function DurationField({ field, value, onChange, disabled }: FieldControlProps) {
  const parts = typeof value === "string" ? value.split(":").map(Number) : [0, 0, 0];
  const [hours, setHours] = useState(Number.isNaN(parts[0]) ? 0 : parts[0]);
  const [minutes, setMinutes] = useState(Number.isNaN(parts[1]) ? 0 : parts[1]);
  const [seconds, setSeconds] = useState(Number.isNaN(parts[2]) ? 0 : parts[2]);

  const update = (h: number, m: number, s: number) => {
    setHours(h);
    setMinutes(m);
    setSeconds(s);
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(`${pad(h)}:${pad(m)}:${pad(s)}`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">HH</span>
        <input aria-label="Hours"
          type="number"
          min="0"
          value={hours}
          onChange={(e) => update(parseInt(e.target.value || "0", 10), minutes, seconds)}
          disabled={disabled || !!field.read_only}
          className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-center dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <span className="text-zinc-400">:</span>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">MM</span>
        <input aria-label="Minutes"
          type="number"
          min="0"
          max="59"
          value={minutes}
          onChange={(e) => update(hours, parseInt(e.target.value || "0", 10), seconds)}
          disabled={disabled || !!field.read_only}
          className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-center dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <span className="text-zinc-400">:</span>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-zinc-500">SS</span>
        <input aria-label="Seconds"
          type="number"
          min="0"
          max="59"
          value={seconds}
          onChange={(e) => update(hours, minutes, parseInt(e.target.value || "0", 10))}
          disabled={disabled || !!field.read_only}
          className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-center dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}
