"use client";

/**
 * Workspace "Onboarding" block (Desk: widgets/onboarding_widget.js, views/workspace/blocks/onboarding.js).
 * Steps come from the desktop page payload (`onboardings`, built by frappe.desk.desktop.get_desktop_page, which
 * already honours System Settings > enable_onboarding, the role list and completion). A step is ticked or
 * skipped with frappe.desk.desktop.update_onboarding_step; the server refuses an unfinished step.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CircleCheck, CircleDashed, Circle, Play } from "lucide-react";
import { deskRouteToUrl } from "@/lib/navigation/deskRoute";

export interface OnboardingStep {
  name: string;
  title: string;
  description?: string | null;
  action: "Create Entry" | "Update Settings" | "Show Form Tour" | "View Report" | "Go to Page" | "View Docs" | "Complete Onboarding" | string;
  action_label?: string | null;
  reference_document?: string | null;
  is_single?: 0 | 1;
  is_submittable?: 0 | 1 | null;
  show_full_form?: 0 | 1;
  field?: string | null;
  reference_report?: string | null;
  report_type?: string | null;
  report_reference_doctype?: string | null;
  report_description?: string | null;
  path?: string | null;
  route_options?: string | null;
  intro_video_url?: string | null;
  module?: string | null;
  is_optional?: 0 | 1;
  is_complete?: 0 | 1;
  is_skipped?: 0 | 1;
}

export interface OnboardingData {
  label: string;
  title?: string;
  items: OnboardingStep[];
}

const PENDING_KEY = "crema-onboarding-pending";
const DISMISSED_KEY = "dismissed-onboarding";

const readStore = (store: Storage, key: string): Record<string, unknown> => {
  try {
    return JSON.parse(store.getItem(key) || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

/** Desk: dismissed for 24 hours, remembered per title. */
function isDismissed(title: string): boolean {
  const at = readStore(localStorage, DISMISSED_KEY)[title];
  return typeof at === "string" && (Date.now() - new Date(at.replace(" ", "T")).getTime()) / 36e5 < 24;
}

/** The video id in a YouTube link (Desk get_youtube_id): watch?v=, youtu.be/, shorts/, live/, embed/, v/ or a bare id. */
export function youtubeId(value: string | null | undefined): string | null {
  const v = (value || "").trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)?.[1];
  }
  return id && /^[\w-]{6,}$/.test(id) ? id : null;
}

/** Small safe Markdown (step descriptions are MarkdownEditor text): escapes HTML, then bold / italic / code / links. */
function markdownHtml(md: string): string {
  const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Message of a Frappe error response (_server_messages), else the fallback. */
async function serverMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { _server_messages?: string };
    const first = body._server_messages ? (JSON.parse(JSON.parse(body._server_messages)[0]) as { message?: string }).message : "";
    return (first || fallback).replace(/<[^>]+>/g, "");
  } catch {
    return fallback;
  }
}

async function updateStep(name: string, field: "is_complete" | "is_skipped"): Promise<string | null> {
  const res = await fetch("/api/frappe/api/method/frappe.desk.desktop.update_onboarding_step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, field, value: 1 }),
  });
  return res.ok ? null : serverMessage(res, "Could not update this step");
}

