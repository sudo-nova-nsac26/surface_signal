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
