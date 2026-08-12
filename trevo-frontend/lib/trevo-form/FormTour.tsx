"use client";

/**
 * FormTour — runs Frappe Form Tour documents on form load.
 *
 * Fetches Form Tour documents for the current DocType. If one exists
 * and hasn't been dismissed (checked in localStorage), runs a simple
 * step-by-step highlight tour using a lightweight inline implementation
 * (no external driver.js dependency — avoids a 20 KB bundle addition
 * for a rarely-triggered feature).
 *
 * localStorage key: trevo_tour_<doctype>_done
 */

import { useEffect, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";

interface FormTourStep {
  fieldname?: string;
  title?: string;
  description?: string;
  next_step_label?: string;
}

interface FormTourDoc {
  name: string;
  title: string;
  steps?: FormTourStep[];
}

interface FormTourProps {
  doctype: string;
  enabled?: boolean;
}

export function FormTour({ doctype, enabled = true }: FormTourProps) {
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `trevo_tour_${doctype}_done`;

  // Check if tour was already completed
  const alreadyDone =
    typeof window !== "undefined"
      ? !!localStorage.getItem(storageKey)
      : true;

  const { data: tourDoc } = useQuery<FormTourDoc | null>({
    queryKey: ["form-tour", doctype],
    queryFn: async () => {
      try {
        const list = await frappeMethod<FormTourDoc[]>("frappe.client.get_list", {
          doctype: "Form Tour",
          filters: [["reference_doctype", "=", doctype], ["is_standard", "=", 0]],
          fields: ["name", "title"],
          limit: 1,
        });
        if (!list?.length) return null;
        const doc = await frappeMethod<FormTourDoc>("frappe.client.get", {
          doctype: "Form Tour",
          name: list[0].name,
        });
        return doc ?? null;
      } catch {
        return null;
      }
    },
    enabled: enabled && !alreadyDone,
    staleTime: Infinity, // tour definition is static
  });

  // Start tour once doc is loaded
  useEffect(() => {
    if (!tourDoc || alreadyDone || dismissed) return;
    const steps = tourDoc.steps ?? [];
    if (steps.length === 0) return;
    // Start after a brief delay so the form has rendered
    const timer = setTimeout(() => setCurrentStep(0), 800);
    return () => clearTimeout(timer);
  }, [tourDoc, alreadyDone, dismissed]);

  const currentTourStep =
    tourDoc?.steps?.[currentStep] ?? null;

  const handleNext = useCallback(() => {
    const steps = tourDoc?.steps ?? [];
    if (currentStep >= steps.length - 1) {
      // Tour complete
      setCurrentStep(-1);
      localStorage.setItem(storageKey, "1");
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, tourDoc, storageKey]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setCurrentStep(-1);
    localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  if (currentStep < 0 || !currentTourStep) return null;

  const steps = tourDoc?.steps ?? [];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Form tour step ${currentStep + 1} of ${steps.length}`}
      className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
    >
      {/* Progress dots */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === currentStep
                  ? "bg-blue-500"
                  : i < currentStep
                  ? "bg-blue-200"
                  : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-zinc-400">
          {currentStep + 1}/{steps.length}
        </span>
      </div>

      {currentTourStep.title && (
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {currentTourStep.title}
        </h3>
      )}
      {currentTourStep.description && (
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {currentTourStep.description}
        </p>
      )}
      {currentTourStep.fieldname && (
        <p className="mt-1 text-xs text-zinc-400">
          Field: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-700">{currentTourStep.fieldname}</code>
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          Skip tour
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
        >
          {currentStep >= steps.length - 1
            ? "Finish"
            : currentTourStep.next_step_label ?? "Next →"}
        </button>
      </div>
    </div>
  );
}
