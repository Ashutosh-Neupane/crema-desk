"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { MapPin, Search, Loader2 } from "lucide-react";
import { Loader } from "@googlemaps/js-api-loader";

interface GeoLocation {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  title?: string;
}

interface MapViewProps {
  doctype: string;
  latitudeField?: string;
  longitudeField?: string;
  titleField?: string;
}

export function MapView({
  doctype,
  latitudeField = "latitude",
  longitudeField = "longitude",
  titleField = "name",
}: MapViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { data: locations = [], isLoading, isError } = useQuery({
    queryKey: ["map-data", doctype, latitudeField, longitudeField],
    queryFn: async () => {
      const res = await fetch(
        `/api/doctype/${encodeURIComponent(doctype)}/list?fields=["${titleField}","${latitudeField}","${longitudeField}","name"]&limit=500`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to fetch locations");
      const json = await res.json();
      return (json.data ?? []).filter(
        (d: Record<string, unknown>) => d[latitudeField] && d[longitudeField]
      ).map((d: Record<string, unknown>) => ({
        lat: Number(d[latitudeField]),
        lng: Number(d[longitudeField]),
        title: String(d[titleField] ?? d.name),
        name: String(d.name),
      })) as GeoLocation[];
    },
    staleTime: 60_000,
  });

  const filteredLocations = searchQuery
    ? locations.filter((l) =>
        l.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : locations;

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const useGoogleMaps = !!googleMapsApiKey;

  useEffect(() => {
    if (!useGoogleMaps || !mapRef.current || locations.length === 0) return;

    const loader = new Loader({
      apiKey: googleMapsApiKey,
      version: "weekly",
    });

    const markers: google.maps.Marker[] = [];

    loader.importLibrary("maps").then((maps) => {
      if (!mapRef.current) return;

      const bounds = new maps.LatLngBounds();
      locations.forEach((loc) => {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      });

      const map = new maps.Map(mapRef.current, {
        center: bounds.getCenter() || { lat: 0, lng: 0 },
        zoom: 2,
        mapId: "trevo-map",
      });

      mapInstanceRef.current = map;
      markersRef.current = [];

      locations.forEach((loc) => {
        const marker = new google.maps.Marker({
          position: { lat: loc.lat, lng: loc.lng },
          map,
          title: loc.title,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 150px;">
              <strong>${loc.title}</strong>
              <p style="margin: 4px 0; color: #666; font-size: 12px;">${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}</p>
              <a href="/desk/doctype/${encodeURIComponent(doctype)}/${encodeURIComponent(loc.name ?? '')}" style="color: #2563eb; font-size: 12px;">Open Document</a>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
          setSelectedLocation(loc);
        });

        markers.push(marker);
        markersRef.current.push(marker);
      });

      map.fitBounds(bounds, 50);
    });

    return () => {
      mapInstanceRef.current = null;
      markersRef.current = [];
    };
  }, [locations, doctype, useGoogleMaps, googleMapsApiKey]);

  const getMapsUrl = useCallback((loc: GeoLocation) => {
    return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  }, []);

  const openInMaps = useCallback((loc: GeoLocation) => {
    window.open(getMapsUrl(loc), "_blank", "noopener,noreferrer");
  }, [getMapsUrl]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search locations..."
            className="h-9 pl-9 text-sm"
          />
        </div>
        <span className="text-xs text-zinc-500">
          {filteredLocations.length} locations
        </span>
      </div>

      {/* Map area */}
      <Card className="flex-1 overflow-hidden relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="mx-auto h-8 w-8 text-red-400" />
               <p className="mt-2 text-sm text-zinc-500">Failed to load locations</p>
            </div>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="mx-auto h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm text-zinc-500">No locations found</p>
            </div>
          </div>
        ) : useGoogleMaps ? (
          <div ref={mapRef} className="w-full h-full min-h-[400px]" />
        ) : (
          <div className="flex h-full">
            {/* Location list */}
            <div className="w-72 overflow-y-auto border-r border-zinc-200 dark:border-zinc-700 p-2 space-y-1">
              {filteredLocations.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => {
                    setSelectedLocation(loc);
                    openInMaps(loc);
                  }}
                  className={`w-full rounded-lg p-2 text-left text-sm transition-colors ${
                    selectedLocation?.name === loc.name
                      ? "bg-zinc-100 dark:bg-zinc-700"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-red-500" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {loc.title}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* OpenStreetMap fallback */}
            <div className="flex-1">
              <iframe
                title="OpenStreetMap"
                className="w-full h-full min-h-[400px] border-0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${filteredLocations.map(l => `${l.lng},${l.lat}`).join(',')}&layer=mapnik`}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}