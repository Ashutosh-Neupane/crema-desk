"use client";

/**
 * Crema's sign-in: what Crema is on one side (hidden on small screens), the form on the other. Signs in against the
 * site's own users (app/api/auth/login → Frappe login), so every account and permission is the site's.
 */
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Command, Eye, EyeOff, Layout, Loader2, Sparkles, Workflow } from "lucide-react";
import { useAuth } from "@/lib/frappe/auth";

const noopSubscribe = () => () => {};

const POINTS = [
  { icon: Workflow, title: "Everything your site already has", text: "Every DocType, report, workflow and app on your Frappe site, with nothing to migrate." },
  { icon: Command, title: "Built for the keyboard", text: "⌘K jumps to any document, list or report. Forms save with ⌘S." },
  { icon: Sparkles, title: "Claude, when you want it", text: "Connect Claude and ask about the page you're on." },
];

function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-amber-600 text-stone-950 shadow-sm">
        <Layout className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-xl font-semibold tracking-tight">Crema</span>
    </div>
  );
}

function AboutPanel() {
  return (
    // espresso and its crema: the panel keeps its own colours in light and dark
    <section aria-label="About Crema" className="relative hidden overflow-hidden bg-gradient-to-br from-stone-950 via-stone-900 to-[#2a1a0e] p-12 text-stone-100 lg:flex lg:flex-col">
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-amber-500/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -bottom-48 h-[32rem] w-[32rem] rounded-full bg-orange-700/20 blur-3xl" />
      <Brand className="relative" />
      <div className="relative mt-auto max-w-md">
        {/* colour set inline: the global heading colour would otherwise win over a utility class */}
        <h2 className="text-3xl leading-tight font-semibold tracking-tight" style={{ color: "#fafaf9" }}>
          Your Frappe site, at the <span style={{ color: "#fcd34d" }}>speed you work.</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-400">Crema is a faster, calmer desk for the business you already run on Frappe and ERPNext.</p>
        <ul className="mt-10 space-y-6">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 ring-1 ring-amber-300/20">
                <Icon className="h-4 w-4 text-amber-300" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-sm text-stone-400">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative mt-12 text-xs text-stone-500">Runs on your Frappe site · your data stays there</p>
    </section>
  );
}

/** Frappe answers a wrong user or password with 401 "Invalid login credentials": say it plainly */
function signInError(message?: string): string {
  if (!message || /401|invalid login|incorrect|not found/i.test(message)) return "That email, username or password isn't right.";
  if (/429|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}

export function LoginClient() {
  const router = useRouter();
  const { login } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  // Until hydration, a submit would be a native form submit that reloads the page
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // uncontrolled inputs: text typed before hydration survives it
    const form = e.currentTarget as HTMLFormElement;
    const usr = (form.elements.namedItem("usr") as HTMLInputElement).value;
    const pwd = (form.elements.namedItem("pwd") as HTMLInputElement).value;
    try {
      await login(usr, pwd);
      router.push("/desk");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(signInError(e?.message));
    } finally {
      setSubmitting(false);
    }
  }

  const input =
    "mt-1.5 h-10 w-full rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink-default)] outline-none transition-shadow placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent)]/20";

  return (
    <main className="grid min-h-screen bg-[var(--surface-sunken)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AboutPanel />
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Brand className="mb-10 text-[var(--ink-default)] lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink-default)]">Sign in</h1>
          <p className="mt-1.5 text-sm text-[var(--ink-muted)]">Use your account on this site.</p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div>
              <label htmlFor="login-usr" className="text-sm font-medium text-[var(--ink-default)]">
                Email or username
              </label>
              <input id="login-usr" name="usr" autoComplete="username" placeholder="you@company.com" className={input} required />
            </div>
            <div>
              <label htmlFor="login-pwd" className="text-sm font-medium text-[var(--ink-default)]">
                Password
              </label>
              <div className="relative">
                <input id="login-pwd" name="pwd" autoComplete="current-password" type={showPwd ? "text" : "password"} className={`${input} pr-10`} required />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  aria-pressed={showPwd}
                  className="absolute top-1/2 right-2 mt-[3px] -translate-y-1/2 rounded-md p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink-default)]"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-lg border border-[var(--status-danger-fg)]/30 bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!hydrated || submitting}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-fg)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
