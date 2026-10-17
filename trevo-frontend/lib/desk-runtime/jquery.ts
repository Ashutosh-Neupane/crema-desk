/**
 * jQuery for site scripts (docs/GAPS.md L2). In the browser this is real jQuery 3.7 (what Frappe ships), so
 * scripts that build DOM in HTML fields ($wrapper.html(...), $("<div>").appendTo(wrapper), .on("click")) work.
 * Returned jQuery objects are wrapped so a missing plugin ($.fn.select2, Desk-only helpers) is a chainable
 * no-op instead of a TypeError that would abort the whole script. On the server it falls back to the stub.
 */
import jQueryLib from "jquery";

type Jq = JQuery & Record<string, unknown>;

export function makeLenientJQuery(stub: () => unknown, noop: unknown): unknown {
  if (typeof window === "undefined" || typeof document === "undefined") return stub();
  const real = jQueryLib as unknown as JQueryStatic & ((...a: unknown[]) => Jq);
  const wrap = (obj: Jq): Jq =>
    new Proxy(obj, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) {
          const v = Reflect.get(target, prop, receiver);
          if (typeof v !== "function") return v;
          return (...args: unknown[]) => {
            const r = (v as (...a: unknown[]) => unknown).apply(target, args);
            return r && typeof r === "object" && (r as { jquery?: string }).jquery ? wrap(r as Jq) : r;
          };
        }
        return noop;
      },
    });
  const $ = (...args: unknown[]) => wrap(real(...args));
  // statics ($.extend, $.each, $.Deferred, $.ajax, …) come straight from jQuery
  return Object.assign($, real, { fn: real.fn });
}
