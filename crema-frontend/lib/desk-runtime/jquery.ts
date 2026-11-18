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
  // a wrapped object answers every unknown property (nodeType, ownerDocument, …) with a no-op, so handing it back
  // to jQuery — $($x), $el.append($x), $x.add($y) — would look like a DOM node: unwrap before jQuery sees it
  const targets = new WeakMap<object, Jq>();
  const unwrap = (a: unknown) => (a && typeof a === "object" && targets.has(a) ? targets.get(a) : a);
  const wrap = (obj: Jq): Jq => {
    const p = new Proxy(obj, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) {
          const v = Reflect.get(target, prop, receiver);
          if (typeof v !== "function") return v;
          return (...args: unknown[]) => {
            const r = (v as (...a: unknown[]) => unknown).apply(target, args.map(unwrap));
            return r && typeof r === "object" && (r as { jquery?: string }).jquery ? wrap(r as Jq) : r;
          };
        }
        return noop;
      },
    });
    targets.set(p, obj);
    return p;
  };
  const $ = (...args: unknown[]) => wrap(real(...args.map(unwrap)));
  // statics ($.extend, $.each, $.Deferred, $.ajax, …) come straight from jQuery
  return Object.assign($, real, { fn: real.fn });
}
