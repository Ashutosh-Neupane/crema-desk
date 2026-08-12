/**
 * ScriptSandbox — executes Frappe client scripts in a controlled closure.
 *
 * Each script is run inside a new Function with a mock `frappe` global and
 * a real `cur_frm` / `frm` context that maps back to the React form state
 * via the FormContext callbacks.
 *
 * The sandbox intentionally does NOT have access to window, document, or
 * any React internals — it only gets the explicitly injected API objects.
 */

export interface FormContext {
  /** Current field values (read-only snapshot) */
  doc: Record<string, unknown>;
  /** Doctype name */
  doctype: string;
  /** Document name */
  docname: string;

  // Callbacks that write back to React state
  setValue: (fieldname: string, value: unknown) => void;
  getValue: (fieldname: string) => unknown;
  setDfProperty: (fieldname: string, prop: "hidden" | "reqd" | "read_only" | "options" | string, value: unknown) => void;
  setQuery: (fieldname: string, fn: (doc: Record<string, unknown>) => Record<string, unknown>) => void;
  save: () => Promise<void>;
  msgprint: (msg: string) => void;
  throw: (msg: string) => void;
  callMethod: (method: string, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Registered hooks from frappe.ui.form.on() calls.
 * key = doctype, value = map of event → handler array
 */
export type ScriptHooks = Map<string, Map<string, Array<(frm: FrmAPI) => unknown>>>;

/** The `frm` / `cur_frm` object exposed to scripts */
export interface FrmAPI {
  doc: Record<string, unknown>;
  doctype: string;
  docname: string;
  set_value(fieldname: string, value: unknown): void;
  set_value(values: Record<string, unknown>): void;
  get_value(fieldname: string): unknown;
  set_df_property(fieldname: string, prop: string, value: unknown): void;
  set_query(fieldname: string, fn: (doc: Record<string, unknown>) => Record<string, unknown>): void;
  refresh_field(fieldname: string): void;
  toggle_reqd(fieldname: string, reqd: boolean): void;
  toggle_enable(fieldname: string, enable: boolean): void;
  toggle_display(fieldname: string | string[], show: boolean): void;
  save(): Promise<void>;
  add_custom_button(label: string, handler: () => void, group?: string): void;
  clear_custom_buttons(): void;
  msgprint(msg: string): void;
  call(opts: { method: string; args?: Record<string, unknown>; callback?: (r: { message: unknown }) => void }): Promise<unknown>;
}

/** Create the `frm` / `cur_frm` object from a FormContext */
export function createFrmAPI(ctx: FormContext): FrmAPI {
  return {
    doc: ctx.doc,
    doctype: ctx.doctype,
    docname: ctx.docname,

    set_value(fieldnameOrValues: string | Record<string, unknown>, value?: unknown) {
      if (typeof fieldnameOrValues === "string") {
        ctx.setValue(fieldnameOrValues, value);
      } else {
        for (const [k, v] of Object.entries(fieldnameOrValues)) {
          ctx.setValue(k, v);
        }
      }
    },

    get_value(fieldname: string) {
      return ctx.getValue(fieldname);
    },

    set_df_property(fieldname: string, prop: string, value: unknown) {
      ctx.setDfProperty(fieldname, prop, value);
    },

    set_query(fieldname: string, fn: (doc: Record<string, unknown>) => Record<string, unknown>) {
      ctx.setQuery(fieldname, fn);
    },

    refresh_field(_fieldname: string) {
      // React re-renders automatically when state changes — no-op
    },

    toggle_reqd(fieldname: string, reqd: boolean) {
      ctx.setDfProperty(fieldname, "reqd", reqd ? 1 : 0);
    },

    toggle_enable(fieldname: string, enable: boolean) {
      ctx.setDfProperty(fieldname, "read_only", enable ? 0 : 1);
    },

    toggle_display(fieldname: string | string[], show: boolean) {
      const fields = Array.isArray(fieldname) ? fieldname : [fieldname];
      for (const f of fields) {
        ctx.setDfProperty(f, "hidden", show ? 0 : 1);
      }
    },

    async save() {
      return ctx.save();
    },

    add_custom_button(_label: string, _handler: () => void, _group?: string) {
      // Custom buttons could be stored in state and rendered in a toolbar —
      // for now this is a no-op (Phase 6 extension)
    },

    clear_custom_buttons() {
      // no-op
    },

    msgprint(msg: string) {
      ctx.msgprint(msg);
    },

    async call(opts: { method: string; args?: Record<string, unknown>; callback?: (r: { message: unknown }) => void }) {
      try {
        const result = await ctx.callMethod(opts.method, opts.args ?? {});
        opts.callback?.({ message: result });
        return result;
      } catch (err) {
        console.error("[FrmAPI.call] error:", err);
        return null;
      }
    },
  };
}

/**
 * Build the `frappe.ui.form.on` registrar.
 * Scripts call `frappe.ui.form.on("Customer", { refresh(frm) { ... } })`.
 * This collects those hooks into the provided ScriptHooks map.
 */
function buildFrappeUIStub(hooks: ScriptHooks) {
  return {
    form: {
      on(doctype: string, eventsOrField: string | Record<string, (frm: FrmAPI) => void>, handlerOrUndefined?: (frm: FrmAPI) => void) {
        // Two signatures:
        //   frappe.ui.form.on("DocType", { event(frm) {} })
        //   frappe.ui.form.on("DocType", "fieldname", fn)
        if (!hooks.has(doctype)) hooks.set(doctype, new Map());
        const doctypeHooks = hooks.get(doctype)!;

        if (typeof eventsOrField === "string" && typeof handlerOrUndefined === "function") {
          // Single field change: frappe.ui.form.on("DocType", "fieldname", fn)
          const event = `change:${eventsOrField}`;
          if (!doctypeHooks.has(event)) doctypeHooks.set(event, []);
          doctypeHooks.get(event)!.push(handlerOrUndefined);
        } else if (typeof eventsOrField === "object") {
          // Event map: frappe.ui.form.on("DocType", { refresh(frm) {}, ... })
          for (const [event, handler] of Object.entries(eventsOrField)) {
            if (typeof handler !== "function") continue;
            if (!doctypeHooks.has(event)) doctypeHooks.set(event, []);
            doctypeHooks.get(event)!.push(handler);
          }
        }
      },
    },
  };
}

/** Build the full `frappe` global stub injected into scripts */
function buildFrappeGlobal(
  hooks: ScriptHooks,
  ctx: FormContext,
): Record<string, unknown> {
  const frm = createFrmAPI(ctx);

  return {
    ui: buildFrappeUIStub(hooks),

    call(opts: { method: string; args?: Record<string, unknown>; callback?: (r: { message: unknown }) => void }) {
      return frm.call(opts);
    },

    msgprint(msg: string) {
      ctx.msgprint(msg);
    },

    throw(msg: string) {
      ctx.throw(msg);
    },

    show_alert(msg: string) {
      ctx.msgprint(msg);
    },

    model: {
      set_value(_doctype: string, _docname: string, fieldname: string, value: unknown) {
        ctx.setValue(fieldname, value);
      },
      get_value(_doctype: string, _docname: string, fieldname: string) {
        return ctx.getValue(fieldname);
      },
    },

    db: {
      async get_value(doctype: string, name: string, fieldname: string) {
        try {
          return ctx.callMethod("frappe.client.get_value", { doctype, name, fieldname });
        } catch {
          return null;
        }
      },
    },

    session: {
      user: "Administrator",
    },
  };
}

/**
 * Execute a single script string in the sandbox.
 * Returns the collected hooks (if any).
 */
export function executeScript(
  scriptString: string,
  hooks: ScriptHooks,
  ctx: FormContext,
): void {
  try {
    const frappeGlobal = buildFrappeGlobal(hooks, ctx);
    const frm = createFrmAPI(ctx);

    // Wrap script in an IIFE so `var` declarations don't leak
    const wrapped = `(function(frappe, frm, cur_frm, doc) { "use strict";\n${scriptString}\n})(frappe, frm, cur_frm, doc)`;

    /* eslint-disable-next-line no-new-func */
    const fn = new Function("frappe", "frm", "cur_frm", "doc", wrapped);
    fn(frappeGlobal, frm, frm, ctx.doc);
  } catch (err) {
    console.error("[ScriptSandbox] Script execution error:", err);
  }
}

/**
 * Fire a specific hook event (e.g. "refresh", "validate", "change:fieldname").
 */
export function fireHook(
  hooks: ScriptHooks,
  doctype: string,
  event: string,
  frm: FrmAPI,
): boolean {
  const doctypeHooks = hooks.get(doctype);
  if (!doctypeHooks) return true;

  const handlers = doctypeHooks.get(event) ?? [];
  for (const handler of handlers) {
    try {
      const result = handler(frm);
      if (event === "validate" && result === false) return false;
      if (event === "before_submit" && result === false) return false;
    } catch (err) {
      console.error(`[ScriptSandbox] Hook error (${event}):`, err);
    }
  }
  return true;
}
