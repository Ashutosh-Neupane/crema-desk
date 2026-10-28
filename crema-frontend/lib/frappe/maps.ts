// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _resolveScript: ((value: boolean) => void) | null = null;
let loadPromise: Promise<boolean> | null = null;

export function loadGoogleMapsScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    _resolveScript = resolve;
    const script = document.createElement("script");
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      cleanup();
      resolve(false);
    };
    script.onload = () => {
      cleanup();
      resolve(!!window.google?.maps);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

function cleanup() {
  _resolveScript = null;
  loadPromise = null;
}

export function isGoogleMapsAvailable(): boolean {
  return typeof window !== "undefined" && !!window.google?.maps;
}
