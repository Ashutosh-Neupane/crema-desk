/**
 * Barcode values (Desk: form/controls/barcode.js): stored as the SVG JsBarcode draws, with the scanned / typed value in
 * `data-barcode-value` and width="100%", so print formats show the barcode. Options: fontSize 16, width 3,
 * height 50, plus the field's JSON `options` (format "EAN" → EAN8 / EAN13 by length).
 */
import JsBarcode from "jsbarcode";

/** the value inside a stored SVG, or the text itself when it isn't one */
export function barcodeValue(stored: string): string {
  if (!stored.startsWith("<svg")) return stored;
  return /data-barcode-value="([^"]*)"/.exec(stored)?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, "&") ?? "";
}

export function barcodeOptions(fieldOptions: unknown, value: string): Record<string, unknown> {
  const o: Record<string, unknown> = { fontSize: "16", width: "3", height: "50" };
  if (typeof fieldOptions === "string" && fieldOptions.trim().startsWith("{")) {
    try {
      Object.assign(o, JSON.parse(fieldOptions));
      if (o.format === "EAN") o.format = value.length === 8 ? "EAN8" : "EAN13";
    } catch {
      /* not JSON: defaults */
    }
  }
  return o;
}

/** barcode.js get_barcode_html; throws JsBarcode's error for an invalid value */
export function barcodeSvg(value: string, fieldOptions?: unknown): string {
  const holder = document.createElement("div");
  holder.innerHTML = "<svg height=80></svg>";
  const svg = holder.firstElementChild as SVGSVGElement;
  let failure: unknown = null;
  JsBarcode(svg, value, { ...barcodeOptions(fieldOptions, value), valid: (ok: boolean) => void (ok || (failure = `"${value}" is not a valid ${String(barcodeOptions(fieldOptions, value).format ?? "CODE128")} barcode`)) });
  if (failure) throw new Error(String(failure));
  svg.setAttribute("data-barcode-value", value);
  svg.setAttribute("width", "100%");
  return holder.innerHTML;
}
