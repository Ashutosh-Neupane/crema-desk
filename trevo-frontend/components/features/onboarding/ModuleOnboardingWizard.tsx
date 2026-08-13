"use client";

import { useQuery } from "@tanstack/react-query";
import { frappeMethod } from "@/lib/frappe/client";
import { Card } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { CheckCircle2, Loader2 } from "lucide-react";

interface OnboardingStepDoc {
  name: string;
  title: string;
  description?: string;
  status: "Complete" | "Incomplete";
}

interface ModuleOnboardingData {
  module: string;
  steps: OnboardingStepDoc[];
}

export function ModuleOnboardingWizard() {
  const { data, isLoading } = useQuery<ModuleOnboardingData>({
    queryKey: ["module-onboarding"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: ModuleOnboardingData }>(
        "frappe.desk.doctype.module_onboarding.module_onboarding.get_onboarding_details",
      );
      return res.message ?? { module: "", steps: [] };
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const incomplete = data?.steps?.filter((s) => s.status === "Incomplete") ?? [];
  const complete = data?.steps?.filter((s) => s.status === "Complete") ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Module Onboarding
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Complete setup steps for {data?.module ?? "this module"}
        </p>
      </div>

      <div className="grid gap-4">
        {incomplete.length === 0 && complete.length === 0 ? (
          <Card className="p-10 text-center text-sm text-zinc-500">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-2">All onboarding steps completed!</p>
          </Card>
        ) : (
          <>
            {incomplete.map((step) => (
              <Card key={step.name} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {step.title}
                    </p>
                    {step.description && (
                      <p className="mt-1 text-sm text-zinc-500">{step.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary">Incomplete</Badge>
                </div>
              </Card>
            ))}
            {complete.map((step) => (
              <Card key={step.name} className="p-4 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 line-through">
                      {step.title}
                    </p>
                  </div>
                  <Badge variant="default">Complete</Badge>
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
