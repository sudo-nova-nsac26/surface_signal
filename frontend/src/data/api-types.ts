/**
 * Shapes returned by the SurfaceSignal backend (FastAPI), mirroring the
 * Pydantic models in backend/src/surfacesignal/domain.py and the routes in
 * docs/api-contract.md. Keep these in step with the backend: nothing else in
 * the web app should describe backend data.
 */

export interface GeoJsonPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

/** GET /api/v1/areas */
export interface ApiArea {
  area_id: string;
  name: string;
  geometry: GeoJsonPolygon;
  source_url: string;
  description: string;
  crs: "EPSG:4326";
  max_pixels: number;
}

/** GET /api/v1/scenes */
export interface ApiScene {
  scene_id: string;
  area_id: string;
  /** ISO 8601, UTC. */
  start_time: string;
  track: number | null;
  frame: number | null;
  direction: string | null;
  mode: string | null;
  polarization: string | null;
  release: string | null;
  maturity: string | null;
  url: string | null;
  size_bytes: number | null;
  geometry: GeoJsonPolygon | null;
  metadata: Record<string, unknown>;
  /** True for test data that is not a real observation. */
  synthetic: boolean;
  /** Only present on scene listings, not inside an analysis. */
  local_available?: boolean;
}

export interface ApiHydroContext {
  station: string;
  observed_at: string;
  /** Null when the source gives no numeric reading. Never zero. */
  level_m: number | null;
  source_url: string;
  note: string;
  time_offset_hours: number;
  role: string;
}

export interface ApiEvidence {
  observation: string;
  interpretation: string;
  confidence_level: string;
  validation_status: string;
  reason: string;
  references_attempted: string[];
  alternative_explanations: string[];
  limitations: string[];
  sources: string[];
  provenance: Record<string, unknown>;
  is_operational_alert: false;
  synthetic: boolean;
}

export interface ApiStatistics {
  valid_area_km2?: number | null;
  candidate_area_km2?: number | null;
  candidate_percent?: number | null;
  classification?: string;
  [key: string]: unknown;
}

/** GET /api/v1/analyses */
export interface ApiAnalysis {
  analysis_id: string;
  area_id: string;
  status: "completed";
  synthetic: boolean;
  /** Two scenes: before, then after. */
  scenes: ApiScene[];
  parameters: Record<string, unknown>;
  statistics: ApiStatistics;
  provenance: { hydrological_context?: ApiHydroContext[] } & Record<
    string,
    unknown
  >;
  /** Artifact file name → checksum. */
  artifacts: Record<string, string>;
  evidence: ApiEvidence;
}

/** File served at /api/v1/analyses/{id}/artifacts/change-candidates.geojson */
export const CHANGE_CANDIDATES_ARTIFACT = "change-candidates.geojson";

// ---------------------------------------------------------------------------
// Backend MVP (2026-11-15): overview, timeline, statistics, layers, stories.
// Mirrors docs/static-publication.md and the published static bundle. Only the
// fields the interface reads are typed; the rest stays open.

export type Lang = "pt" | "en";
export type Localized = Record<Lang, string>;
export type ValidationStatus = "not_validated" | (string & {});

/** One layer of a comparison, as listed by /analyses/{id}/layers. */
export interface ApiLayer {
  layer_id: string;
  name: Localized;
  description: Localized;
  limitations: Localized;
  status: "available" | "exploratory" | "unavailable" | (string & {});
  available: boolean;
  artifact_url?: string | null;
  geometry_type?: string | null;
  legend?: { class: string; color: string }[];
  measurement?: string;
  method?: string;
  validation_status?: ValidationStatus;
}

export interface ApiLayerList {
  analysis_id: string;
  items: ApiLayer[];
}

/** Area/percent numbers are null when not measured, never 0 by default. */
export interface ApiGeneralChangeStats {
  valid_area_km2: number | null;
  total_area_km2: number | null;
  invalid_area_km2: number | null;
  changed_area_km2: number | null;
  changed_percent: number | null;
  increase_area_km2: number | null;
  increase_components: number | null;
  decrease_area_km2: number | null;
  decrease_components: number | null;
  discarded_area_km2: number | null;
  [key: string]: unknown;
}

export interface ApiOpenWaterStats {
  candidate_area_km2: number | null;
  candidate_components: number | null;
  candidate_percent: number | null;
  valid_area_km2: number | null;
  classification?: string;
  [key: string]: unknown;
}

/** GET /api/v1/analyses/{id}/statistics */
export interface ApiAnalysisStatistics {
  analysis_id: string;
  general_change: {
    method: string;
    parameters: Record<string, number>;
    statistics: ApiGeneralChangeStats;
  } | null;
  open_water: {
    method: string;
    parameters: Record<string, number | string>;
    statistics: ApiOpenWaterStats;
    status: string;
  } | null;
}

/** GET /api/v1/analyses/{id}/story?lang= */
export interface ApiStory {
  analysis_id: string;
  language: Lang;
  title: string;
  summary: string;
  observation: string;
  result: string;
  interpretation: string;
  water_interpretation?: string;
  alternative_explanations: string[];
  limitations: string[];
  sources: string[];
  key_metrics: { key: string; label: string; unit: string; value: number | null }[];
  general_state: string;
  water_state: string;
  data_status: "real" | "synthetic" | (string & {});
  synthetic: boolean;
  validation_status: ValidationStatus;
  is_operational_alert: boolean;
  methodology: Record<string, unknown>;
}

export interface ApiTimelineComparison {
  comparison_id: string;
  group_id: string;
  before_time: string;
  after_time: string;
  before_scene_id: string;
  after_scene_id: string;
  direction: "ASCENDING" | "DESCENDING" | (string & {});
  track: number;
  frame: number;
  availability: string;
  analysis_ids: string[];
  validation_status: ValidationStatus;
  summaries: Record<string, Localized>;
}

export interface ApiTimelineGroup {
  group_id: string;
  status: string;
  scene_ids: string[];
  metadata: { direction: string; track: number; frame: number; [key: string]: unknown };
}

export interface ApiTimelineEvent {
  observed_at: string;
  station: string;
  note: string;
  source_url: string;
  level_m: number | null;
  role: string;
  time_offset_hours?: number | null;
}

/** GET /api/v1/areas/{id}/timeline?lang= */
export interface ApiTimeline {
  area_id: string;
  data_status: string;
  comparison_count: number;
  comparisons: ApiTimelineComparison[];
  groups: ApiTimelineGroup[];
  events: ApiTimelineEvent[];
  interpretation: { summary: string; limitations: string[]; language: Lang };
}

/** GET /api/v1/areas/{id}/overview?lang= */
export interface ApiOverview {
  area_id: string;
  area: ApiArea;
  availability: string;
  data_status: string;
  comparison_count: number;
  analysis_count: number;
  group_count: number;
  [key: string]: unknown;
}
