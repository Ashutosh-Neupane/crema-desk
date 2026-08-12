"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { CheckCircle2, ChevronRight, ChevronLeft, X } from "lucide-react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target?: string;
}

interface UserOnboardingProps {
  steps?: OnboardingStep[];
  onComplete?: () => void;
  onDismiss?: () => void;
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Trevo",
    description: "Your modern Frappe frontend experience. Let's take a quick tour to get you started.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "View key metrics, recent workspaces, and quick stats for your business at a glance.",
  },
  {
    id: "doctypes",
    title: "DocTypes",
    description: "Browse and manage all your Frappe DocTypes. Create, edit, and delete records with ease.",
  },
  {
    id: "forms",
    title: "Quick Entry",
    description: "Create new documents quickly using the New Document page or Ctrl+K command palette.",
  },
  {
    id: "settings",
    title: "Settings",
    description: "Customize your experience with theme preferences, profile settings, and more.",
  },
];

export function UserOnboarding({ steps = DEFAULT_STEPS, onComplete, onDismiss }: UserOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("trevo-onboarding-seen") === "true";
  });

  const handleComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("trevo-onboarding-seen", "true");
    }
    setDismissed(true);
    onComplete?.();
  }, [onComplete]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 p-6 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <X className="h-4 w-4 text-zinc-500" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= currentStep ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-500 text-center">Step {currentStep + 1} of {steps.length}</p>
        </div>

        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <CheckCircle2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h3>
          <p className="mt-2 text-sm text-zinc-500">{step.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {isLast ? (
            <Button onClick={handleComplete}>
              Get Started
              <CheckCircle2 className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => setCurrentStep((s) => s + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
