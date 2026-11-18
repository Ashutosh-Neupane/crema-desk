"use client";

/**
 * Geolocation (Desk: form/controls/geolocation.js): a Leaflet map with OpenStreetMap tiles (Satellite as another
 * base layer), Leaflet.draw for markers, lines, polygons, rectangles and circles, a "my location" button, and the
 * value stored as a GeoJSON FeatureCollection — circles keep { point_type: "circle", radius } in their properties,
 * as Desk writes them. Read-only shows the map without editing. A legacy { lat, lng } value is shown as a marker.
 */
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { FieldControlProps } from "./index";

/** frappe.utils.map_defaults */
const MAP_DEFAULTS = {
  center: [19.08, 72.8961] as [number, number],
  zoom: 13,
  street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", options: { maxZoom: 19, attribution: "Tiles &copy; Esri" } },
};

type GeoJSON = { type: string; features?: unknown[]; [k: string]: unknown };

/** the stored value as GeoJSON (Desk's format), or a legacy { lat, lng } as a point */
export function toGeoJSON(value: unknown): GeoJSON | null {
  let v: unknown = value;
  if (typeof v === "string") {
    if (!v.trim()) return null;
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.type === "string") return o as GeoJSON;
  if (typeof o.lat === "number" && typeof o.lng === "number") {
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [o.lng, o.lat] } }] };
  }
  return null;
}

let leafletLoad: Promise<typeof Leaflet> | null = null;
function loadLeaflet(): Promise<typeof Leaflet> {
  leafletLoad ??= import("leaflet").then(async (mod) => {
    const L = (mod.default ?? mod) as typeof Leaflet;
    (window as unknown as { L: typeof Leaflet }).L = L; // leaflet-draw extends the global L
    await import("leaflet-draw");
    const src = (u: unknown) => (typeof u === "string" ? u : (u as { src: string }).src);
    L.Icon.Default.mergeOptions({ iconUrl: src(iconUrl), iconRetinaUrl: src(iconRetinaUrl), shadowUrl: src(shadowUrl) });
    // geolocation.js customize_draw_controls: circles round-trip through GeoJSON with their radius
    const circleToGeoJSON = L.Circle.prototype.toGeoJSON;
    L.Circle.include({
      toGeoJSON(this: Leaflet.Circle) {
        const f = circleToGeoJSON.call(this);
        f.properties = { point_type: "circle", radius: this.getRadius() };
        return f;
      },
    });
    L.CircleMarker.include({
      toGeoJSON(this: Leaflet.CircleMarker) {
        const f = circleToGeoJSON.call(this as unknown as Leaflet.Circle);
        f.properties = { point_type: "circlemarker", radius: this.getRadius() };
        return f;
      },
    });
    return L;
  });
  return leafletLoad;
}

export default function GeolocationField({ field, value, onChange, disabled }: FieldControlProps) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ L: typeof Leaflet; map: Leaflet.Map; layers: Leaflet.FeatureGroup } | null>(null);
  const last = useRef<string>(typeof value === "string" ? value : value ? JSON.stringify(value) : "");
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });
  const readOnly = disabled || !!field.read_only;
  const label = field.label || field.fieldname;

  const bind = (data: GeoJSON | null) => {
    const a = api.current;
    if (!a) return;
    a.layers.clearLayers();
    if (data) {
      const add = (layer: Leaflet.Layer) => {
        if (layer instanceof a.L.LayerGroup) layer.eachLayer(add);
        else a.layers.addLayer(layer);
      };
      add(
        a.L.geoJSON(data as never, {
          pointToLayer: (p: { properties?: { point_type?: string; radius?: number } }, latlng: Leaflet.LatLng) =>
            p.properties?.point_type === "circle"
              ? a.L.circle(latlng, { radius: p.properties.radius ?? 10 })
              : p.properties?.point_type === "circlemarker"
                ? a.L.circleMarker(latlng, { radius: p.properties.radius ?? 10 })
                : a.L.marker(latlng),
        } as never),
      );
      try {
        a.map.invalidateSize();
        a.map.fitBounds(a.layers.getBounds(), { padding: [50, 50], maxZoom: 16 });
      } catch {
        /* a single point: keep the view */
      }
    }
  };

  useEffect(() => {
    let dead = false;
    const el = host.current;
    void loadLeaflet().then((L) => {
      if (dead || !el) return;
      const map = L.map(el, { zoomControl: !readOnly, dragging: !readOnly, scrollWheelZoom: false, doubleClickZoom: !readOnly, boxZoom: !readOnly, keyboard: !readOnly, touchZoom: !readOnly });
      map.setView(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom);
      const street = L.tileLayer(MAP_DEFAULTS.street.url, MAP_DEFAULTS.street.options).addTo(map);
      const satellite = L.tileLayer(MAP_DEFAULTS.satellite.url, MAP_DEFAULTS.satellite.options);
      L.control.layers({ Default: street, Satellite: satellite }).addTo(map);
      const layers = new L.FeatureGroup().addTo(map);
      api.current = { L, map, layers };

      if (!readOnly) {
        const emit = () => {
          const v = JSON.stringify(layers.toGeoJSON());
          last.current = v;
          latest.current.onChange(v);
        };
        new L.Control.Draw({
          position: "topleft",
          draw: { polyline: { shapeOptions: { color: "#2490ef", weight: 10 } }, polygon: { allowIntersection: false, shapeOptions: { color: "#2490ef" } }, circle: {}, rectangle: { shapeOptions: { clickable: false } as never }, circlemarker: false },
          edit: { featureGroup: layers, remove: true },
        }).addTo(map);
        map.on(L.Draw.Event.CREATED, (e) => {
          const ev = e as unknown as { layerType: string; layer: Leaflet.Layer };
          if (ev.layerType === "marker") (ev.layer as Leaflet.Marker).bindPopup("Marker");
          layers.addLayer(ev.layer);
          emit();
        });
        map.on(`${L.Draw.Event.EDITED} ${L.Draw.Event.DELETED}`, emit);
        // L.control.locate: centre on the user's position
        const Locate = L.Control.extend({
          onAdd() {
            const b = L.DomUtil.create("button", "leaflet-bar crema-locate");
            b.type = "button";
            b.title = "Show my location";
            b.setAttribute("aria-label", "Show my location");
            b.textContent = "◎";
            L.DomEvent.on(b, "click", (ev) => {
              L.DomEvent.stop(ev);
              map.locate({ setView: true, maxZoom: 16 });
            });
            return b;
          },
        });
        new Locate({ position: "topright" }).addTo(map);
      }
      bind(toGeoJSON(latest.current.value));
    });
    return () => {
      dead = true;
      api.current?.map.remove();
      api.current = null;
    };
    // the map is built once per mount (and again when it turns read-only or editable)
     
  }, [readOnly]);

  // a value set from outside (script, reload) is drawn again
  useEffect(() => {
    const v = typeof value === "string" ? value : value ? JSON.stringify(value) : "";
    if (v === last.current) return;
    last.current = v;
    bind(toGeoJSON(value));
     
  }, [value]);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700" data-fieldname={field.fieldname}>
      <div ref={host} role="application" aria-label={`${label} map`} className="z-0 h-[400px] w-full" />
    </div>
  );
}
