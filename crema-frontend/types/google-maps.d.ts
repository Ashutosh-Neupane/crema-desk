declare namespace google {
  namespace maps {
    class Map {
      constructor(el: HTMLElement, opts?: { center?: { lat: number; lng: number }; zoom?: number; mapId?: string });
      fitBounds(bounds: LatLngBounds, padding?: number): void;
      setCenter(center: { lat: number; lng: number }): void;
    }

    class Marker {
      position: { lat: number; lng: number };
      map: Map | null;
      title: string;
      constructor(opts?: { position: { lat: number; lng: number }; map?: Map; title?: string });
      addListener(event: string, handler: () => void): google.maps.MapsEventListener;
      setMap(map: Map | null): void;
      setPosition(position: { lat: number; lng: number }): void;
    }

    class InfoWindow {
      constructor(opts?: { content?: string });
      open(map: Map, anchor?: Marker): void;
      close(): void;
      setContent(content: string): void;
    }

    class LatLngBounds {
      extend(latLng: { lat: number; lng: number }): void;
      getCenter(): { lat: number; lng: number } | null;
    }

    interface MapsEventListener {
      remove(): void;
    }
  }
}
