"use client";

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import type { FieldControlProps } from "./index";
import { barcodeSvg, barcodeValue } from "@/lib/frappe/barcode";
import { sanitizeHtml } from "@/lib/report/columns";

/**
 * Barcode field (Desk: form/controls/barcode.js) — stored as the barcode's SVG (data-barcode-value holds the text),
 * drawn below the input; the typed value is committed on blur / Enter (an EAN is invalid until complete).
 * - Text input for manual barcode entry.
 * - Camera scan button: opens a dialog with live <video> + BarcodeDetector API.
 * - Falls back gracefully if BarcodeDetector is not available (shows text-only mode).
 */

// Feature-detect the native BarcodeDetector API (Chrome 83+, Edge 83+) after hydration,
// so server and first client render match
const subscribeNoop = () => () => {};
function useHasBarcodeDetector() {
  return useSyncExternalStore(subscribeNoop, () => "BarcodeDetector" in window, () => false);
}

const DETECT_FORMATS = ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "itf", "pdf417", "aztec", "data_matrix"];

/** a stored plain value (written by an import or a script) is drawn as Desk does on load */
function storedSvg(stored: string, options: unknown, hydrated: boolean): string {
  if (stored.startsWith("<svg")) return stored;
  if (!stored || !hydrated) return "";
  try {
    return barcodeSvg(stored, options as string | undefined);
  } catch {
    return "";
  }
}

/** camera scanning with the native BarcodeDetector; the first code read is handed to onDetected */
function useBarcodeCamera(hasBarcodeDetector: boolean, onDetected: (v: string) => void) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detected = useRef(onDetected);
  useEffect(() => {
    detected.current = onDetected;
  });

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const scanLoop = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: DETECT_FORMATS });
    const scan = async () => {
      if (!videoRef.current || !streamRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0) {
          detected.current(barcodes[0].rawValue);
          stopCamera();
          return;
        }
      } catch {
        /* ignore per-frame errors */
      }
      rafRef.current = requestAnimationFrame(scan);
    };
    rafRef.current = requestAnimationFrame(scan);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (hasBarcodeDetector) scanLoop();
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Camera access denied");
      stopCamera();
    }
  }, [stopCamera, hasBarcodeDetector, scanLoop]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);
  return { scanning, cameraError, videoRef, startCamera, stopCamera };
}

function ScanButton({ scanning, supported, onClick }: { scanning: boolean; supported: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={scanning ? "Stop camera scan" : "Scan barcode with camera"}
      title={supported ? (scanning ? "Stop scanning" : "Scan with camera") : "Camera scanning not supported in this browser"}
      className={[
        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        scanning
          ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
          : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      ].join(" ")}
    >
      {scanning ? "✕ Stop" : "📷 Scan"}
    </button>
  );
}

function CameraPreview({ videoRef, supported }: { videoRef: React.RefObject<HTMLVideoElement | null>; supported: boolean }) {
  return (
    <div className="relative rounded-lg border border-zinc-300 bg-black dark:border-zinc-700 overflow-hidden">
      <video ref={videoRef} className="w-full max-h-52 object-cover" playsInline muted aria-label="Camera feed for barcode scanning" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-24 border-2 border-green-400 rounded-lg opacity-70" aria-hidden="true" />
      </div>
      <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
        {supported ? "Point camera at barcode…" : "BarcodeDetector not supported — enter manually above"}
      </p>
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}

const inputClass = (error: unknown, isDisabled: boolean) =>
  [
    "flex-1 rounded-lg border px-3 py-2 text-sm font-mono transition-colors",
    error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
    "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
    isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
  ].join(" ");

export default function BarcodeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const stored = typeof value === "string" ? value : "";
  const str = barcodeValue(stored);
  const [text, setText] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const isDisabled = disabled || !!field.read_only;
  // barcode.js parse: a value becomes its SVG; an invalid one is not stored
  const commit = (v: string) => {
    setText(null);
    if (v === str) return;
    if (!v) {
      setInvalid(null);
      onChange("");
      return;
    }
    try {
      onChange(barcodeSvg(v, field.options));
      setInvalid(null);
    } catch (e) {
      setInvalid(`Invalid Barcode: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const svg = storedSvg(stored, field.options, hydrated);
  const hasBarcodeDetector = useHasBarcodeDetector();
  const cam = useBarcodeCamera(hasBarcodeDetector, commit);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          id={inputId ?? field.fieldname}
          value={text ?? str}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== null && commit(text.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text !== null) {
              e.preventDefault();
              commit(text.trim());
            }
          }}
          disabled={isDisabled}
          placeholder="Barcode / QR value"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          className={inputClass(error, isDisabled)}
        />
        {!isDisabled && <ScanButton scanning={cam.scanning} supported={hasBarcodeDetector} onClick={cam.scanning ? cam.stopCamera : () => void cam.startCamera()} />}
      </div>
      {cam.scanning && <CameraPreview videoRef={cam.videoRef} supported={hasBarcodeDetector} />}
      {svg && <div data-barcode className="max-w-sm rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(svg) }} />}
      {invalid && <ErrorLine>{invalid}</ErrorLine>}
      {cam.cameraError && <ErrorLine>Camera error: {cam.cameraError}</ErrorLine>}
    </div>
  );
}
