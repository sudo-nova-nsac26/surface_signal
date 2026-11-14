import type { LngLat } from "@/data/region";

/**
 * The places the visitor can travel to, as a tree: world, continent, region
 * of the country, state, and finally the analysed valley. Only the path to
 * the Taquari Valley exists for now.
 *
 * Places that are not ready yet are listed in UPCOMING: they appear on the
 * map as dark dots that cannot be opened. Moving one from UPCOMING into
 * buildPlaces (with its bounds) is all it takes to open it.
 *
 * Names and descriptions live in the dictionaries under `map.places` and
 * `map.upcoming`.
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

export type UpcomingId =
  | "north-america"
  | "europe"
  | "africa"
  | "asia"
  | "oceania"
  | "brazil-north"
  | "brazil-northeast"
  | "brazil-central-west"
  | "brazil-southeast"
  | "parana"
  | "santa-catarina"
  | "rs-serra"
  | "rs-metropolitana"
  | "rs-litoral"
  | "rs-sul"
  | "rs-campanha"
  | "rs-fronteira-oeste"
  | "rs-missoes"
  | "rs-planalto"
  | "rs-central"
  | "rs-rio-pardo";

export interface UpcomingPlace {
  id: UpcomingId;
  parent: PlaceId;
  point: LngLat;
}

export const UPCOMING: UpcomingPlace[] = [
  { id: "north-america", parent: "world", point: [-100, 44] },
  { id: "europe", parent: "world", point: [14, 50] },
  { id: "africa", parent: "world", point: [21, 4] },
  { id: "asia", parent: "world", point: [92, 42] },
  { id: "oceania", parent: "world", point: [134, -25] },
  { id: "brazil-north", parent: "south-america", point: [-61, -4] },
  { id: "brazil-northeast", parent: "south-america", point: [-41, -9] },
  { id: "brazil-central-west", parent: "south-america", point: [-55, -15] },
  { id: "brazil-southeast", parent: "south-america", point: [-45, -20.5] },
  { id: "parana", parent: "brazil-south", point: [-51.6, -24.7] },
  { id: "santa-catarina", parent: "brazil-south", point: [-50.6, -27.3] },
  { id: "rs-serra", parent: "rio-grande-do-sul", point: [-51.18, -29.17] },
  { id: "rs-metropolitana", parent: "rio-grande-do-sul", point: [-51.2, -30.03] },
  { id: "rs-litoral", parent: "rio-grande-do-sul", point: [-50.27, -29.8] },
  { id: "rs-sul", parent: "rio-grande-do-sul", point: [-52.34, -31.77] },
  { id: "rs-campanha", parent: "rio-grande-do-sul", point: [-54.1, -31.3] },
  { id: "rs-fronteira-oeste", parent: "rio-grande-do-sul", point: [-56.6, -29.75] },
  { id: "rs-missoes", parent: "rio-grande-do-sul", point: [-54.26, -28.3] },
  { id: "rs-planalto", parent: "rio-grande-do-sul", point: [-52.4, -28.26] },
  { id: "rs-central", parent: "rio-grande-do-sul", point: [-53.8, -29.68] },
  { id: "rs-rio-pardo", parent: "rio-grande-do-sul", point: [-52.6, -29.95] },
];

export function buildPlaces(valleyCenter: LngLat): Place[] {
  return [
    {
      id: "world",
      parent: null,
      point: [0, 0],
      bounds: [
        [-170, -56],
        [178, 74],
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
      point: [-52.5, -28],
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

export function upcomingOf(id: PlaceId): UpcomingPlace[] {
  return UPCOMING.filter((place) => place.parent === id);
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
