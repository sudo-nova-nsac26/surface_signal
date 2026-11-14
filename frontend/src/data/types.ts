/**
 * Shapes of the prepared files under public/data.
 *
 * The site never opens raw radar products. An offline step turns a pair of
 * NISAR scenes into a few small files (a summary and one GeoJSON per layer),
 * and the site only reads those. Replacing the sample files with real outputs
 * that follow these shapes needs no code change.
 */

export type LocaleCode = "pt" | "en";

export type LocalizedText = Record<LocaleCode, string>;

/** [longitude, latitude] in WGS 84, the order GeoJSON and MapLibre use. */
export type LngLat = [number, number];

/**
 * What the site can show for a region:
 * - analysis: a prepared before/after comparison exists.
 * - catalog: the satellite has comparable scenes, but nobody processed them yet.
 * - no-pair: there are not two comparable passes for that place yet.
 */
export type Availability = "analysis" | "catalog" | "no-pair";

export type LayerId = "water" | "vegetation" | "slopes";

/**
 * - available: shown as the main result.
 * - exploratory: shown, clearly marked as still being tested.
 * - unavailable: not shown; the site explains why.
 */
export type LayerStatus = "available" | "exploratory" | "unavailable";

export interface Landmark {
  id: string;
  name: LocalizedText;
  center: LngLat;
  zoom: number;
}

export interface Region {
  id: string;
  name: LocalizedText;
  /** Where the region is, in everyday words ("Rio Grande do Sul, Brazil"). */
  place: LocalizedText;
  center: LngLat;
  zoom: number;
  availability: Availability;
  /** Folder name under public/data/analyses when availability is "analysis". */
  analysisId?: string;
  /** Well-known places people can jump to instead of typing an address. */
  landmarks?: Landmark[];
}

export interface RegionIndex {
  regions: Region[];
}

export interface SceneRef {
  /** Catalog identifier, kept so anyone can find the original product. */
  sceneId: string;
  /** ISO 8601 UTC acquisition start. */
  acquiredAt: string;
}

export interface LayerSummary {
  status: LayerStatus;
  /** GeoJSON file name inside the analysis folder; absent when unavailable. */
  file?: string;
  /** Changed area in km². Null means "not measured", never zero. */
  areaKm2: number | null;
  /** One plain-language sentence describing what this layer shows here. */
  headline: LocalizedText;
}

export interface ContextNote {
  source: string;
  url: string;
  /** ISO 8601 UTC time of the observation. */
  observedAt: string;
  note: LocalizedText;
}

export interface SourceRef {
  name: string;
  url: string;
}

export interface AnalysisSummary {
  id: string;
  regionId: string;
  /**
   * True while the shapes are hand-made samples used to build the interface.
   * The site shows an "illustrative data" badge whenever this is true.
   */
  illustrative: boolean;
  /** Whether an independent reference confirmed the result. */
  validation: "not_validated" | "validated";
  before: SceneRef;
  after: SceneRef;
  layers: Record<LayerId, LayerSummary>;
  context: ContextNote[];
  sources: SourceRef[];
}
