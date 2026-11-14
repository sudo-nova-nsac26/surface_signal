import type { LngLat } from "@/data/region";

/**
 * The guided journey: fixed camera stops the visitor moves between with
 * buttons. North is always up and the visitor never rotates the map, so
 * nobody loses their bearings.
 */
export interface CameraStop {
  center: LngLat;
  zoom: number;
  /** Tilt in degrees for the detailed view. The simple view is always flat. */
  pitch: number;
}

/** World, Brazil and Rio Grande do Sul. The last stop comes from the data. */
export const OVERVIEW_STOPS: CameraStop[] = [
  { center: [-52, -14], zoom: 1.7, pitch: 0 },
  { center: [-52, -15], zoom: 3.3, pitch: 0 },
  { center: [-53.2, -30], zoom: 5.9, pitch: 0 },
];

export function regionStop(center: LngLat): CameraStop {
  return { center, zoom: 11.7, pitch: 52 };
}

/** Free services that need no key or account. */
export const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export const TERRAIN_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">Terrain: Mapzen, AWS Open Data</a>';
