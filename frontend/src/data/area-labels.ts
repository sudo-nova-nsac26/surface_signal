import type { LngLat } from "./region";

type Localized = { pt: string; en: string };

/**
 * Everyday names for the areas the backend knows by a technical id.
 * The backend stays technical on purpose; friendly wording is the web app's
 * job. An area without an entry here falls back to the backend's own name.
 */
export interface AreaLabel {
  name: Localized;
  place: Localized;
  /** Well-known places people can jump to instead of typing an address. */
  landmarks?: { id: string; name: Localized; center: LngLat; zoom: number }[];
}

export const AREA_LABELS: Record<string, AreaLabel> = {
  "vale-do-taquari": {
    name: { pt: "Lajeado e Estrela", en: "Lajeado and Estrela" },
    place: {
      pt: "Vale do Taquari, Rio Grande do Sul",
      en: "Taquari Valley, Rio Grande do Sul, Brazil",
    },
  },
};

/** The area the guided story is about. */
export const STORY_AREA_ID = "vale-do-taquari";
