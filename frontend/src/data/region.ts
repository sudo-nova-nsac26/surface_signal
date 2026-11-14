import type {
  ApiAnalysis,
  ApiArea,
  ApiHydroContext,
  ApiScene,
} from "./api-types";
import { CHANGE_CANDIDATES_ARTIFACT } from "./api-types";
import { listAnalyses, listScenes } from "./source";

/**
 * Turns backend responses into what the interface needs to say. This is the
 * "human translation" step: technical records in, a small plain model out.
 * Wording itself lives in the dictionaries; this file only decides facts.
 */

/** [longitude, latitude] in WGS 84. */
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

export interface ComparisonView {
  analysisId: string;
  /** ISO 8601 UTC acquisition times of the two passes. */
  beforeAt: string;
  afterAt: string;
  /**
   * True when the backend marks the analysis as synthetic: test or sample
   * data, not a real observation. The interface must label it.
   */
  illustrative: boolean;
  /** True only when an independent reference confirmed the result. */
  validated: boolean;
  /** Area of water-change candidates in km². Null means not measured. */
  waterAreaKm2: number | null;
  hasChangeShapes: boolean;
  riverContext: ApiHydroContext[];
}

export interface RegionView {
  areaId: string;
  /** Technical name from the backend; friendly names live in area-labels.ts. */
  name: string;
  center: LngLat;
  bounds: [LngLat, LngLat];
  availability: Availability;
  sceneCount: number;
  /** Most recent comparable pair of passes, when one exists. */
  latestPair: { beforeAt: string; afterAt: string } | null;
  comparison: ComparisonView | null;
}

/**
 * Same rule as `comparable()` in the backend: two passes can be compared only
 * when the radar looked at the place the same way both times.
 */
const PAIR_KEYS = [
  "track",
  "frame",
  "direction",
  "mode",
  "polarization",
  "release",
] as const;

export function comparable(before: ApiScene, after: ApiScene): boolean {
  return (
    Date.parse(before.start_time) < Date.parse(after.start_time) &&
    before.area_id === after.area_id &&
    PAIR_KEYS.every((key) => before[key] !== null && before[key] === after[key])
  );
}

function latestComparablePair(scenes: ApiScene[]) {
  const sorted = [...scenes].sort(
    (a, b) => Date.parse(b.start_time) - Date.parse(a.start_time),
  );
  for (const after of sorted) {
    const before = sorted.find((candidate) => comparable(candidate, after));
    if (before) {
      return { beforeAt: before.start_time, afterAt: after.start_time };
    }
  }
  return null;
}

function collectPositions(node: unknown, out: LngLat[]) {
  if (!Array.isArray(node)) return;
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    out.push([node[0], node[1]]);
    return;
  }
  for (const child of node) collectPositions(child, out);
}

export function boundsOf(area: ApiArea): [LngLat, LngLat] {
  const positions: LngLat[] = [];
  collectPositions(area.geometry.coordinates, positions);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of positions) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

function toComparison(analysis: ApiAnalysis): ComparisonView | null {
  const [before, after] = analysis.scenes;
  if (!before || !after) return null;
  const area = analysis.statistics.candidate_area_km2;
  return {
    analysisId: analysis.analysis_id,
    beforeAt: before.start_time,
    afterAt: after.start_time,
    illustrative: analysis.synthetic || analysis.evidence.synthetic,
    validated: analysis.evidence.validation_status === "validated",
    waterAreaKm2: typeof area === "number" ? area : null,
    hasChangeShapes: CHANGE_CANDIDATES_ARTIFACT in analysis.artifacts,
    riverContext: analysis.provenance.hydrological_context ?? [],
  };
}

/** Real observations win over samples; among equals, the latest pass wins. */
function pickComparison(analyses: ApiAnalysis[]): ComparisonView | null {
  const views = analyses
    .map(toComparison)
    .filter((view): view is ComparisonView => view !== null)
    .sort(
      (a, b) =>
        Number(a.illustrative) - Number(b.illustrative) ||
        Date.parse(b.afterAt) - Date.parse(a.afterAt),
    );
  return views[0] ?? null;
}

export function buildRegionView(
  area: ApiArea,
  scenes: ApiScene[],
  analyses: ApiAnalysis[],
): RegionView {
  const bounds = boundsOf(area);
  const comparison = pickComparison(analyses);
  const latestPair = latestComparablePair(scenes);
  return {
    areaId: area.area_id,
    name: area.name,
    center: [
      (bounds[0][0] + bounds[1][0]) / 2,
      (bounds[0][1] + bounds[1][1]) / 2,
    ],
    bounds,
    availability: comparison ? "analysis" : latestPair ? "catalog" : "no-pair",
    sceneCount: scenes.length,
    latestPair,
    comparison,
  };
}

