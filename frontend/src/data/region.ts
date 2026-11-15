import type {
  ApiAnalysis,
  ApiAnalysisStatistics,
  ApiArea,
  ApiHydroContext,
  ApiLayer,
  ApiScene,
  ApiStory,
  ApiTimeline,
  Lang,
  Localized,
} from "./api-types";
import { CHANGE_CANDIDATES_ARTIFACT } from "./api-types";
import { FEATURED, type FeaturedReason } from "./featured";
import {
  getAnalysisLayers,
  getAnalysisStatistics,
  getAnalysisStory,
  getAreaTimeline,
  listAnalyses,
  listScenes,
} from "./source";

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
/* Timeline: the comparisons the backend prepared for a region. Identity,  */
/* grouping and links come from the backend (comparison_id, group_id); the */
/* guided story shows a curated subset (featured.ts), never mixing groups. */
/* ---------------------------------------------------------------------- */

export interface TimelinePass {
  /** ISO 8601 UTC acquisition time. */
  at: string;
  groupId: string | null;
}

/** What the environmental panel needs to know about the comparison's analysis. */
export interface TimelineAnalysis {
  analysisId: string;
  illustrative: boolean;
  hasChangeShapes: boolean;
  candidateAreaKm2: number | null;
  validAreaKm2: number | null;
}

export interface TimelineStep {
  /** The backend comparison_id. */
  id: string;
  groupId: string;
  analysisId: string | null;
  beforeAt: string;
  afterAt: string;
  direction: string;
  reason: FeaturedReason | null;
  validation: string;
  /** Short backend summary in both languages, when present. */
  summary: Localized | null;
  /** The analysis behind this comparison, for the environmental panel. */
  analysis: TimelineAnalysis | null;
}

export interface TimelineEvent {
  at: string;
  url: string;
  stations: string[];
  note: string;
}

export interface TimelineView {
  passes: TimelinePass[];
  steps: TimelineStep[];
  events: TimelineEvent[];
  dataStatus: string;
}

const dayOf = (iso: string) => iso.slice(0, 10);

export function buildStoryTimeline(timeline: ApiTimeline): TimelineView {
  const byDates = new Map(
    timeline.comparisons.map((c) => [`${dayOf(c.before_time)}|${dayOf(c.after_time)}`, c]),
  );
  const steps: TimelineStep[] = [];
  for (const pick of FEATURED) {
    const c = byDates.get(`${pick.before}|${pick.after}`);
    if (!c) continue;
    const analysisId = c.analysis_ids[0] ?? null;
    steps.push({
      id: c.comparison_id,
      groupId: c.group_id,
      analysisId,
      beforeAt: c.before_time,
      afterAt: c.after_time,
      direction: c.direction,
      reason: pick.reason,
      validation: c.validation_status,
      summary: analysisId ? (c.summaries[analysisId] ?? null) : null,
      analysis: analysisId
        ? {
            analysisId,
            illustrative: timeline.data_status !== "real",
            hasChangeShapes: true,
            candidateAreaKm2:
              c.statistics?.[analysisId]?.open_water?.statistics?.candidate_area_km2 ?? null,
            validAreaKm2:
              c.statistics?.[analysisId]?.general_change?.statistics?.valid_area_km2 ??
              c.statistics?.[analysisId]?.open_water?.statistics?.valid_area_km2 ??
              null,
          }
        : null,
    });
  }
  // The passes of the comparisons the story shows, as dots on the ruler.
  // Earlier or later passes cannot be reached, so they are not drawn.
  const passes = steps.flatMap((step) => [
    { at: step.beforeAt, groupId: step.groupId },
    { at: step.afterAt, groupId: step.groupId },
  ]);
  const uniquePasses = [...new Map(passes.map((p) => [p.at, p])).values()].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  const events = new Map<string, TimelineEvent>();
  for (const event of timeline.events) {
    const key = `${event.observed_at}|${event.source_url}`;
    const entry = events.get(key) ?? {
      at: event.observed_at,
      url: event.source_url,
      stations: [],
      note: event.note,
    };
    if (!entry.stations.includes(event.station)) entry.stations.push(event.station);
    events.set(key, entry);
  }
  return {
    passes: uniquePasses,
    steps,
    events: [...events.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    dataStatus: timeline.data_status,
  };
}

export async function loadStoryTimeline(
  areaId: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<TimelineView> {
  return buildStoryTimeline(await getAreaTimeline(areaId, lang, signal));
}

/* ---------------------------------------------------------------------- */
/* One comparison in detail: numbers, layers and the explanation.         */
/* ---------------------------------------------------------------------- */

export interface ComparisonDetail {
  stats: ApiAnalysisStatistics;
  layers: ApiLayer[];
  story: ApiStory;
}

export async function loadComparisonDetail(
  analysisId: string,
  lang: Lang,
  signal?: AbortSignal,
): Promise<ComparisonDetail> {
  const [stats, layers, story] = await Promise.all([
    getAnalysisStatistics(analysisId, signal),
    getAnalysisLayers(analysisId, signal),
    getAnalysisStory(analysisId, lang, signal),
  ]);
  return { stats, layers: layers.items, story };
}