const pendingSteps = () => Object.keys(readStore(sessionStorage, PENDING_KEY));
function setPending(name: string, on: boolean) {
  const all = readStore(sessionStorage, PENDING_KEY);
  if (on) all[name] = 1;
  else delete all[name];
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

function greeting(): string {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
}

function StepVideo({ id, onPlay }: { id: string; onPlay: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [fallback, setFallback] = useState(false);
  if (playing) {
    return (
      <iframe
        className="aspect-video w-full rounded-md"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        title="YouTube video player"
      />
    );
  }
  return (
    <button
      type="button"
      aria-label="Play video"
      onClick={() => {
        onPlay();
        setPlaying(true);
      }}
      className="relative block aspect-video w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" decoding="async" className="h-full w-full object-cover" src={`https://i.ytimg.com/vi/${id}/${fallback ? "hqdefault" : "maxresdefault"}.jpg`} onError={() => setFallback(true)} onLoad={(e) => !fallback && e.currentTarget.naturalWidth <= 120 && setFallback(true)} />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"><Play className="h-5 w-5" /></span>
      </span>
    </button>
  );
}

export default function OnboardingWidget({ data }: { data: OnboardingData }) {
  const router = useRouter();
  const [steps, setSteps] = useState<OnboardingStep[]>(data.items);
  const [hidden, setHidden] = useState(false);
  // only rendered after the page payload arrives on the client, so reading localStorage here is safe
  const [dismissed, setDismissed] = useState(() => isDismissed(data.title || "Let's Get Started"));
  const [openName, setOpenName] = useState<string | undefined>(undefined);
  const initialised = useRef(false);
  const stepsRef = useRef(data.items);

  const title = data.title || "Let's Get Started";
  const leadsToOnboardings = steps.some((s) => s.action === "Complete Onboarding");
  const required = useMemo(() => {
    const r = steps.filter((s) => !s.is_optional);
    return r.length ? r : steps;
  }, [steps]);
  const completed = required.filter((s) => s.is_complete).length;
  const skipped = required.filter((s) => !s.is_complete && s.is_skipped).length;
  const allDone = completed + skipped === required.length;

  const nextStep = useCallback(
    (list: OnboardingStep[], after?: string) => {
      const start = after ? list.findIndex((s) => s.name === after) + 1 : 0;
      return [...list.slice(start), ...list.slice(0, start)].find((s) => !s.is_complete && !s.is_skipped)?.name;
    },
    [],
  );

  const apply = useCallback(
    (name: string, field: "is_complete" | "is_skipped") => {
      const next = stepsRef.current.map((s) => (s.name === name ? { ...s, [field]: 1 as const } : s));
      stepsRef.current = next;
      setSteps(next);
      setOpenName(nextStep(next, name));
    },
    [nextStep],
  );

  const markComplete = useCallback(
    async (step: OnboardingStep, description?: string | null): Promise<boolean> => {
      setPending(step.name, false);
      const err = await updateStep(step.name, "is_complete");
      if (err) {
        toast.error(err);
        return false;
      }
      apply(step.name, "is_complete");
      toast.success(`Done: ${step.title}`, description && description !== step.title ? { description } : undefined);
      return true;
    },
    [apply],
  );

  const skip = async (step: OnboardingStep) => {
    const err = await updateStep(step.name, "is_skipped");
    if (err) toast.error(err);
    else apply(step.name, "is_skipped");
  };

  // Create Entry / Update Settings finish elsewhere (Desk ticks them from a form hook); here the step is remembered and
  // the server is asked again when the workspace is back, which only accepts it if the work is done.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    setOpenName(nextStep(data.items));
    const pend = pendingSteps().filter((n) => data.items.some((s) => s.name === n && !s.is_complete && !s.is_skipped));
    pend.forEach(async (name) => {
      setPending(name, false);
      if (!(await updateStep(name, "is_complete"))) {
        apply(name, "is_complete");
        const s = data.items.find((x) => x.name === name);
        if (s) toast.success(`Done: ${s.title}`);
      }
    });
  }, [data.items, nextStep, apply]);

  const go = (route: string[]) => {
    const url = deskRouteToUrl(route);
    if (url) router.push(url);
  };

  const runAction = async (step: OnboardingStep) => {
    let opts: Record<string, unknown> | null = null;
    if (step.route_options && step.action !== "View Docs") {
      try {
        opts = JSON.parse(step.route_options) as Record<string, unknown>;
      } catch {
        opts = null;
      }
    }
    const withOpts = (route: string[]) => {
      const url = deskRouteToUrl(route, opts);
      if (url) router.push(url);
    };
    const doctype = step.reference_document ?? "";
    switch (step.action) {
      case "Create Entry":
        if (step.is_complete) return withOpts(["List", doctype]);
        setPending(step.name, true);
        return withOpts(["Form", doctype]);
      case "Update Settings":
        setPending(step.name, true);
        return withOpts(["Form", doctype, doctype]);
      case "Show Form Tour":
        return withOpts(step.is_single ? ["Form", doctype, doctype] : ["Form", doctype]);
      case "View Report": {
        if (!(await markComplete(step, step.report_description))) return;
        const name = step.reference_report ?? "";
        if (step.report_type === "Report Builder") return go(["List", step.report_reference_doctype ?? "", "Report", name]);
        return go(["query-report", name]);
      }
      case "Go to Page": {
        const path = step.path ?? "";
        if (!(await markComplete(step))) return;
        // a path outside the desk, like another app's `/banking`, is a page load, not a route
        if (path.startsWith("/") && !path.startsWith("/desk") && !path.startsWith("/app")) window.location.assign(path);
        else go(path.replace(/^\/(desk|app)(\/|$)/, "").split("/").filter(Boolean));
        return;
      }
      case "View Docs":
        window.open(step.path ?? "", "_blank", "noopener");
        await markComplete(step);
        return;
      case "Complete Onboarding":
        return go([step.module ?? ""]);
    }
  };

  const dismiss = () => {
    const all = readStore(localStorage, DISMISSED_KEY);
    all[title] = new Date().toISOString();
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(all));
    } catch {
      /* storage unavailable */
    }
    setDismissed(true);
  };

  if (hidden || dismissed || !steps.length) return null;

  const intervals = required.length;
  const progress = skipped ? `${completed} of ${intervals} done · ${skipped} skipped` : `${completed} of ${intervals} steps done`;
  return (
    <section aria-label="Onboarding" data-onboarding={data.label} className="onboarding-widget-box flex min-w-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{leadsToOnboardings ? greeting() : title}</h3>
          <p className="truncate text-xs text-zinc-500">{leadsToOnboardings ? `${title} · ${progress}` : progress}</p>
        </div>
        <button type="button" onClick={dismiss} className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Dismiss</button>
      </header>
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={intervals} aria-valuenow={completed + skipped}>
        {required.map((s) => (
          <span key={s.name} className={`h-1.5 flex-1 rounded-full ${s.is_complete ? "bg-green-600" : s.is_skipped ? "bg-zinc-400" : "bg-zinc-200 dark:bg-zinc-700"}`} />
        ))}
      </div>
      <ul className="flex flex-col gap-0.5">
        {steps.map((step) => {
          const open = step.name === openName;
          const done = !!(step.is_complete || step.is_skipped);
          const video = open ? youtubeId(step.intro_video_url) : null;
          return (
            <li key={step.name} data-step={step.name} data-open={open} className={`rounded-md px-2 py-1 ${open ? "bg-zinc-50 dark:bg-zinc-800/50" : ""}`}>
              <button type="button" aria-expanded={open} onClick={() => setOpenName(step.name)} className="flex w-full items-center gap-2 py-1 text-left">
                {step.is_complete ? <CircleCheck className="h-4 w-4 shrink-0 text-green-700" /> : step.is_skipped ? <CircleDashed className="h-4 w-4 shrink-0 text-zinc-400" /> : <Circle className={`h-4 w-4 shrink-0 ${open ? "text-zinc-700" : "text-zinc-400"}`} />}
                <span className={`min-w-0 flex-1 truncate text-sm ${open ? "font-medium text-zinc-900 dark:text-zinc-100" : done ? "text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}`}>{step.title}</span>
                {!!step.is_optional && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Optional</span>}
                {!!step.is_skipped && !step.is_complete && <span className="text-xs text-zinc-400">Skipped</span>}
              </button>
              {open && (
                <div className="flex flex-col gap-3 pb-2 pl-6">
                  {step.description && <div className="text-[13px] text-zinc-600 dark:text-zinc-400 [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: markdownHtml(step.description) }} />}
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => void runAction(step)} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
                      {step.action_label || step.title}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    {!step.is_complete && !step.is_skipped && (
                      <button type="button" onClick={() => void skip(step)} className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Skip</button>
                    )}
                  </div>
                  {video && <StepVideo id={video} onPlay={() => undefined} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {allDone && (
        <div className="flex items-center justify-between gap-3 px-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">You&apos;re all set.</span>
          <button type="button" onClick={() => setHidden(true)} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">Done</button>
        </div>
      )}
    </section>
  );
}
