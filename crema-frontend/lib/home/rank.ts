/**
 * Ranking for the dynamic home (docs/PHASE2_DESIGN.md § 4.1.4), the "reduced" version that runs without the Crema
 * Frappe app: the usage signals are the ones a normal user can read (documents opened in Crema, Desk's own
 * `frequently_visited_links`, open approvals / assignments, own drafts and edits). The Crema app will add the
 * server-side logs (Version, Route History, Activity Log) and the role prior with the same formula.
 *
 *   usage(x) = Σ weight(e) · 0.5 ^ (age_days(e) / 14)
 *   prior(x) = 1 if x is a shortcut of the user's workspace + 1 if the user can submit x (a transaction, not a master)
 *   λ        = min(1, events / 30)                 new users lean on the prior
 *   score(x) = λ · norm(usage) + (1 − λ) · norm(prior)
 *
 * No DocType, role or route name appears here: candidates are whatever the boot says the user can read.
 */

export const HALF_LIFE_DAYS = 14;
const DAY = 86_400_000;
/** an event without a time (Desk's visited links) counts as a week old */
const UNKNOWN_AGE_DAYS = 7;

/** weights from § 4.1.3 B */
export const WEIGHT = { created: 3, workflow: 3, edited: 2, opened: 1, visited: 1 } as const;
export type UsageKind = keyof typeof WEIGHT;

export interface UsageEvent {
  doctype: string;
  kind: UsageKind;
  /** ms since epoch */
  at?: number;
}

export interface RankInput {
  events: UsageEvent[];
  canRead: ReadonlySet<string>;
  /** boot can_submit: submittable doctypes the user may submit */
  canSubmit?: ReadonlySet<string>;
  /** doctypes on the user's workspace shortcuts */
  shortcuts?: Iterable<string>;
  now?: number;
}

export interface Ranked {
  doctype: string;
  score: number;
  usage: number;
  prior: number;
}

// doctypes that are plumbing rather than someone's work
const NOT_WORK = new Set(["DocType", "Workspace", "Workflow Action", "Route History", "Version", "Comment", "Communication", "File", "Activity Log", "Access Log", "Error Log", "ToDo"]);

export function decay(at: number | undefined, now: number): number {
  const age = at ? Math.max(0, (now - at) / DAY) : UNKNOWN_AGE_DAYS;
  return 0.5 ** (age / HALF_LIFE_DAYS);
}

function normalise(m: Map<string, number>): Map<string, number> {
  const max = Math.max(0, ...m.values());
  if (!max) return new Map([...m.keys()].map((k) => [k, 0]));
  return new Map([...m].map(([k, v]) => [k, v / max]));
}

/** DocTypes the user works in, highest score first; ties keep the order they were first seen */
export function rankDoctypes({ events, canRead, canSubmit = new Set(), shortcuts = [], now = Date.now() }: RankInput): Ranked[] {
  const ok = (dt: string) => !!dt && canRead.has(dt) && !NOT_WORK.has(dt);
  const usage = new Map<string, number>();
  const order = new Map<string, number>();
  const seen = (dt: string) => !order.has(dt) && order.set(dt, order.size);
  let n = 0;
  for (const e of events) {
    if (!ok(e.doctype)) continue;
    n++;
    seen(e.doctype);
    usage.set(e.doctype, (usage.get(e.doctype) ?? 0) + WEIGHT[e.kind] * decay(e.at, now));
  }
  const prior = new Map<string, number>();
  for (const dt of shortcuts) {
    if (!ok(dt)) continue;
    seen(dt);
    prior.set(dt, (prior.get(dt) ?? 0) + 1);
  }
  for (const dt of canSubmit) {
    if (!ok(dt) || !order.has(dt)) continue; // a transaction counts extra only if something else surfaced it
    prior.set(dt, (prior.get(dt) ?? 0) + 1);
  }
  const lambda = Math.min(1, n / 30);
  const u = normalise(usage);
  const p = normalise(prior);
  return [...order.keys()]
    .map((doctype) => {
      const uu = u.get(doctype) ?? 0;
      const pp = p.get(doctype) ?? 0;
      return { doctype, usage: usage.get(doctype) ?? 0, prior: prior.get(doctype) ?? 0, score: lambda * uu + (1 - lambda) * pp };
    })
    .sort((a, b) => b.score - a.score || (order.get(a.doctype) ?? 0) - (order.get(b.doctype) ?? 0));
}
