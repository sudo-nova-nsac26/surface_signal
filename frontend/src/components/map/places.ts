import type { LngLat } from "@/data/region";

/**
 * The places the visitor can travel to, as a tree: world, continent, region
 * of the country, state, and finally the analysed valley. Only the path to
 * the Taquari Valley exists for now; other continents, regions and states
 * are added here later and appear on the map with no other change.
 *
 * Names and descriptions live in the dictionaries under `map.places`.
 */
export type PlaceId =
  | "world"
  | "south-america"
  | "brazil-south"
  | "rio-grande-do-sul"
  | "taquari-valley";

export interface Place {
  id: PlaceId;
  parent: PlaceId | null;
  /** Where its dot sits on the map of its parent. */
  point: LngLat;
  /** Area shown when the visitor is at this place. */
  bounds: [LngLat, LngLat];
  /**
   * The last stop of a path: the camera flies to a close-up with relief
   * instead of fitting an area, and the analysed area is outlined.
   */
  detail?: { center: LngLat; zoom: number };
}

export function buildPlaces(valleyCenter: LngLat): Place[] {
  return [
    {
      id: "world",
      parent: null,
      point: [0, 0],
      bounds: [
        [-175, -58],
        [175, 72],
      ],
    },
    {
      id: "south-america",
      parent: "world",
      point: [-60, -14],
      bounds: [
        [-84, -57],
        [-33, 14],
      ],
    },
    {
      id: "brazil-south",
      parent: "south-america",
      point: [-52, -26],
      bounds: [
        [-58.5, -34.5],
        [-47, -22],
      ],
    },
    {
      id: "rio-grande-do-sul",
      parent: "brazil-south",
      point: [-53.2, -30],
      bounds: [
        [-57.8, -33.9],
        [-49.5, -27],
      ],
    },
    {
      id: "taquari-valley",
      parent: "rio-grande-do-sul",
      point: valleyCenter,
      bounds: [
        [valleyCenter[0] - 0.12, valleyCenter[1] - 0.1],
        [valleyCenter[0] + 0.12, valleyCenter[1] + 0.1],
      ],
      detail: { center: valleyCenter, zoom: 11.7 },
    },
  ];
}

export function childrenOf(places: Place[], id: PlaceId): Place[] {
  return places.filter((place) => place.parent === id);
}

/** From the world down to the given place. */
export function pathTo(places: Place[], id: PlaceId): Place[] {
  const path: Place[] = [];
  let current = places.find((place) => place.id === id);
  while (current) {
    path.unshift(current);
    current = places.find((place) => place.id === current?.parent);
  }
  return path;
}
