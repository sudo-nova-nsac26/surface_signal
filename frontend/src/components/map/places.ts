import type { LngLat } from "@/data/region";

/**
 * The places the visitor can travel to, as a tree:
 * World > Country > State > Region of the state (the analysed valley).
 * Only the path to the Taquari Valley exists for now.
 *
 * Places that are not ready yet are listed in UPCOMING: they appear on the
 * map as dark dots that cannot be opened. Moving one into buildPlaces (with
 * its bounds) is all it takes to open it.
 *
 * Names and descriptions of open places live in the dictionaries under
 * `map.places`; the names of upcoming places are written here, in both
 * languages, because they are proper names.
 */
export type PlaceId =
  | "world"
  | "brazil"
  | "rio-grande-do-sul"
  | "taquari-valley";

/**
 * The strong outline drawn around the area the visitor is looking at: a
 * bundled outline (see public/data/boundaries).
 */
export interface Outline {
  url: string;
}

export interface Place {
  id: PlaceId;
  parent: PlaceId | null;
  /** Strong outline around this place while the visitor is in it. */
  outline?: Outline;
  /**
   * Where the camera looks when the place has no close-up. When absent the
   * camera fits `bounds`. The world is framed on Brazil, not on its middle,
   * so the country of the story is always in front.
   */
  focus?: { center: LngLat };
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

export interface UpcomingPlace {
  id: string;
  parent: PlaceId;
  name: { pt: string; en: string };
  point: LngLat;
}

const country = (
  id: string,
  pt: string,
  en: string,
  point: LngLat,
): UpcomingPlace => ({ id, parent: "world", name: { pt, en }, point });

const state = (
  id: string,
  name: string,
  point: LngLat,
): UpcomingPlace => ({ id, parent: "brazil", name: { pt: name, en: name }, point });

const region = (
  id: string,
  pt: string,
  en: string,
  point: LngLat,
): UpcomingPlace => ({
  id,
  parent: "rio-grande-do-sul",
  name: { pt, en },
  point,
});

export const UPCOMING: UpcomingPlace[] = [
  // Countries, seen from the world.
  country("us", "Estados Unidos", "United States", [-98, 39]),
  country("ca", "Canadá", "Canada", [-100, 58]),
  country("mx", "México", "Mexico", [-102, 23]),
  country("co", "Colômbia", "Colombia", [-73, 4]),
  country("pe", "Peru", "Peru", [-75, -10]),
  country("ar", "Argentina", "Argentina", [-64, -35]),
  country("cl", "Chile", "Chile", [-71.5, -36]),
  country("gb", "Reino Unido", "United Kingdom", [-2, 54]),
  country("fr", "França", "France", [2, 46.5]),
  country("de", "Alemanha", "Germany", [10.5, 51]),
  country("es", "Espanha", "Spain", [-3.5, 40]),
  country("pt", "Portugal", "Portugal", [-8, 39.5]),
  country("eg", "Egito", "Egypt", [30, 26.5]),
  country("ng", "Nigéria", "Nigeria", [8, 9.5]),
  country("za", "África do Sul", "South Africa", [25, -29]),
  country("ru", "Rússia", "Russia", [95, 61]),
  country("in", "Índia", "India", [79, 22]),
  country("cn", "China", "China", [104, 35]),
  country("jp", "Japão", "Japan", [138, 36]),
  country("au", "Austrália", "Australia", [134, -25]),

  // The other states of Brazil, seen from Brazil.
  state("br-ac", "Acre", [-70.5, -9]),
  state("br-al", "Alagoas", [-36.6, -9.6]),
  state("br-ap", "Amapá", [-51.9, 1.4]),
  state("br-am", "Amazonas", [-64.6, -4]),
  state("br-ba", "Bahia", [-41.7, -12.5]),
  state("br-ce", "Ceará", [-39.3, -5.2]),
  state("br-df", "Distrito Federal", [-47.8, -15.8]),
  state("br-es", "Espírito Santo", [-40.7, -19.6]),
  state("br-go", "Goiás", [-49.6, -15.9]),
  state("br-ma", "Maranhão", [-45.3, -5.2]),
  state("br-mt", "Mato Grosso", [-55.9, -12.9]),
  state("br-ms", "Mato Grosso do Sul", [-54.6, -20.5]),
  state("br-mg", "Minas Gerais", [-44.7, -18.5]),
  state("br-pa", "Pará", [-52.5, -3.8]),
  state("br-pb", "Paraíba", [-36.8, -7.1]),
  state("br-pr", "Paraná", [-51.6, -24.7]),
  state("br-pe", "Pernambuco", [-37.9, -8.4]),
  state("br-pi", "Piauí", [-42.8, -7.7]),
  state("br-rj", "Rio de Janeiro", [-42.7, -22.2]),
  state("br-rn", "Rio Grande do Norte", [-36.5, -5.8]),
  state("br-ro", "Rondônia", [-62.8, -10.9]),
  state("br-rr", "Roraima", [-61.4, 2.1]),
  state("br-sc", "Santa Catarina", [-50.5, -27.3]),
  state("br-sp", "São Paulo", [-48.5, -22.2]),
  state("br-se", "Sergipe", [-37.4, -10.6]),
  state("br-to", "Tocantins", [-48.3, -10.2]),

  // The other regions of Rio Grande do Sul, seen from the state.
  region("rs-serra", "Serra Gaúcha", "Serra Gaúcha", [-51.18, -29.17]),
  region("rs-metropolitana", "Região Metropolitana", "Porto Alegre metro area", [-51.2, -30.03]),
  region("rs-litoral", "Litoral Norte", "North coast", [-50.27, -29.8]),
  region("rs-sul", "Região Sul", "South", [-52.34, -31.77]),
  region("rs-campanha", "Campanha", "Campanha", [-54.1, -31.3]),
  region("rs-fronteira-oeste", "Fronteira Oeste", "Western border", [-56.6, -29.75]),
  region("rs-missoes", "Missões", "Missões", [-54.26, -28.3]),
  region("rs-planalto", "Planalto Médio", "Central plateau", [-52.4, -28.26]),
  region("rs-central", "Região Central", "Central region", [-53.8, -29.68]),
  region("rs-rio-pardo", "Vale do Rio Pardo", "Rio Pardo Valley", [-52.6, -29.95]),
];

export function buildPlaces(valleyCenter: LngLat): Place[] {
  return [
    {
      id: "world",
      parent: null,
      focus: { center: [-52, -14] },
      point: [0, 0],
      bounds: [
        [-170, -56],
        [178, 74],
      ],
    },
    {
      id: "brazil",
      parent: "world",
      outline: { url: "/data/boundaries/brazil.geojson" },
      point: [-52, -14],
      bounds: [
        [-74, -34],
        [-34, 5.5],
      ],
    },
    {
      id: "rio-grande-do-sul",
      parent: "brazil",
      outline: { url: "/data/boundaries/rio-grande-do-sul.geojson" },
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
