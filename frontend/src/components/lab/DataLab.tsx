"use client";

import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { BASEMAP_STYLE } from "@/components/map/camera";
import type {
  ApiAnalysisStatistics,
  ApiLayer,
  ApiOverview,
  ApiStory,
  ApiTimeline,
  ApiTimelineComparison,
  Lang,
} from "@/data/api-types";
import { CHANGE_CANDIDATES_ARTIFACT } from "@/data/api-types";
import {
  artifactUrl,
  dataSourceMode,
  GENERAL_CHANGE_ARTIFACT,
  getAnalysisLayers,
  getAnalysisStatistics,
  getAnalysisStory,
  getAreaOverview,
  getAreaTimeline,
  getArtifactJson,
} from "@/data/source";

setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const AREA_ID = "vale-do-taquari";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
type Collection = { type: "FeatureCollection"; features: unknown[] };

// Small cache so going back to a comparison does not download it again.
const cache = new Map<string, Collection>();
const CACHE_LIMIT = 4;
function remember(key: string, value: Collection) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
}

async function loadCollection(analysisId: string, name: string, signal: AbortSignal) {
  const key = `${analysisId}/${name}`;
  const hit = cache.get(key);
  if (hit) return { data: hit, ms: 0, bytes: null as number | null, cached: true };
  const started = performance.now();
  const data = await getArtifactJson<Collection>(analysisId, name, signal);
  const ms = Math.round(performance.now() - started);
  const url = new URL(artifactUrl(analysisId, name), window.location.href).href;
  const entry = performance.getEntriesByName(url).pop() as PerformanceResourceTiming | undefined;
  remember(key, data);
  return { data, ms, bytes: entry?.encodedBodySize || entry?.decodedBodySize || null, cached: false };
}

const fmt = (lang: Lang, value: number | null | undefined, digits = 2) =>
  value == null
    ? lang === "pt"
      ? "indisponível"
      : "unavailable"
    : new Intl.NumberFormat(lang === "pt" ? "pt-BR" : "en-US", {
        maximumFractionDigits: digits,
      }).format(value);

const day = (lang: Lang, iso: string) =>
  new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

