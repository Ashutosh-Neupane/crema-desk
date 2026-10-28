/**
 * The form dashboard scripts write into (Desk: frappe/public/js/frappe/form/dashboard.js + layout.show_message):
 * headlines (set_headline / set_headline_alert / add_comment / frm.set_intro), indicators (add_indicator),
 * progress bars (add_progress / show_progress / hide_progress) and custom sections (add_section → a real DOM node
 * scripts fill with jQuery). Desk resets indicators, progress and sections, and clears headlines, on every
 * refresh before the form's refresh handlers run — FormController.runLoadEvents calls reset() + clearHeadlines().
 * The view (components/form/FormDashboard.tsx) renders `state`.
 */
export interface Headline {
  id: number;
  html: string;
  color: string;
  permanent: boolean;
}
export interface ProgressBar {
  title?: string;
  width: string;
  progress_class?: string;
}
export interface Progress {
  title: string;
  bars: ProgressBar[];
  message: string;
}
export interface DashboardSection {
  id: number;
  label: string | null;
  css_class: string;
  hidden: boolean;
  node: HTMLDivElement;
}
export interface DashboardState {
  headlines: Headline[];
  indicators: Array<{ id: number; label: string; color: string }>;
  progress: Progress[];
  sections: DashboardSection[];
  hidden: boolean;
}

const EMPTY: DashboardState = { headlines: [], indicators: [], progress: [], sections: [], hidden: false };
let seq = 0;

/** Desk's format_percent: one bar, red when negative */
function formatPercent(title: string, percent: unknown): ProgressBar[] {
  const p = Math.trunc(Number(percent)) || 0;
  return [{ title, width: `${p < 0 ? 100 : Math.min(p, 100)}%`, progress_class: p < 0 ? "progress-bar-danger" : "progress-bar-success" }];
}

export class FormDashboard {
  state: DashboardState = EMPTY;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    private emit: () => void,
    /** the runtime's jQuery, so returned bodies/elements behave like Desk's */
    private $: (el?: unknown) => unknown,
  ) {}

  private set(patch: Partial<DashboardState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  /** dashboard.reset(): progress, indicators (stats) and custom sections */
  reset() {
    if (!this.state.indicators.length && !this.state.progress.length && !this.state.sections.length) return;
    this.state = { ...this.state, indicators: [], progress: [], sections: [] };
  }

  /** layout.show_message() with no args */
  clearHeadlines() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.state.headlines.length) this.state = { ...this.state, headlines: [] };
  }

  /** layout.show_message(html, color, permanent) — returns a handle with remove(), like Desk's $html */
  showMessage(html?: string, color?: string, permanent = false) {
    if (!html) {
      this.clearHeadlines();
      this.emit();
      return undefined;
    }
    const id = ++seq;
    const c = color && ["yellow", "blue", "red", "green", "orange", "white"].includes(color) ? color : "blue";
    this.set({ headlines: [...this.state.headlines, { id, html: String(html), color: c, permanent }] });
    return this.handle(id);
  }

  removeHeadline(id: number) {
    if (!this.state.headlines.some((h) => h.id === id)) return;
    this.set({ headlines: this.state.headlines.filter((h) => h.id !== id) });
  }

  private handle(id: number) {
    const remove = () => this.removeHeadline(id);
    return new Proxy({ remove, id }, { get: (t, p) => (p in t ? t[p as keyof typeof t] : () => undefined) });
  }

  private addProgress(title: string, percent: unknown, message?: string) {
    const bars = Array.isArray(percent) ? (percent as ProgressBar[]) : formatPercent(title, percent);
    this.set({ progress: [...this.state.progress, { title, bars, message: message ?? "" }] });
    return this.$();
  }

  /** the object scripts see as frm.dashboard */
  api() {
    const show = () => this.state.hidden && this.set({ hidden: false });
    const api: Record<string, unknown> = {
      add_indicator: (label: unknown, color?: string) => {
        show();
        this.set({ indicators: [...this.state.indicators, { id: ++seq, label: String(label ?? ""), color: color || "gray" }] });
        return this.$();
      },
      add_progress: (title: string, percent: unknown, message?: string) => {
        show();
        return this.addProgress(title, percent, message);
      },
      show_progress: (title: string, percent: unknown, message?: string) => {
        if (!this.state.progress.some((p) => p.title === title)) return this.addProgress(title, percent, message);
        const bars = Array.isArray(percent) ? (percent as ProgressBar[]) : formatPercent(title, percent);
        this.set({ progress: this.state.progress.map((p) => (p.title === title ? { ...p, bars, message: message ?? "" } : p)) });
        return this.$();
      },
      hide_progress: (title?: string) => this.set({ progress: title ? this.state.progress.filter((p) => p.title !== title) : [] }),
      format_percent: formatPercent,
      add_section: (body_html: string, label: string | null = null, css_class = "custom", hidden = false) => {
        if (typeof document === "undefined") return this.$();
        const node = document.createElement("div");
        node.innerHTML = body_html ?? "";
        this.set({ sections: [...this.state.sections, { id: ++seq, label, css_class, hidden, node }] });
        return this.$(node);
      },
      set_headline: (html: string, color?: string, permanent = false) => this.showMessage(html, color, permanent),
      set_headline_alert: (text: string, color?: string, permanent = false) => (text ? this.showMessage(`<div>${text}</div>`, color, permanent) : this.showMessage()),
      clear_headline: () => this.showMessage(),
      add_comment: (text: string, alertClass?: string, permanent = false) => {
        const h = text ? this.showMessage(`<div>${text}</div>`, alertClass, permanent) : this.showMessage();
        if (text && !permanent) {
          // Desk clears the headline after 10 s
          const t = setTimeout(() => {
            this.timers.delete(t);
            this.showMessage();
          }, 10_000);
          this.timers.add(t);
        }
        return h;
      },
      clear_comment: () => this.showMessage(),
      show: () => show(),
      hide: () => this.set({ hidden: true }),
      toggle_visibility: (v: boolean) => this.set({ hidden: !v }),
      reset: () => {
        this.reset();
        this.emit();
      },
      refresh: () => {
        // Desk: refresh() starts with reset(); links/counts are Crema's Connections tab
        this.reset();
        this.emit();
      },
    };
    // areas scripts poke at ($wrapper-style): chainable no-ops
    for (const k of ["stats_area", "stats_area_row", "progress_area", "heatmap_area", "chart_area", "links_area", "parent", "wrapper"]) api[k] = this.$();
    return api;
  }
}
