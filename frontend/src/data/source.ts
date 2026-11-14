import type { ApiAnalysis, ApiArea, ApiScene, Page } from "./api-types";

/**
 * The single door to data. Every component asks this module; none reads a
 * file or builds a backend address on its own.
 *
 * Two sources, same shapes:
 * - API mode: NEXT_PUBLIC_API_BASE_URL points at the SurfaceSignal backend
 *   (for example http://127.0.0.1:8000 from `docker compose up`).
 * - Static mode (no variable set): reads a snapshot of the same responses
 *   from public/data/api/v1, so the site also works with no backend running.
 *
 * Switching between them is configuration only.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export const dataSourceMode: "api" | "static" = API_BASE ? "api" : "static";

const STATIC_ROOT = "/data/api/v1";
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
  return (await response.json()) as T;
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
