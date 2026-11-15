import type { EnvironmentalContextReport, EnvironmentalEvent, ReferenceLayer, ContextSource } from "./api-types";

export function environmentalNumber(value: number | null | undefined, lang: "pt" | "en") {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", { maximumFractionDigits: 2 }).format(value)
    : null;
}
export function environmentalTime(value: string, lang: "pt" | "en") {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date(value)) : null;
}
export function filterEnvironmentalEvents(events: EnvironmentalEvent[], start?: string, end?: string) {
  const bound = (value: string, last: boolean) => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${last ? "23:59:59.999" : "00:00:00.000"}Z` : value);
  const from = start ? bound(start, false) : -Infinity;
  const until = end ? bound(end, true) : Infinity;
  if (Number.isNaN(from) || Number.isNaN(until) || from > until) throw new Error("Invalid UTC interval");
  return events.filter(event => {
    const at = Date.parse(event.observed_at);
    return Number.isFinite(at) && at >= from && at <= until;
  }).sort((a,b) => Date.parse(a.observed_at) - Date.parse(b.observed_at) || a.event_id.localeCompare(b.event_id));
}
export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export function assertEnvironmentalReport(value: EnvironmentalContextReport, analysisId: string) {
  if (!value || value.schema_version !== "1.0" || value.analysis_id !== analysisId ||
      value.is_operational_alert !== false || typeof value.synthetic !== "boolean" ||
      !Number.isFinite(Date.parse(value.observed_at)) ||
      !["available", "partial", "unavailable", "not_checked"].includes(value.data_status) ||
      !value.rainfall?.windows_mm || !Array.isArray(value.hydrology?.records) ||
      !value.historical_water || !Array.isArray(value.land_cover?.classes) ||
      !value.topography || !value.validation || !Array.isArray(value.sources) ||
      !Array.isArray(value.limitations)) throw new Error("Invalid environmental context");
  const states = ["available", "partial", "unavailable", "not_checked"];
  const strings = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === "string");
  for (const block of [value.rainfall, value.hydrology, value.historical_water, value.land_cover, value.topography]) {
    if (!states.includes(block.status) || !strings(block.limitations)) throw new Error("Invalid context state");
  }
  if (!strings(value.validation.limitations) || !strings(value.limitations) ||
      value.sources.some(source => !source || typeof source.name !== "string" || typeof source.url !== "string" || !strings(source.limitations)) ||
      value.hydrology.records.some(record => !record || !Number.isFinite(Date.parse(record.observed_at)) ||
        typeof record.station_id !== "string" || typeof record.station_name !== "string" ||
        !["river_level", "rainfall", "discharge"].includes(record.parameter) || typeof record.unit !== "string") ||
      value.land_cover.classes.some(item => !item || typeof item.class_id !== "string" || typeof item.label !== "string")) {
    throw new Error("Invalid context details");
  }
  const text = (item: unknown) => item == null || typeof item === "string";
  const number = (item: unknown) => item == null || typeof item === "number" && Number.isFinite(item);
  if (![value.rainfall.source_id, value.rainfall.product, value.rainfall.run, value.historical_water.collection].every(text) ||
      ![value.historical_water.reference_year, value.land_cover.reference_year].every(number) ||
      value.sources.some(source => ![source.source_id, source.name, source.url, source.attribution, source.terms_url, source.product, source.dataset_version, source.license_id, source.observed_start, source.observed_end].every(text) || !number(source.reference_year) || !number(source.resolution_m)) ||
      value.hydrology.records.some(record => ![record.datum, record.quality_status, record.source_id].every(text) || !number(record.time_offset_hours)) ||
      (value.validation.metrics !== null && (typeof value.validation.metrics !== "object" || Array.isArray(value.validation.metrics) || !Object.values(value.validation.metrics).every(number)))) {
    throw new Error("Invalid display field");
  }
  const numbers = [value.rainfall.coverage_fraction, value.rainfall.resolution_km_approx,
    ...Object.values(value.rainfall.windows_mm), value.historical_water.overlap_km2,
    value.historical_water.overlap_fraction, value.topography.elevation_m, value.topography.slope_deg,
    ...value.hydrology.records.map(r => r.value), ...value.land_cover.classes.map(c => c.percent)];
  if (numbers.some(n => n !== null && (typeof n !== "number" || !Number.isFinite(n)))) throw new Error("Invalid measurement");
  return value;
}

export function validReference(item: ReferenceLayer): boolean {
  return !!item && typeof item.layer_id === "string" && typeof item.title === "string" &&
    typeof item.source_id === "string" && ["available", "partial", "unavailable", "not_checked"].includes(item.status) &&
    (item.reference_year === null || typeof item.reference_year === "number") &&
    (item.artifact_url === null || typeof item.artifact_url === "string") &&
    typeof item.synthetic === "boolean" && typeof item.redistribution_allowed === "boolean" &&
    Array.isArray(item.legend) && item.legend.every(entry => entry && typeof entry.label === "string" && ["string", "number"].includes(typeof entry.value)) &&
    Array.isArray(item.limitations) && item.limitations.every(entry => typeof entry === "string");
}
export function validContextSource(item: ContextSource): boolean {
  return !!item && [item.source_id, item.name, item.url, item.role].every(value => typeof value === "string") &&
    ["registered", "discovery_only", "import_ready", "integrated", "blocked"].includes(item.integration_status);
}
export function validEvent(item: EnvironmentalEvent): boolean {
  return !!item && [item.event_id, item.source_id, item.observed_at, item.quality_status].every(value => typeof value === "string") &&
    ["station_measurement", "rainfall_window", "bulletin", "reference"].includes(item.kind) &&
    [item.station_id, item.station_name, item.unit, item.observed_start, item.observed_end].every(value => value == null || typeof value === "string") &&
    (item.value == null || typeof item.value === "number" && Number.isFinite(item.value)) && typeof item.synthetic === "boolean";
}

/** Decorative daily groups; the panel retains all individual observations. */
export function environmentalMarkers(events: EnvironmentalEvent[], start: string, end: string) {
  const from = Date.parse(start), until = Date.parse(end);
  const groups = new Map<string, {kind: EnvironmentalEvent["kind"]; start: number; end: number; count: number}>();
  if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until) return [];
  for (const event of events) {
    const at = Date.parse(event.observed_at);
    if (!Number.isFinite(at) || at < from || at > until) continue;
    const key = `${event.kind}:${new Date(at).toISOString().slice(0,10)}`;
    const begin = event.kind === "rainfall_window" && event.observed_start ? Date.parse(event.observed_start) : at;
    const group = groups.get(key) ?? {kind:event.kind, start:at, end:at, count:0};
    group.start = Math.min(group.start, Number.isFinite(begin) ? Math.max(from, begin) : at);
    group.end = Math.max(group.end, at); group.count += 1;
    groups.set(key, group);
  }
  return [...groups].map(([key,group]) => ({key, kind:group.kind, count:group.count,
    startPercent:100*(group.start-from)/(until-from), endPercent:100*(group.end-from)/(until-from)}));
}

export interface RainfallComparisonView {
  hasDailyData: boolean;
  beforeDateLabel: string | null;
  afterDateLabel: string | null;
  windows: Array<{
    key: "1d" | "2d" | "3d";
    beforeMm: number | null;
    afterMm: number | null;
  }>;
  peakAfterDay: { dateLabel: string; meanMm: number; maxMm: number | null } | null;
}

export function extractDailyRainfallComparison(report: EnvironmentalContextReport): RainfallComparisonView {
  const before = report.rainfall.daily_summaries?.before;
  const after = report.rainfall.daily_summaries?.after;
  const keys: Array<"1d" | "2d" | "3d"> = ["1d", "2d", "3d"];
  const windows = keys.map((key) => ({
    key,
    beforeMm: typeof before?.totals_mm?.[key] === "number" && Number.isFinite(before.totals_mm[key]) ? before.totals_mm[key] : null,
    afterMm: typeof after?.totals_mm?.[key] === "number" && Number.isFinite(after.totals_mm[key]) ? after.totals_mm[key] : null,
  }));
  const hasDailyData = windows.some((w) => w.beforeMm !== null || w.afterMm !== null);

  let peakAfterDay: RainfallComparisonView["peakAfterDay"] = null;
  if (Array.isArray(after?.days)) {
    for (const day of after.days) {
      if (typeof day?.mean_mm === "number" && Number.isFinite(day.mean_mm)) {
        if (!peakAfterDay || day.mean_mm > peakAfterDay.meanMm) {
          peakAfterDay = {
            dateLabel: day.date_label_utc,
            meanMm: day.mean_mm,
            maxMm: typeof day.max_mm === "number" && Number.isFinite(day.max_mm) ? day.max_mm : null,
          };
        }
      }
    }
  } else if (typeof after?.totals_mm?.["1d"] === "number" && typeof after?.totals_mm?.["2d"] === "number") {
    const d1 = after.totals_mm["1d"];
    const d2 = Math.max(0, after.totals_mm["2d"] - d1);
    const d3 =
      typeof after.totals_mm["3d"] === "number" ? Math.max(0, after.totals_mm["3d"] - after.totals_mm["2d"]) : 0;
    const endMs = Date.parse(after.end_label_exclusive);
    const labelOffset = (daysBack: number) =>
      Number.isFinite(endMs) ? new Date(endMs - daysBack * 86400000).toISOString().slice(0, 10) : "";
    const candidates = [
      { dateLabel: labelOffset(1), meanMm: d1 },
      { dateLabel: labelOffset(2), meanMm: d2 },
      { dateLabel: labelOffset(3), meanMm: d3 },
    ];
    for (const c of candidates) {
      if (c.meanMm > 0 && (!peakAfterDay || c.meanMm > peakAfterDay.meanMm)) {
        peakAfterDay = { dateLabel: c.dateLabel, meanMm: c.meanMm, maxMm: null };
      }
    }
  }

  return {
    hasDailyData,
    beforeDateLabel: before?.end_label_exclusive ? before.end_label_exclusive.slice(0, 10) : null,
    afterDateLabel: after?.end_label_exclusive ? after.end_label_exclusive.slice(0, 10) : null,
    windows,
    peakAfterDay,
  };
}

export interface CandidateCrossingsView {
  candidateTotalAreaKm2: number | null;
  municipalitiesInCandidates: Array<{
    name: string;
    areaKm2: number;
    sharePercent: number | null;
  }>;
  municipalitiesInAoi: Array<{
    name: string;
    areaKm2: number;
  }>;
  candidateElevationM: number | null;
  aoiElevationM: number | null;
  candidateSlopeDeg: number | null;
  candidateWaterFrequencyPercent: number | null;
  aoiWaterFrequencyPercent: number | null;
  rarelyWetSharePercent: number | null;
  candidateLandCover: Array<{
    classId: string;
    label: string;
    percent: number;
  }>;
}

export function extractCandidateCrossings(report: EnvironmentalContextReport): CandidateCrossingsView {
  const spatial = report.provenance?.spatial_summaries;
  const candidate = report.provenance?.candidate_summaries;

  const muniArea = (m: { intersection_km2?: number; intersection_area_km2?: number } | null | undefined) => {
    if (!m) return null;
    if (typeof m.intersection_km2 === "number" && Number.isFinite(m.intersection_km2)) return m.intersection_km2;
    if (typeof m.intersection_area_km2 === "number" && Number.isFinite(m.intersection_area_km2)) return m.intersection_area_km2;
    return null;
  };

  const rawCandMunis = Array.isArray(candidate?.ibge?.municipalities_intersecting_candidate)
    ? candidate.ibge.municipalities_intersecting_candidate
    : [];

  const parsedCandMunis = rawCandMunis
    .map((m) => ({ name: m?.name, areaKm2: muniArea(m) }))
    .filter((m): m is { name: string; areaKm2: number } => typeof m.name === "string" && typeof m.areaKm2 === "number" && m.areaKm2 > 0)
    .sort((a, b) => b.areaKm2 - a.areaKm2);

  const sumCandArea = parsedCandMunis.reduce((acc, item) => acc + item.areaKm2, 0);
  const candidateTotalAreaKm2 =
    typeof candidate?.ibge?.candidate_union_area_km2 === "number" && Number.isFinite(candidate.ibge.candidate_union_area_km2)
      ? candidate.ibge.candidate_union_area_km2
      : sumCandArea > 0
        ? sumCandArea
        : null;

  const municipalitiesInCandidates = parsedCandMunis.map((m) => ({
    name: m.name,
    areaKm2: m.areaKm2,
    sharePercent:
      candidateTotalAreaKm2 && candidateTotalAreaKm2 > 0
        ? Math.min(100, Math.max(0, (m.areaKm2 / candidateTotalAreaKm2) * 100))
        : null,
  }));

  const rawAoiMunis = Array.isArray(spatial?.ibge?.municipalities_intersecting_aoi)
    ? spatial.ibge.municipalities_intersecting_aoi
    : Array.isArray(spatial?.ibge?.municipalities_intersecting_candidate)
      ? spatial.ibge.municipalities_intersecting_candidate
      : [];

  const municipalitiesInAoi = rawAoiMunis
    .map((m) => ({ name: m?.name, areaKm2: muniArea(m) }))
    .filter((m): m is { name: string; areaKm2: number } => typeof m.name === "string" && typeof m.areaKm2 === "number" && m.areaKm2 > 0)
    .sort((a, b) => b.areaKm2 - a.areaKm2);

  const candidateElevationM =
    typeof candidate?.["copernicus-dem"]?.elevation_m === "number" && Number.isFinite(candidate["copernicus-dem"].elevation_m)
      ? candidate["copernicus-dem"].elevation_m
      : null;

  const aoiElevationM =
    typeof report.topography.elevation_m === "number" && Number.isFinite(report.topography.elevation_m)
      ? report.topography.elevation_m
      : typeof spatial?.["copernicus-dem"]?.elevation_m === "number"
        ? spatial["copernicus-dem"].elevation_m
        : null;

  const candidateSlopeDeg =
    typeof candidate?.["copernicus-dem"]?.slope_deg === "number" && Number.isFinite(candidate["copernicus-dem"].slope_deg)
      ? candidate["copernicus-dem"].slope_deg
      : null;

  const candFreq = candidate?.["jrc-gsw"]?.mean_frequency;
  const aoiFreq =
    typeof report.historical_water.mean_frequency === "number"
      ? report.historical_water.mean_frequency
      : spatial?.["jrc-gsw"]?.mean_frequency;

  const candidateWaterFrequencyPercent =
    typeof candFreq === "number" && Number.isFinite(candFreq) ? candFreq * 100 : null;
  const aoiWaterFrequencyPercent =
    typeof aoiFreq === "number" && Number.isFinite(aoiFreq) ? aoiFreq * 100 : null;
  const rarelyWetSharePercent =
    candidateWaterFrequencyPercent !== null ? Math.max(0, 100 - candidateWaterFrequencyPercent) : null;

  const rawCandClasses = Array.isArray(candidate?.worldcover?.classes) ? candidate.worldcover.classes : [];
  const candidateLandCover = rawCandClasses
    .filter((c): c is { class_id: string; label: string; percent: number } =>
      !!c && typeof c.class_id === "string" && typeof c.percent === "number" && Number.isFinite(c.percent) && c.percent > 0
    )
    .sort((a, b) => b.percent - a.percent)
    .map((c) => ({
      classId: c.class_id,
      label: c.label,
      percent: c.percent,
    }));

  return {
    candidateTotalAreaKm2,
    municipalitiesInCandidates,
    municipalitiesInAoi,
    candidateElevationM,
    aoiElevationM,
    candidateSlopeDeg,
    candidateWaterFrequencyPercent,
    aoiWaterFrequencyPercent,
    rarelyWetSharePercent,
    candidateLandCover,
  };
}