function boundsOf(coords: number[][]): LngLatBoundsLike {
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

interface Loaded {
  comparison: ApiTimelineComparison;
  stats: ApiAnalysisStatistics;
  story: ApiStory;
  layers: ApiLayer[];
  general: { features: number; ms: number; bytes: number | null; cached: boolean };
  water: { features: number; ms: number; bytes: number | null; cached: boolean };
  drawMs: number | null;
}

export function DataLab({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [overview, setOverview] = useState<ApiOverview | null>(null);
  const [timeline, setTimeline] = useState<ApiTimeline | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState({ increase: true, decrease: true, water: true, aoi: true });
  const [opacity, setOpacity] = useState(0.7);
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  // Region data: overview and timeline, in the chosen language.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getAreaOverview(AREA_ID, lang, controller.signal),
      getAreaTimeline(AREA_ID, lang, controller.signal),
    ])
      .then(([o, t]) => {
        setOverview(o);
        setTimeline(t);
        setError(null);
        setSelected((current) => current ?? t.comparisons[0]?.comparison_id ?? null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(String(cause?.message ?? cause));
      });
    return () => controller.abort();
  }, [lang]);

  // The map.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [-51.961, -29.467],
      zoom: 11.3,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("aoi", { type: "geojson", data: EMPTY });
      map.addSource("general", { type: "geojson", data: EMPTY });
      map.addSource("water", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "aoi-line",
        type: "line",
        source: "aoi",
        paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [2, 2] },
      });
      for (const [id, cls, color] of [
        ["increase", "radar_increase", "#D55E00"],
        ["decrease", "radar_decrease", "#0072B2"],
      ] as const) {
        map.addLayer({
          id: `${id}-fill`,
          type: "fill",
          source: "general",
          filter: ["==", ["get", "class"], cls],
          paint: { "fill-color": color, "fill-opacity": 0.7 },
        });
      }
      map.addLayer({
        id: "water-fill",
        type: "fill",
        source: "water",
        paint: { "fill-color": "#56B4E9", "fill-opacity": 0.85 },
      });
      map.addLayer({
        id: "water-line",
        type: "line",
        source: "water",
        paint: { "line-color": "#ffffff", "line-width": 1.2 },
      });
      setMapReady(true);
    });
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __labMap?: MapLibreMap }).__labMap = map;
    }
    return () => map.remove();
  }, []);

  // Area of interest outline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !overview) return;
    (map.getSource("aoi") as GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: overview.area.geometry,
    } as GeoJSON.Feature);
    const ring = (overview.area.geometry as unknown as { coordinates: number[][][] }).coordinates[0];
    map.fitBounds(boundsOf(ring), { padding: 30, duration: 0 });
  }, [mapReady, overview]);

  // One comparison: numbers, story, layers and shapes, all together.
  useEffect(() => {
    const map = mapRef.current;
    const comparison = timeline?.comparisons.find((c) => c.comparison_id === selected);
    if (!map || !mapReady || !comparison) return;
    const analysisId = comparison.analysis_ids[0];
    const controller = new AbortController();
    const { signal } = controller;
    queueMicrotask(() => {
      if (!signal.aborted) setBusy(true);
    });
    (async () => {
      try {
        const [stats, story, layerList, general, water] = await Promise.all([
          getAnalysisStatistics(analysisId, signal),
          getAnalysisStory(analysisId, lang, signal),
          getAnalysisLayers(analysisId, signal),
          loadCollection(analysisId, GENERAL_CHANGE_ARTIFACT, signal),
          loadCollection(analysisId, CHANGE_CANDIDATES_ARTIFACT, signal),
        ]);
        if (signal.aborted) return;
        const started = performance.now();
        (map.getSource("general") as GeoJSONSource).setData(general.data as GeoJSON.FeatureCollection);
        (map.getSource("water") as GeoJSONSource).setData(water.data as GeoJSON.FeatureCollection);
        const base: Loaded = {
          comparison,
          stats,
          story,
          layers: layerList.items,
          general: { ...general, features: general.data.features.length },
          water: { ...water, features: water.data.features.length },
          drawMs: null,
        };
        setLoaded(base);
        setError(null);
        setBusy(false);
        map.once("idle", () => {
          if (!signal.aborted)
            setLoaded({ ...base, drawMs: Math.round(performance.now() - started) });
        });
      } catch (cause) {
        if (signal.aborted) return;
        setError(String((cause as Error)?.message ?? cause));
        setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [mapReady, timeline, selected, lang]);

  // Layer switches and opacity.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    map.setLayoutProperty("increase-fill", "visibility", vis(show.increase));
    map.setLayoutProperty("decrease-fill", "visibility", vis(show.decrease));
    map.setLayoutProperty("water-fill", "visibility", vis(show.water));
    map.setLayoutProperty("water-line", "visibility", vis(show.water));
    map.setLayoutProperty("aoi-line", "visibility", vis(show.aoi));
    map.setPaintProperty("increase-fill", "fill-opacity", opacity);
    map.setPaintProperty("decrease-fill", "fill-opacity", opacity);
  }, [mapReady, show, opacity]);

  const kb = (b: number | null) =>
    b == null ? "—" : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} kB`;
  const g = loaded?.stats.general_change?.statistics;
  const w = loaded?.stats.open_water?.statistics;
  const groups = timeline?.groups ?? [];

  return (
    <div className="grid h-[calc(100svh-4.75rem)] grid-cols-1 lg:grid-cols-[22rem_1fr_26rem]">
      <aside className="overflow-y-auto border-r border-line bg-bg-raised p-4 text-sm">
        <p className="rounded-lg border border-highlight px-3 py-2 font-bold text-highlight">
          Laboratório de dados · só desenvolvimento · modo {dataSourceMode}
        </p>
        <div className="mt-3 flex gap-2">
          {(["pt", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`tool-button ${lang === l ? "border-brand text-brand-text" : ""}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {overview && (
          <p className="mt-3 text-ink-soft">
            {overview.comparison_count} comparações · {overview.group_count} grupos ·{" "}
            {overview.data_status} · {overview.availability}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.group_id} className="mt-4">
            <h2 className="font-bold">
              {group.metadata.direction} · trilha {group.metadata.track} · quadro{" "}
              {group.metadata.frame}
            </h2>
            <ul className="mt-1 flex flex-col gap-1">
              {timeline?.comparisons
                .filter((c) => c.group_id === group.group_id)
                .map((c) => (
                  <li key={c.comparison_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.comparison_id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        selected === c.comparison_id
                          ? "border-brand bg-brand-soft"
                          : "border-line bg-surface"
                      }`}
                    >
                      {day(lang, c.before_time)} → {day(lang, c.after_time)}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {error && <p className="mt-4 text-highlight">Erro: {error}</p>}
      </aside>

      <div className="relative h-full min-h-[24rem]">
        <div ref={containerRef} className="h-full min-h-[24rem] w-full" />
        <div className="glass absolute left-3 top-3 flex flex-col gap-1 rounded-xl p-3 text-sm">
          {(
            [
              ["increase", "Aumento do sinal", "#D55E00"],
              ["decrease", "Diminuição do sinal", "#0072B2"],
              ["water", "Possível água aberta", "#56B4E9"],
              ["aoi", "Área de interesse", "#ffffff"],
            ] as const
          ).map(([key, label, color]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={show[key]}
                onChange={(e) => setShow((s) => ({ ...s, [key]: e.target.checked }))}
              />
              <span className="inline-block size-3 rounded-sm" style={{ background: color }} />
              {label}
            </label>
          ))}
          <label className="mt-1 flex items-center gap-2">
            Opacidade
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
          {busy && <span className="text-highlight">carregando…</span>}
        </div>
      </div>

      <aside className="overflow-y-auto border-l border-line bg-bg-raised p-4 text-sm">
        {loaded ? (
          <>
            <h2 className="text-lg font-bold">
              {day(lang, loaded.comparison.before_time)} → {day(lang, loaded.comparison.after_time)}{" "}
              · {loaded.comparison.direction}
            </h2>
            <p className="text-ink-soft">
              {loaded.story.data_status} · {loaded.story.validation_status} ·{" "}
              {loaded.story.general_state} · {loaded.story.water_state}
            </p>
            <h3 className="mt-3 font-bold">Números (km²)</h3>
            <dl className="grid grid-cols-2 gap-x-3">
              <dt>Área válida</dt>
              <dd>{fmt(lang, g?.valid_area_km2)}</dd>
              <dt>Aumento</dt>
              <dd>
                {fmt(lang, g?.increase_area_km2)} ({fmt(lang, g?.increase_components, 0)} grupos)
              </dd>
              <dt>Diminuição</dt>
              <dd>
                {fmt(lang, g?.decrease_area_km2)} ({fmt(lang, g?.decrease_components, 0)} grupos)
              </dd>
              <dt>Mudança total</dt>
              <dd>{fmt(lang, g?.changed_area_km2)}</dd>
              <dt>Descartado (pequeno)</dt>
              <dd>{fmt(lang, g?.discarded_area_km2)}</dd>
              <dt>Possível água</dt>
              <dd>
                {fmt(lang, w?.candidate_area_km2, 3)} ({fmt(lang, w?.candidate_components, 0)} grupos)
              </dd>
            </dl>
            <h3 className="mt-3 font-bold">Peso e tempo</h3>
            <p>
              Mudanças gerais: {kb(loaded.general.bytes)} · {loaded.general.features} polígonos ·{" "}
              {loaded.general.cached ? "cache" : `${loaded.general.ms} ms`}
            </p>
            <p>
              Possível água: {kb(loaded.water.bytes)} · {loaded.water.features} polígonos ·{" "}
              {loaded.water.cached ? "cache" : `${loaded.water.ms} ms`}
            </p>
            <p>Desenho no mapa: {loaded.drawMs == null ? "…" : `${loaded.drawMs} ms`}</p>
            <h3 className="mt-3 font-bold">Camadas (do backend)</h3>
            <ul>
              {loaded.layers.map((layer) => (
                <li key={layer.layer_id}>
                  {layer.name[lang]} — {layer.status}
                  {layer.available ? "" : " (sem dados)"}
                </li>
              ))}
            </ul>
            <h3 className="mt-3 font-bold">{loaded.story.title}</h3>
            <p>{loaded.story.summary}</p>
            <p className="mt-2">{loaded.story.observation}</p>
            <p className="mt-2">{loaded.story.result}</p>
            <p className="mt-2">{loaded.story.interpretation}</p>
            {loaded.story.water_interpretation && (
              <p className="mt-2">{loaded.story.water_interpretation}</p>
            )}
            <h4 className="mt-2 font-bold">Outras explicações</h4>
            <ul className="list-disc pl-5">
              {loaded.story.alternative_explanations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className="mt-2 font-bold">Limitações</h4>
            <ul className="list-disc pl-5">
              {loaded.story.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>{busy ? "carregando…" : "Escolha uma comparação."}</p>
        )}
      </aside>
    </div>
  );
}
