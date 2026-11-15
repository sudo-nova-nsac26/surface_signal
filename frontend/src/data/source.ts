import {
  assertEnvironmentalReport,
  filterEnvironmentalEvents,
  validReference,
  validContextSource,
  validEvent,
} from "./environmental";
import type {
  AnalysisValidation,
  ApiAnalysis,
  ApiAnalysisStatistics,
  ApiArea,
  ApiLayerList,
  ApiOverview,
  ApiScene,
  ApiStory,
  ApiTimeline,
  ContextSource,
  EnvironmentalContextReport,
  EnvironmentalEvent,
  Lang,
  Page,
  ReferenceLayer,
} from "./api-types";

/**
 * The single door to data. Every component asks this module; none reads a
 * file or builds a backend address on its own.
 *
 * Two sources, same shapes:
 * - API mode: NEXT_PUBLIC_API_BASE_URL points at the SurfaceSignal backend
 *   (for example http://127.0.0.1:8000 during local API development).
 * - Static mode (no variable set): reads a snapshot of the same responses
 *   from public/data/compact/api/v1. An explicitly installed full snapshot can
 *   be selected with NEXT_PUBLIC_STATIC_SNAPSHOT=full.
 *
 * Switching between them is configuration only.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);
if (API_BASE) {
  const address = new URL(API_BASE);
  if (!/^https?:$/.test(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) address without credentials, query or fragment");
  }
}

export const dataSourceMode: "api" | "static" = API_BASE ? "api" : "static";

const SNAPSHOT = process.env.NEXT_PUBLIC_STATIC_SNAPSHOT ?? "compact";
if (SNAPSHOT !== "compact" && SNAPSHOT !== "full") {
  throw new Error("NEXT_PUBLIC_STATIC_SNAPSHOT must be compact or full");
}
export const compactSnapshot = dataSourceMode === "static" && SNAPSHOT === "compact";
const STATIC_ROOT = SNAPSHOT === "full" ? "/data/api/v1" : "/data/compact/api/v1";
const PAGE_LIMIT = 200;

export class DataSourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DataSourceError";
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new DataSourceError(`Could not reach ${url}`);
  }
  if (!response.ok) {
    throw new DataSourceError(`Request failed: ${url}`, response.status);
  }
  try { return (await response.json()) as T; }
  catch { throw new DataSourceError("Invalid prepared JSON", 503); }
}

/** Reads every page of a list route (the backend caps a page at 200 items). */
async function getAllPages<T>(
  path: string,
  query: Record<string, string>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const params = new URLSearchParams({
      ...query,
      offset: String(offset),
      limit: String(PAGE_LIMIT),
    });
    const page = await getJson<Page<T>>(
      `${API_BASE}/api/v1/${path}?${params}`,
      signal,
    );
    items.push(...page.items);
    if (items.length >= page.total || page.items.length === 0) return items;
  }
}

async function getStaticList<T>(
  file: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const page = await getJson<Page<T>>(`${STATIC_ROOT}/${file}`, signal);
  return page.items;
}

export function listAreas(signal?: AbortSignal): Promise<ApiArea[]> {
  return dataSourceMode === "api"
    ? getAllPages<ApiArea>("areas", {}, signal)
    : getStaticList<ApiArea>("areas.json", signal);
}

export async function listScenes(
  areaId: string,
  signal?: AbortSignal,
): Promise<ApiScene[]> {
  if (dataSourceMode === "api") {
    return getAllPages<ApiScene>("scenes", { area_id: areaId }, signal);
  }
  const all = await getStaticList<ApiScene>("scenes.json", signal);
  return all.filter((scene) => scene.area_id === areaId);
}

export async function listAnalyses(
  areaId: string,
  signal?: AbortSignal,
): Promise<ApiAnalysis[]> {
  if (dataSourceMode === "api") {
    return getAllPages<ApiAnalysis>("analyses", { area_id: areaId }, signal);
  }
  const all = await getStaticList<ApiAnalysis>("analyses.json", signal);
  return all.filter((analysis) => analysis.area_id === areaId);
}

/** Address of one output file of an analysis (GeoJSON, preview image...). */
export function artifactUrl(analysisId: string, name: string): string {
  const path = `analyses/${encodeURIComponent(analysisId)}/artifacts/${encodeURIComponent(name)}`;
  return dataSourceMode === "api"
    ? `${API_BASE}/api/v1/${path}`
    : `${STATIC_ROOT}/${path}`;
}

export function getArtifactJson<T>(
  analysisId: string,
  name: string,
  signal?: AbortSignal,
): Promise<T> {
  return getJson<T>(artifactUrl(analysisId, name), signal);
}

// ---------------------------------------------------------------------------
// Backend MVP resources. The static bundle stores language variants as
// name.pt.json / name.en.json (docs/static-publication.md).

function resource<T>(apiPath: string, staticPath: string, signal?: AbortSignal) {
  return getJson<T>(
    dataSourceMode === "api" ? `${API_BASE}/api/v1/${apiPath}` : `${STATIC_ROOT}/${staticPath}`,
    signal,
  );
}

const enc = encodeURIComponent;

export function getAreaOverview(areaId: string, lang: Lang, signal?: AbortSignal) {
  return resource<ApiOverview>(
    `areas/${enc(areaId)}/overview?lang=${lang}`,
    `areas/${enc(areaId)}/overview.${lang}.json`,
    signal,
  );
}

export function getAreaTimeline(areaId: string, lang: Lang, signal?: AbortSignal) {
  return resource<ApiTimeline>(
    `areas/${enc(areaId)}/timeline?lang=${lang}`,
    `areas/${enc(areaId)}/timeline.${lang}.json`,
    signal,
  );
}

