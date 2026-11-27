"use client";

/**
 * Step 1 of creating a DocType (docs/PHASE2_DESIGN.md § 4.9): name, module, kind, submittable and naming in plain
 * words, with a live example of the first document's name. "Continue" inserts the DocType like Desk's dialog and
 * opens its form on the Form tab, where the fields are laid out.
 */
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check as CheckIcon, Loader2 } from "lucide-react";
import { frappeMethod } from "@/lib/frappe/client";
import { docUrl } from "@/lib/navigation/deskUrl";
import { Stepper } from "@/components/crema-ui";
import LinkInput from "@/components/list/LinkInput";
import {
  KINDS,
  NAMINGS,
  nameProblem,
  namingExample,
  prefixProblem,
  suggestPrefix,
  toDoctypeDoc,
  type Kind,
  type Naming,
} from "@/lib/doctype/start";

const field =
  "h-10 w-full rounded-lg border border-[var(--outline-default)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--ink-default)] outline-none focus-visible:border-[var(--focus-color)] focus-visible:ring-2 focus-visible:ring-[var(--focus-color)]/30";
const labelCls = "text-sm font-medium text-[var(--ink-default)]";
const hintCls = "text-xs text-[var(--ink-muted)]";

/** Is there already a DocType with this name? (debounced by the query key changing only on settled input) */
function useNameTaken(name: string) {
  return useQuery({
    queryKey: ["doctype-exists", name],
    enabled: !!name && !nameProblem(name),
    staleTime: 30_000,
    queryFn: async () =>
      (await frappeMethod<number>("frappe.client.get_count", {
        doctype: "DocType",
        filters: [["name", "=", name]],
      })) > 0,
  });
}

const Msg = ({ id, err, hint }: { id?: string; err: string | null; hint: React.ReactNode }) => (
  <p
    id={id}
    className={err ? "text-xs text-[var(--status-danger-fg)]" : hintCls}
    aria-live="polite"
  >
    {err ?? hint}
  </p>
);

const Req = () => (
  <span aria-hidden="true" className="text-[var(--status-danger-fg)]">
    *
  </span>
);

