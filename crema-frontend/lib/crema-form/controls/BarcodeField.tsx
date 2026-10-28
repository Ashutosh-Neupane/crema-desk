"use client";

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import type { FieldControlProps } from "./index";

/**
 * Barcode field — maps to Frappe fieldtype "Barcode".
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

export default function BarcodeField({ field, inputId, value, onChange, disabled, error }: FieldControlProps) {
  const str = typeof value === "string" ? value : "";
  const isDisabled = disabled || !!field.read_only;
  const hasBarcodeDetector = useHasBarcodeDetector();

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // Start scanning loop using native BarcodeDetector
        if (hasBarcodeDetector) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({ formats: ["qr_code","code_128","ean_13","ean_8","upc_a","upc_e","code_39","itf","pdf417","aztec","data_matrix"] });
          const scan = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onChange(barcodes[0].rawValue);
                stopCamera();
                return;
              }
            } catch { /* ignore per-frame errors */ }
            rafRef.current = requestAnimationFrame(scan);
          };
          rafRef.current = requestAnimationFrame(scan);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setCameraError(msg);
      stopCamera();
    }
  }, [onChange, stopCamera, hasBarcodeDetector]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="space-y-2">
      {/* Manual input row */}
      <div className="flex gap-2">
        <input
          type="text"
          id={inputId ?? field.fieldname}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          placeholder="Barcode / QR value"
          aria-label={field.label || field.fieldname}
          aria-required={!!field.reqd}
          aria-invalid={!!error}
          className={[
            "flex-1 rounded-lg border px-3 py-2 text-sm font-mono transition-colors",
            error ? "border-red-500 focus:ring-red-500/20" : "border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900/20 dark:border-zinc-700 dark:focus:border-zinc-500",
            "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2",
            isDisabled && "cursor-not-allowed bg-zinc-100 dark:bg-zinc-800",
          ].join(" ")}
        />
        {/* Camera scan button (shown only if not disabled) */}
        {!isDisabled && (
          <button
            type="button"
            onClick={scanning ? stopCamera : startCamera}
            aria-label={scanning ? "Stop camera scan" : "Scan barcode with camera"}
            title={hasBarcodeDetector ? (scanning ? "Stop scanning" : "Scan with camera") : "Camera scanning not supported in this browser"}
            className={[
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              scanning
                ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
            ].join(" ")}
          >
            {scanning ? "✕ Stop" : "📷 Scan"}
          </button>
        )}
      </div>

      {/* Camera preview dialog */}
      {scanning && (
        <div className="relative rounded-lg border border-zinc-300 bg-black dark:border-zinc-700 overflow-hidden">
          <video
            ref={videoRef}
            className="w-full max-h-52 object-cover"
            playsInline
            muted
            aria-label="Camera feed for barcode scanning"
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-24 border-2 border-green-400 rounded-lg opacity-70" aria-hidden="true" />
          </div>
          <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
            {hasBarcodeDetector ? "Point camera at barcode…" : "BarcodeDetector not supported — enter manually above"}
          </p>
        </div>
      )}

      {cameraError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Camera error: {cameraError}
        </p>
      )}
    </div>
  );
}
