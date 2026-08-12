/**
 * Module detail page — Server Component with ISR (10 min).
 * Fetches module contents server-side: doctypes, reports, web forms, workspaces.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { frappeServerFetch, getCookieHeader } from "@/lib/frappe/server";
import { Card } from "@/components/shadcn/card";
import { FileText, BarChart3, Globe, Layout, Layers, ExternalLink } from "lucide-react";

export const revalidate = 600; // 10 minutes

interface Props {
  params: Promise<{ module: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  const name = decodeURIComponent(module);
  return {
    title: `${name} | Modules | Trevo`,
    description: `Browse DocTypes, reports and workspaces in the ${name} module`,
  };
}

interface ModulePageData {
  module: { name: string; module_name?: string; app_name?: string; color?: string } | null;
  doctypes: Array<{ name: string }>;
  reports: Array<{ name: string }>;
  web_forms: Array<{ name: string }>;
  workspaces: Array<{ name: string; title: string }>;
}

const colorClasses: Record<string, string> = {
  blue:   "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  green:  "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
  yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  red:    "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  cyan:   "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400",
  gray:   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

async function getModuleData(moduleName: string): Promise<ModulePageData> {
  const cookie = await getCookieHeader();
  const encoded = encodeURIComponent(moduleName);

  const [modResult, doctypesResult, reportsResult, webFormsResult, workspacesResult] =
    await Promise.allSettled([
      frappeServerFetch<{ name: string; module_name?: string; app_name?: string; color?: string }>(
        cookie,
        `api/resource/Module Def/${encoded}`,
      ),
      frappeServerFetch<Array<{ name: string }>>(
        cookie,
        `api/resource/DocType?filters=${encodeURIComponent(JSON.stringify([["module","=",moduleName],["istable","=",0],["issingle","=",0]]))}&fields=["name"]&limit=200`,
      ),
      frappeServerFetch<Array<{ name: string }>>(
        cookie,
        `api/resource/Report?filters=${encodeURIComponent(JSON.stringify([["module","=",moduleName]]))}&fields=["name"]&limit=100`,
      ),
      frappeServerFetch<Array<{ name: string }>>(
        cookie,
        `api/resource/Web Form?filters=${encodeURIComponent(JSON.stringify([["module","=",moduleName]]))}&fields=["name"]&limit=50`,
      ),
      frappeServerFetch<Array<{ name: string; title: string }>>(
        cookie,
        `api/resource/Workspace?filters=${encodeURIComponent(JSON.stringify([["module","=",moduleName]]))}&fields=["name","title"]&limit=50`,
      ),
    ]);

  return {
    module: modResult.status === "fulfilled" ? (modResult.value.data ?? null) : null,
    doctypes: doctypesResult.status === "fulfilled" ? ((doctypesResult.value.data as unknown as Array<{ name: string }>) ?? []) : [],
    reports: reportsResult.status === "fulfilled" ? ((reportsResult.value.data as unknown as Array<{ name: string }>) ?? []) : [],
    web_forms: webFormsResult.status === "fulfilled" ? ((webFormsResult.value.data as unknown as Array<{ name: string }>) ?? []) : [],
    workspaces: workspacesResult.status === "fulfilled" ? ((workspacesResult.value.data as unknown as Array<{ name: string; title: string }>) ?? []) : [],
  };
}

export default async function ModuleDefPage({ params }: Props) {
  const { module: moduleParam } = await params;
  const moduleName = decodeURIComponent(moduleParam);

  const data = await getModuleData(moduleName);

  if (!data.module && data.doctypes.length === 0) {
    notFound();
  }

  const mod = data.module;
  const iconColor = mod?.color ?? "blue";

  const sections = [
    {
      key: "doctypes", label: `DocTypes (${data.doctypes.length})`, icon: FileText,
      items: data.doctypes.map((d) => ({ label: d.name, href: `/desk/doctype/${encodeURIComponent(d.name)}` })),
    },
    {
      key: "reports", label: `Reports (${data.reports.length})`, icon: BarChart3,
      items: data.reports.map((r) => ({ label: r.name, href: `/desk/reports?report=${encodeURIComponent(r.name)}` })),
    },
    {
      key: "web_forms", label: `Web Forms (${data.web_forms.length})`, icon: Globe,
      items: data.web_forms.map((f) => ({ label: f.name, href: `/desk/web-forms` })),
    },
    {
      key: "workspaces", label: `Workspaces (${data.workspaces.length})`, icon: Layout,
      items: data.workspaces.map((w) => ({ label: w.title || w.name, href: `/desk/workspace/${encodeURIComponent(w.name)}` })),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className={`mb-4 inline-flex items-center gap-3 rounded-xl px-4 py-3 ${colorClasses[iconColor] ?? colorClasses.blue}`}>
          <Layers className="h-5 w-5" aria-hidden="true" />
          <span className="font-semibold">{mod?.name ?? moduleName}</span>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {mod?.module_name ?? mod?.name ?? moduleName}
        </h1>
        {mod?.app_name && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Part of <strong>{mod.app_name}</strong>
          </p>
        )}
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <Card className="p-12 text-center text-sm text-zinc-500">
          This module has no visible contents.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.key} className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <section.icon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {section.label}
                </h2>
              </div>
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {section.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span className="truncate">{item.label}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-zinc-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