function NameField({
  id,
  value,
  onChange,
  err,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  err: string | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // the page exists to fill this in: focus it on arrival (instead of autoFocus, which also fires on re-mounts)
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-name`} className={labelCls}>
        Name <Req />
      </label>
      <input
        ref={ref}
        id={`${id}-name`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Vehicle"
        autoComplete="off"
        aria-invalid={!!err || undefined}
        aria-describedby={`${id}-name-msg`}
        className={field}
      />
      <Msg
        id={`${id}-name-msg`}
        err={err}
        hint="Singular, as people say it: Vehicle, Service Visit, Membership Plan."
      />
    </div>
  );
}

function KindField({ id, kind, setKind }: { id: string; kind: Kind; setKind: (k: Kind) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className={labelCls}>What is it?</legend>
      <div className="grid gap-2">
        {KINDS.map((k) => (
          <label
            key={k.value}
            className={`crema-lift flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${kind === k.value ? "border-[var(--focus-color)] bg-[var(--surface-selected)]" : "border-[var(--outline-default)] hover:bg-[var(--surface-hover)]"}`}
          >
            <input
              type="radio"
              name={`${id}-kind`}
              value={k.value}
              checked={kind === k.value}
              onChange={() => setKind(k.value)}
              className="mt-1 accent-[var(--focus-color)]"
            />
            <span>
              <span className="block text-sm font-medium text-[var(--ink-default)]">{k.label}</span>
              <span className={hintCls}>{k.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NamingField({
  id,
  name,
  naming,
  setNaming,
  prefix,
  setPrefix,
  err,
}: {
  id: string;
  name: string;
  naming: Naming;
  setNaming: (n: Naming) => void;
  prefix: string;
  setPrefix: (p: string) => void;
  err: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`${id}-naming`} className={labelCls}>
        How are documents named?
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`${id}-naming`}
          value={naming}
          onChange={(e) => setNaming(e.target.value as Naming)}
          className={`${field} min-w-0 flex-1 basis-48`}
        >
          {NAMINGS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
        {naming === "series" && (
          <input
            aria-label="Series prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            placeholder="PRE"
            className={`${field} w-28 font-mono uppercase`}
            aria-invalid={!!err || undefined}
          />
        )}
      </div>
      <Msg
        err={err}
        hint={
          <>
            First one:{" "}
            <span className="font-mono text-[var(--ink-default)]">
              {namingExample({ naming, prefix, name })}
            </span>
          </>
        }
      />
    </div>
  );
}

function SubmitButton({ busy, ok }: { busy: boolean; ok: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="crema-lift ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-fg)] disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : ok ? (
        <CheckIcon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      Create and add fields
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const STEPS = [
  { label: "Start", state: "current" as const },
  { label: "Fields and layout", state: "upcoming" as const },
  { label: "Save", state: "upcoming" as const },
];

export function NewDocTypeStart() {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [kind, setKind] = useState<Kind>("records");
  const [submittable, setSubmittable] = useState(false);
  const [naming, setNaming] = useState<Naming>("series");
  const [prefix, setPrefix] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [going, setGoing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const effectivePrefix = prefix ?? suggestPrefix(name);
  const taken = useNameTaken(name.trim());
  const nameErr =
    nameProblem(name) ?? (taken.data ? `A DocType called “${name.trim()}” already exists` : null);
  const moduleErr = module ? null : "Choose where it belongs";
  const prefixErr =
    kind === "records" && naming === "series" ? prefixProblem(effectivePrefix) : null;
  const ok = !nameErr && !moduleErr && !prefixErr && !taken.isFetching;
  // errors show once the field is touched, or for all fields after a submit attempt
  const show = (err: string | null, touched: boolean) => (err && (tried || touched) ? err : null);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    setGoing(true);
    setServerError(null);
    const doc = toDoctypeDoc({ name, module, kind, submittable, naming, prefix: effectivePrefix });
    frappeMethod<{ name: string }>("frappe.client.insert", { doc })
      .then((saved) => router.push(`${docUrl("DocType", saved?.name ?? name.trim())}#form`))
      .catch((err: unknown) => {
        setGoing(false);
        setServerError(err instanceof Error ? err.message : String(err));
      });
  };

  return (
    <div className="mx-auto w-full max-w-xl py-6" data-testid="new-doctype-start">
      <Stepper label="Create a DocType" className="mb-6" steps={STEPS} />
      <form
        onSubmit={go}
        noValidate
        className="crema-rise space-y-5 rounded-xl border border-[var(--outline-default)] bg-[var(--surface-raised)] p-5 shadow-[var(--elevation-1)] sm:p-6"
      >
        <header>
          <h1 className="text-h2 font-semibold text-[var(--ink-default)]">New DocType</h1>
          <p className={hintCls}>
            A new kind of document: its fields, list and permissions. You can change all of this
            later.
          </p>
        </header>

        <NameField id={id} value={name} onChange={setName} err={show(nameErr, !!name)} />

        <div className="space-y-1.5">
          <label htmlFor={`${id}-module`} className={labelCls}>
            Module <Req />
          </label>
          <LinkInput
            id={`${id}-module`}
            doctype="Module Def"
            value={module}
            onChange={setModule}
            placeholder="e.g. Custom"
            inputClassName={field}
          />
          <Msg err={show(moduleErr, false)} hint="Groups it in the sidebar and in permissions." />
        </div>

        <KindField id={id} kind={kind} setKind={setKind} />

        {kind === "records" && (
          <>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={submittable}
                onChange={(e) => setSubmittable(e.target.checked)}
                className="mt-1 accent-[var(--focus-color)]"
              />
              <span>
                <span className="block text-sm font-medium text-[var(--ink-default)]">
                  Can be submitted
                </span>
                <span className={hintCls}>
                  Documents are drafted, then submitted to lock them (like invoices). Submitted ones
                  can be cancelled and amended.
                </span>
              </span>
            </label>
            <NamingField
              id={id}
              name={name}
              naming={naming}
              setNaming={setNaming}
              prefix={effectivePrefix}
              setPrefix={setPrefix}
              err={show(prefixErr, prefix !== null)}
            />
          </>
        )}

        {serverError && (
          <p
            role="alert"
            className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-sm text-[var(--status-danger-fg)]"
          >
            {serverError}
          </p>
        )}

        <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--outline-default)] pt-4">
          <Link
            href="/desk/doctype"
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </Link>
          <Link
            href="/desk/doctype/new?advanced=1"
            className="text-xs text-[var(--ink-muted)] underline-offset-2 hover:underline"
          >
            Use the full form instead
          </Link>
          <SubmitButton busy={going || taken.isFetching} ok={ok} />
        </footer>
      </form>
    </div>
  );
}