export function getAnalysisStatistics(analysisId: string, signal?: AbortSignal) {
  return resource<ApiAnalysisStatistics>(
    `analyses/${enc(analysisId)}/statistics`,
    `analyses/${enc(analysisId)}/statistics.json`,
    signal,
  );
}

export function getAnalysisLayers(analysisId: string, signal?: AbortSignal) {
  return resource<ApiLayerList>(
    `analyses/${enc(analysisId)}/layers`,
    `analyses/${enc(analysisId)}/layers.json`,
    signal,
  );
}

export function getAnalysisStory(analysisId: string, lang: Lang, signal?: AbortSignal) {
  return resource<ApiStory>(
    `analyses/${enc(analysisId)}/story?lang=${lang}`,
    `analyses/${enc(analysisId)}/story.${lang}.json`,
    signal,
  );
}

/** General change polygons (increase and decrease in one file, by properties.class). */
export const GENERAL_CHANGE_ARTIFACT = "general-change.geojson";

/** Only bounded, published internal GeoJSON paths are permitted for reference overlays. */
export function referenceArtifactUrl(value: string): string {
  const match = value.match(/^\/(?:api\/v1|data\/(?:compact\/)?api\/v1)\/areas\/([A-Za-z0-9_-]+)\/references\/([A-Za-z0-9_-]+\.geojson)$/);
  if (!match) throw new DataSourceError("Invalid reference artifact address");
  return `${dataSourceMode === "api" ? `${API_BASE}/api/v1` : STATIC_ROOT}/areas/${match[1]}/references/${match[2]}`;
}
function environmentalPath(path: string) {
  return dataSourceMode === "api" ? `${API_BASE}/api/v1/${path}` : `${STATIC_ROOT}/${path}.json`;
}
export async function getEnvironmentalContext(analysisId: string, signal?: AbortSignal): Promise<EnvironmentalContextReport> {
  const value = await getJson<EnvironmentalContextReport>(environmentalPath(`analyses/${encodeURIComponent(analysisId)}/environmental-context`), signal);
  try { return assertEnvironmentalReport(value, analysisId); }
  catch { throw new DataSourceError("Invalid prepared environmental context", 503); }
}
export async function listEnvironmentalEvents(areaId: string, start?: string, end?: string, signal?: AbortSignal): Promise<EnvironmentalEvent[]> {
  try { filterEnvironmentalEvents([], start, end); } catch { throw new DataSourceError("Invalid UTC interval", 422); }
  const path = `areas/${encodeURIComponent(areaId)}/environmental-events`;
  const values = dataSourceMode === "api"
    ? await getAllPages<EnvironmentalEvent>(path, { ...(start ? {start} : {}), ...(end ? {end} : {}) }, signal)
    : await getStaticList<EnvironmentalEvent>(`${path}.json`, signal);
  if (!Array.isArray(values) || !values.every(validEvent)) throw new DataSourceError("Invalid prepared events", 503);
  return filterEnvironmentalEvents(values, start, end);
}
export async function listReferenceLayers(areaId: string, signal?: AbortSignal): Promise<ReferenceLayer[]> {
  const value = await getJson<{area_id: string; items: ReferenceLayer[]}>(environmentalPath(`areas/${encodeURIComponent(areaId)}/reference-layers`), signal);
  if (value.area_id !== areaId || !Array.isArray(value.items) || !value.items.every(validReference)) throw new DataSourceError("Invalid prepared references", 503);
  return value.items.map(item => ({...item, artifact_url: item.artifact_url && item.redistribution_allowed ? referenceArtifactUrl(item.artifact_url) : null}));
}
export async function getAnalysisValidation(analysisId: string, signal?: AbortSignal): Promise<AnalysisValidation> {
  const value = await getJson<AnalysisValidation>(environmentalPath(`analyses/${encodeURIComponent(analysisId)}/validation`), signal);
  if (!value || typeof value.status !== "string" || !Array.isArray(value.limitations) || !(value.metrics === null || typeof value.metrics === "object")) throw new DataSourceError("Invalid prepared validation", 503);
  return value;
}
export async function listContextSources(signal?: AbortSignal): Promise<ContextSource[]> {
  const items = await (dataSourceMode === "api" ? getAllPages<ContextSource>("context/sources", {}, signal) : getStaticList<ContextSource>("context-sources.json", signal));
  if (!Array.isArray(items) || !items.every(validContextSource)) throw new DataSourceError("Invalid prepared source inventory", 503);
  return items;
}
export async function getReferenceGeoJson(url: string, signal?: AbortSignal): Promise<import("geojson").FeatureCollection> {
  // A resolved API URL is allowed only on the configured API origin.
  const path = API_BASE && url.startsWith(`${API_BASE}/`) ? url.slice(API_BASE.length) : url;
  const response = await fetch(referenceArtifactUrl(path), {signal, headers: {Accept: "application/geo+json"}});
  if (!response.ok) throw new DataSourceError("Could not load reference", response.status);
  const maxBytes = 2_000_000;
  if (Number(response.headers.get("content-length")) > maxBytes) throw new DataSourceError("Reference exceeds size budget", 503);
  const reader = response.body?.getReader();
  if (!reader) throw new DataSourceError("Missing reference body", 503);
  let size = 0; const parts: Uint8Array[] = [];
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new DataSourceError("Reference exceeds size budget", 503); }
    parts.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (value.type !== "FeatureCollection" || !Array.isArray(value.features) || value.features.length > 5000) throw new Error();
    return value;
  } catch { throw new DataSourceError("Invalid reference geometry", 503); }
}
