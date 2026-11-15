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
  if (![value.rainfall.product, value.rainfall.run, value.historical_water.collection].every(text) ||
      ![value.historical_water.reference_year, value.land_cover.reference_year].every(number) ||
      value.sources.some(source => ![source.source_id, source.name, source.url, source.product, source.dataset_version, source.license_id, source.observed_start, source.observed_end].every(text) || !number(source.reference_year) || !number(source.resolution_m)) ||
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
