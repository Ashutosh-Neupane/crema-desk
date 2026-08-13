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
  is_complete?: number;
  is_skipped?: number;
}

interface ModuleOnboardingDoc {
  name: string;
  module: string;
  title: string;
  is_complete: number;
  steps: OnboardingStepDoc[];
}

export function ModuleOnboardingWizard() {
  const { data, isLoading } = useQuery<ModuleOnboardingDoc[]>({
    queryKey: ["module-onboarding"],
    queryFn: async () => {
      const res = await frappeMethod<{ message: ModuleOnboardingDoc[] }>(
        "frappe.client.get_list",
        {
          doctype: "Module Onboarding",
          fields: ["name", "module", "title", "is_complete", "steps"],
          order_by: "creation",
        },
      );
      return res.message ?? [];
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

  const modules = data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Module Onboarding
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Complete setup steps for installed modules
        </p>
      </div>

      <div className="grid gap-4">
        {modules.length === 0 ? (
          <Card className="p-10 text-center text-sm text-zinc-500">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-2">No module onboarding steps available.</p>
          </Card>
        ) : (
          modules.map((mod) => (
            <Card key={mod.name} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{mod.title}</p>
                  <p className="text-xs text-zinc-500">Module: {mod.module}</p>
                </div>
                <Badge variant={mod.is_complete ? "default" : "secondary"}>
                  {mod.is_complete ? "Complete" : "Incomplete"}
                </Badge>
              </div>
              <div className="space-y-2">
                {(mod.steps ?? []).map((step, idx) => {
                  const done = !!(step.is_complete || step.is_skipped);
                  return (
                    <div
                      key={step.name}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        done
                          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10"
                          : "border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${done ? "line-through text-zinc-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                          {idx + 1}. {step.title}
                        </p>
                        {step.description && (
                          <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
                        )}
                      </div>
                      <Badge variant={done ? "default" : "secondary"}>
                        {done ? "Done" : "Pending"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
