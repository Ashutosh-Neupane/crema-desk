"use client";

import { UserOnboarding } from "@/components/features/onboarding";

export default function OnboardingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Onboarding</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Setup wizard and form tours
        </p>
      </div>
      <UserOnboarding />
    </div>
  );
}
