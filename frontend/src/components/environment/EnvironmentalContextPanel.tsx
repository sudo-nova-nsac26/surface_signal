"use client";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { TimelineStep } from "@/data/region";
import type { ContextAvailability, ReferenceLayer } from "@/data/api-types";
import { environmentalNumber, environmentalTime, filterEnvironmentalEvents, safeSourceUrl } from "@/data/environmental";
import type { EnvironmentalState } from "./useEnvironmental";

type Labels = Dictionary["environment"];
export function EnvironmentalContextPanel({state, step, lang, labels: l, selectedLayer, onLayer, layerError}: {
  state: EnvironmentalState; step: TimelineStep | null; lang: Locale; labels: Labels;
  selectedLayer: string | null; onLayer: (layer: ReferenceLayer | null) => void; layerError: boolean;
}) {
  const n = (value: number | null | undefined) => environmentalNumber(value, lang) ?? l.missing;
  const date = (value: string) => environmentalTime(value, lang) ?? l.missing;
  const report = state.report?.status === "ready" ? state.report.value : null;
  const region = state.region?.status === "ready" ? state.region.value : null;
  const events = region && step ? filterEnvironmentalEvents(region.events, step.beforeAt, step.afterAt) : [];
  const block = (title: string, status: ContextAvailability, children: ReactNode) => <section className="space-y-2 border-t border-line pt-3">
    <h4 className="font-bold">{title}</h4><p className="text-sm text-ink-soft">{l.status[status]}</p>{children}
  </section>;
  return <details className="mt-4 border-t border-line pt-2">
    <summary className="min-h-12 cursor-pointer py-3 text-lg font-bold text-brand-text">{l.title}</summary>
    <div className="space-y-4 pb-2 text-base">
      <section className="space-y-2">
        <h3 className="font-bold">{l.satellite}</h3>
        {step && <p>{l.between} {date(step.beforeAt)} — {date(step.afterAt)}. {l.timezone}.</p>}
        {step?.analysis?.illustrative && <p className="font-bold text-highlight">{l.illustrative}</p>}
        <p>{step?.analysis ? l.observation : l.noAnalysis}</p>
        {step?.analysis && <p>{l.candidateArea}: {n(step.analysis.candidateAreaKm2)} km². {l.validArea}: {n(step.analysis.validAreaKm2)} km².</p>}
        <a href="#how" className="inline-flex min-h-12 items-center text-brand-text underline">{l.methodology}</a>
      </section>
      <div role="status" aria-live="polite">
        {state.report?.status === "loading" && <p>{l.loading}</p>}
        {state.report?.status === "missing" && <p>{l.notPrepared}</p>}
        {(state.report?.status === "error" || state.region?.status === "error") && <div><p>{l.error}</p><button type="button" onClick={state.retry} className="mt-2 min-h-12 rounded-xl border-2 border-line px-4 font-bold hover:border-brand">{l.retry}</button></div>}
      </div>
      {report && <>
        <h3 className="text-lg font-bold">{l.environment}</h3>
        <p className="text-sm">{l.spatialScope}</p>
        <p>{date(report.observed_at)} · {l.timezone}</p>
        {report.synthetic && <p className="font-bold text-highlight">{l.illustrative}</p>}
        {block(l.rainfall, report.rainfall.status, <>
          {Object.entries(report.rainfall.windows_mm).map(([window, value]) => <p key={window}>{l.rainfallWindow} {window}: <strong>{value === null ? l.noRain : `${n(value)} mm`}</strong></p>)}
          <p className="text-sm text-ink-soft">{l.source}: NASA GPM IMERG · {report.rainfall.product ?? l.missing} {report.rainfall.run ?? ""}</p>
          {report.rainfall.resolution_km_approx !== null && <p>{l.resolution}: {n(report.rainfall.resolution_km_approx)} km</p>}
          {report.rainfall.coverage_fraction !== null && <p>{l.coverage}: {n(report.rainfall.coverage_fraction * 100)}%</p>}
        </>)}
        {block(l.river, report.hydrology.status, <>
          {report.hydrology.records.length === 0 && <p>{l.noRiver}</p>}
          <ul className="space-y-3">{report.hydrology.records.map((record, index) => <li key={`${record.station_id}-${record.observed_at}-${index}`}>
            <p className="font-bold">{record.station_name} · {record.parameter === "rainfall" ? l.rainfallParameter : l[record.parameter]}</p>
            <p>{record.value === null ? l.noRiver : `${n(record.value)} ${record.unit}`} · {date(record.observed_at)}</p>
            <p className="text-sm">{record.datum ? `${l.datum}: ${record.datum}` : l.datumMissing}</p>
            {record.time_offset_hours != null && <p className="text-sm">{l.offset}: {n(record.time_offset_hours)}</p>}
            <p className="text-sm">{l.source}: {record.source_id} · {l.quality}: {record.quality_status}</p>
            {record.synthetic && <p className="font-bold text-highlight">{l.illustrative}</p>}
          </li>)}</ul>
        </>)}
        {block(l.historical, report.historical_water.status, <>
          <p>{l.referenceYear}: {report.historical_water.reference_year ?? l.missing}</p>
          <p>{l.overlap}: {report.historical_water.overlap_km2 === null ? l.missing : `${n(report.historical_water.overlap_km2)} km²`}</p>
          {report.historical_water.overlap_fraction !== null && <p>{n(report.historical_water.overlap_fraction * 100)}%</p>}
          <p className="text-sm">{report.historical_water.collection}. {l.historicNote}</p>
        </>)}
        {block(l.land, report.land_cover.status, <>
          <p>{l.referenceYear}: {report.land_cover.reference_year ?? l.missing}</p>
          <ul>{report.land_cover.classes.map(item => <li key={item.class_id}>{l.classes[item.class_id as keyof Labels["classes"]] ?? item.label}: {item.percent === null ? l.missing : `${n(item.percent)}%`}</li>)}</ul>
          <p className="text-sm">ESA WorldCover. {l.historicNote}</p>
        </>)}
        {block(l.terrain, report.topography.status, <>
          <p>{l.elevation}: {report.topography.elevation_m === null ? l.missing : `${n(report.topography.elevation_m)} m`}</p>
          <p>{l.slope}: {report.topography.slope_deg === null ? l.missing : `${n(report.topography.slope_deg)}°`}</p>
          <p className="text-sm">{l.terrainNote}</p>
        </>)}
        <p>{l.uncertain}</p>
        <details className="border-t border-line pt-2"><summary className="min-h-12 cursor-pointer py-3 font-bold">{l.details}</summary>
          <p>{report.validation.status === "validated_against_reference" && report.validation.metrics ? l.metrics : l.notValidated}</p>
          {report.validation.status === "validated_against_reference" && report.validation.metrics && <dl>{Object.entries(report.validation.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{n(value)}</dd></div>)}</dl>}
          <h4 className="mt-4 font-bold">{l.usedSources}</h4>
          <ul className="space-y-3">{report.sources.map((source, index) => <li key={`${source.source_id}-${index}`}>
            {safeSourceUrl(source.url) ? <a href={safeSourceUrl(source.url)!} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center text-brand-text underline">{l.source}: {source.name}</a> : <p>{l.source}: {source.name}</p>}
            <p>{l.product}: {source.product ?? l.missing} {source.dataset_version ?? ""} · {source.license_id ?? ""}</p>
            {source.observed_start && <p>{date(source.observed_start)} — {source.observed_end ? date(source.observed_end) : l.missing}</p>}
            {source.reference_year && <p>{l.referenceYear}: {source.reference_year}</p>}
            {source.resolution_m != null && <p>{l.resolution}: {n(source.resolution_m)} m</p>}
            {source.synthetic && <p className="font-bold text-highlight">{l.illustrative}</p>}
            <ul>{source.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </li>)}</ul>
          <ul className="mt-3 space-y-2">{[...report.limitations, ...report.rainfall.limitations, ...report.hydrology.limitations, ...report.historical_water.limitations, ...report.land_cover.limitations, ...report.topography.limitations, ...report.validation.limitations].map((item, i) => <li key={i}>{item}</li>)}</ul>
        </details>
      </>}
      {region && <section className="space-y-3 border-t border-line pt-3">
        <h3 className="font-bold">{l.references}</h3><p className="text-sm">{l.referenceNote}</p>
        {region.layers.length === 0 && <p>{l.missing}</p>}
        {region.layers.map(layer => <div key={layer.layer_id}>
          <p className="font-bold">{layer.title}</p><p>{l.status[layer.status]} · {layer.source_id} {layer.reference_year ?? ""}</p>
          {layer.synthetic && <p className="font-bold text-highlight">{l.illustrative}</p>}
          {layer.artifact_url && layer.redistribution_allowed && ["available", "partial"].includes(layer.status) && <label className="flex min-h-12 cursor-pointer items-center gap-3"><input type="checkbox" checked={selectedLayer === layer.layer_id} onChange={e => onLayer(e.target.checked ? layer : null)} className="size-6" />{l.show}</label>}
          {selectedLayer === layer.layer_id && <ul>{layer.legend.map((item, i) => <li key={i}>{item.label} ({item.value})</li>)}</ul>}
        </div>)}
        {layerError && <p role="status">{l.error}</p>}
      </section>}
      <details className="border-t border-line pt-2"><summary className="min-h-12 cursor-pointer py-3 font-bold">{l.events} ({events.length})</summary>
        <p className="text-sm">{l.timezone}</p>
        {events.length === 0 && <p>{l.noEvents}</p>}
        <ul className="max-h-64 space-y-3 overflow-y-auto">{events.map(event => <li key={event.event_id}>
          <p className="font-bold">{l[event.kind]} · {event.station_name ?? event.source_id}</p>
          <p>{date(event.observed_at)}{event.value != null ? ` · ${n(event.value)} ${event.unit ?? ""}` : ` · ${l.missing}`}</p>
          {event.observed_start && event.observed_end && <p>{date(event.observed_start)} — {date(event.observed_end)}</p>}
          <p className="text-sm">{l.source}: {event.source_id} · {l.quality}: {event.quality_status}</p>
          {event.synthetic && <p className="font-bold text-highlight">{l.illustrative}</p>}
        </li>)}</ul>
      </details>
    </div>
  </details>;
}