export async function loadRegionView(
  area: ApiArea,
  signal?: AbortSignal,
): Promise<RegionView> {
  const [scenes, analyses] = await Promise.all([
    listScenes(area.area_id, signal),
    listAnalyses(area.area_id, signal),
  ]);
  return buildRegionView(area, scenes, analyses);
}

/* ---------------------------------------------------------------------- */
/* Timeline: the satellite passes over a place, taken two at a time. Each  */
/* step compares one pass with the previous pass of the same kind, so the  */
/* visitor can move forward and back through what happened.                */
/* ---------------------------------------------------------------------- */

export interface TimelinePass {
  sceneId: string;
  /** ISO 8601 UTC acquisition time. */
  at: string;
  /** "ASCENDING" or "DESCENDING" when known. */
  direction: string | null;
}

export interface TimelineAnalysis {
  analysisId: string;
  illustrative: boolean;
  hasChangeShapes: boolean;
}

export interface TimelineStep {
  /** Stable identifier: the two acquisition times. */
  id: string;
  beforeAt: string;
  afterAt: string;
  direction: string | null;
  /** The prepared comparison for this step, when the backend has one. */
  analysis: TimelineAnalysis | null;
}

export interface TimelineEvent {
  /** ISO 8601 UTC time of the observation. */
  at: string;
  source: string;
  url: string;
  stations: string[];
}

export interface TimelineView {
  passes: TimelinePass[];
  steps: TimelineStep[];
  events: TimelineEvent[];
}

const stepId = (beforeAt: string, afterAt: string) => `${beforeAt}|${afterAt}`;

export function buildTimeline(
  scenes: ApiScene[],
  analyses: ApiAnalysis[],
): TimelineView {
  const real = scenes.filter((scene) => !scene.synthetic);

  const passes = new Map<string, TimelinePass>();
  for (const scene of real) {
    passes.set(scene.start_time, {
      sceneId: scene.scene_id,
      at: scene.start_time,
      direction: scene.direction,
    });
  }

  // Analyses and river bulletins from the backend.
  const prepared = new Map<string, TimelineAnalysis>();
  const events = new Map<string, TimelineEvent>();
  for (const analysis of analyses) {
    const [before, after] = analysis.scenes;
    if (!before || !after) continue;
    prepared.set(stepId(before.start_time, after.start_time), {
      analysisId: analysis.analysis_id,
      illustrative: analysis.synthetic || analysis.evidence.synthetic,
      hasChangeShapes: CHANGE_CANDIDATES_ARTIFACT in analysis.artifacts,
    });
    for (const record of analysis.provenance.hydrological_context ?? []) {
      const key = `${record.observed_at}|${record.source_url}`;
      const event = events.get(key) ?? {
        at: record.observed_at,
        source: "SGB",
        url: record.source_url,
        stations: [],
      };
      if (!event.stations.includes(record.station)) {
        event.stations.push(record.station);
      }
      events.set(key, event);
    }
  }

  // Consecutive passes of the same kind: same track, frame, direction...
  const groups = new Map<string, ApiScene[]>();
  for (const scene of real) {
    const key = PAIR_KEYS.map((name) => String(scene[name])).join("|");
    groups.set(key, [...(groups.get(key) ?? []), scene]);
  }
  const steps = new Map<string, TimelineStep>();
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const before = sorted[i - 1];
      const after = sorted[i];
      if (!comparable(before, after)) continue;
      const id = stepId(before.start_time, after.start_time);
      steps.set(id, {
        id,
        beforeAt: before.start_time,
        afterAt: after.start_time,
        direction: after.direction,
        analysis: prepared.get(id) ?? null,
      });
    }
  }
  // A prepared comparison between passes that are not neighbours still counts.
  for (const [id, analysis] of prepared) {
    if (steps.has(id)) continue;
    const [beforeAt, afterAt] = id.split("|");
    steps.set(id, { id, beforeAt, afterAt, direction: null, analysis });
  }

  const byTime = (a: { at: string }, b: { at: string }) =>
    Date.parse(a.at) - Date.parse(b.at);
  return {
    passes: [...passes.values()].sort(byTime),
    steps: [...steps.values()].sort(
      (a, b) =>
        Date.parse(a.afterAt) - Date.parse(b.afterAt) ||
        Date.parse(a.beforeAt) - Date.parse(b.beforeAt),
    ),
    events: [...events.values()].sort(byTime),
  };
}

export async function loadTimeline(
  areaId: string,
  signal?: AbortSignal,
): Promise<TimelineView> {
  const [scenes, analyses] = await Promise.all([
    listScenes(areaId, signal),
    listAnalyses(areaId, signal),
  ]);
  return buildTimeline(scenes, analyses);
}
