"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CHANGE_CANDIDATES_ARTIFACT, type ApiArea } from "@/data/api-types";
import { STORY_AREA_ID } from "@/data/area-labels";
import { FEATURED_START } from "@/data/featured";
import {
  boundsOf,
  loadComparisonDetail,
  loadStoryTimeline,
  type ComparisonDetail,
  type LngLat,
  type TimelineView,
} from "@/data/region";
import { artifactUrl, GENERAL_CHANGE_ARTIFACT, listAreas } from "@/data/source";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useMotionLevel, usePreferences } from "@/preferences/store";
import { ArrowRightIcon } from "../icons";
import { GlobeLoader } from "../GlobeLoader";
import { SpeakButton } from "../ui/SpeakButton";
import {
  assessGraphics,
  measureFps,
  SMOOTH_FPS,
  type GraphicsTier,
} from "./hardware";
import type { ViewMode } from "./camera";
import { NO_CHANGES, type ChangeLayers, type MapHotspotPin, type MapMarker, type MapViewHandle } from "./MapView";
import {
  buildHotspotsGeoJson,
  computeHotspotLiveStats,
  VALLEY_HOTSPOTS,
} from "./hotspots";
import { HotspotPopup } from "./HotspotPopup";
import { MapTour, useAutoValleyTour } from "./MapTour";
import {
  buildPlaces,
  childrenOf,
  pathTo,
  upcomingOf,
  type PlaceId,
} from "./places";
import { ComparePanel } from "./ComparePanel";
import { InfoAccordion, type InfoTab } from "./ComparisonInfo";
import { Timeline } from "./Timeline";
import { EnvironmentalContextPanel } from "../environment/EnvironmentalContextPanel";
import { useEnvironmental } from "../environment/useEnvironmental";
import { environmentalNumber } from "@/data/environmental";
import { getReferenceGeoJson } from "@/data/source";
import type { ReferenceLayer } from "@/data/api-types";
import type { FeatureCollection } from "geojson";

// The map library is large, so it is kept out of the first download and
// never runs on the server.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

type MapStatus = "loading" | "ready" | "error";
type Labels = Dictionary["map"];

const FALLBACK_VALLEY: LngLat = [-51.961, -29.467];

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="glass flex size-11 items-center justify-center rounded-xl text-xl font-bold leading-none hover:border-brand"
    >
      {children}
    </button>
  );
}

/**
 * The centrepiece of the site: a map that fills the screen. It opens behind
 * an introduction; "Start" clears the screen and leaves only the map with a
 * few quiet controls around its edges.
 */
export function MapStage({
  lang,
  labels,
  hero,
  environment,
}: {
  lang: Locale;
  labels: Labels;
  hero: Dictionary["hero"];
  environment: Dictionary["environment"];
}) {
  // intro: a turning globe behind the introduction. leaving: the introduction
  // fades while the camera pulls back. map: only the map and its controls.
  const [phase, setPhase] = useState<"intro" | "leaving" | "map">("intro");
  const [placeId, setPlaceId] = useState<PlaceId>("world");
  const [view, setView] = useState<ViewMode>("2d");
  const [area, setArea] = useState<ApiArea | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  // How well this device draws: decides the starting view, never forced.
  const [tier, setTier] = useState<GraphicsTier | null>(null);
  const viewChosen = useRef(false);
  const [timeline, setTimeline] = useState<TimelineView | null>(null);
  const [timelineStatus, setTimelineStatus] = useState<"loading" | "error" | "ready">("loading");
  const [timelineTry, setTimelineTry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The chosen comparison: numbers, layers and explanation, loaded together.
  const [detail, setDetail] = useState<{ id: string; data: ComparisonDetail } | null>(null);
  const [detailStatus, setDetailStatus] = useState<"loading" | "error" | "ready">("loading");
  const [detailTry, setDetailTry] = useState(0);
  // Layer switches and "show the changes" (URLs are added from the data).
  const [switches, setSwitches] = useState<ChangeLayers>({
    ...NO_CHANGES,
    increase: true,
    decrease: true,
    water: true,
    opacity: 1,
  });
  const mapHandle = useRef<MapViewHandle>(null);
  // Tells the header (outside this component) when the map has the stage.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.stage = phase === "map" ? "map" : "intro";
    return () => {
      delete root.dataset.stage;
    };
  }, [phase]);
  // True while the camera runs a transition: navigation waits until it ends.
  const [busy, setBusy] = useState(false);
  // Which extra information is open above the time bar, if any.
  const [infoTab, setInfoTab] = useState<InfoTab | null>(null);
  const [satelliteImagery, setSatelliteImagery] = useState(false);
  const [restoredFromLangSwitch, setRestoredFromLangSwitch] = useState(false);
  const motion = useMotionLevel();
  const prefs = usePreferences();

  const places = useMemo(() => {
    let valley = FALLBACK_VALLEY;
    if (area) {
      const [[west, south], [east, north]] = boundsOf(area);
      valley = [(west + east) / 2, (south + north) / 2];
    }
    return buildPlaces(valley);
  }, [area]);

  const current = places.find((place) => place.id === placeId) ?? places[0];
  const path = pathTo(places, current.id);
  const next = childrenOf(places, current.id);
  const markers = useMemo<MapMarker[]>(
    () => [
      ...upcomingOf(current.id).map((place) => ({
        id: place.id,
        name: place.name[lang],
        point: place.point,
        available: false,
      })),
      ...childrenOf(places, current.id).map((place) => ({
        id: place.id,
        name: labels.places[place.id].name,
        point: place.point,
        available: true,
      })),
    ],
    [places, current.id, labels, lang],
  );
  const closeUp = Boolean(current.detail);
  const free3d = closeUp && view === "3d";

  useEffect(() => {
    const controller = new AbortController();
    listAreas(controller.signal)
      .then((areas) => {
        setArea(
          areas.find((item) => item.area_id === STORY_AREA_ID) ??
          areas[0] ??
          null,
        );
      })
      .catch(() => {
        // The journey still works without the outline of the analysed area.
      });
    return () => controller.abort();
  }, []);

  // The guided story: a few of the comparisons the backend prepared, in the
  // chosen language. It opens on the flood, an explicit guided case.
  useEffect(() => {
    const controller = new AbortController();
    loadStoryTimeline(STORY_AREA_ID, lang, controller.signal)
      .then((data) => {
        setTimeline(data);
        setTimelineStatus("ready");
        setSelectedId(
          (current) =>
            current ??
            data.steps.find((step) => step.reason === FEATURED_START)?.id ??
            data.steps[0]?.id ??
            null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setTimelineStatus("error");
      });
    return () => controller.abort();
  }, [lang, timelineTry]);

  const selectedStep = timeline?.steps.find((step) => step.id === selectedId) ?? null;
  const analysisId = selectedStep?.analysisId ?? null;
  // Environmental context of the chosen comparison (rain, river, land) and an optional
  // reference outline; separate from the satellite layers.
  const environmental = useEnvironmental(
    closeUp ? area?.area_id ?? null : null,
    closeUp ? analysisId : null,
  );
  const [reference, setReference] = useState<ReferenceLayer | null>(null);
  const [referenceData, setReferenceData] = useState<{ id: string; data: FeatureCollection } | null>(null);
  const [referenceError, setReferenceError] = useState(false);
  useEffect(() => {
    if (!reference?.artifact_url || !closeUp) return;
    const controller = new AbortController();
    getReferenceGeoJson(reference.artifact_url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setReferenceData({ id: reference.layer_id, data });
          setReferenceError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setReferenceError(true);
      });
    return () => controller.abort();
  }, [reference, closeUp]);
  const environmentPanel = (
    <EnvironmentalContextPanel
      state={environmental}
      step={selectedStep}
      lang={lang}
      labels={environment}
      selectedLayer={reference?.layer_id ?? null}
      onLayer={(layer) => {
        setReference(layer);
        setReferenceError(false);
      }}
      layerError={referenceError}
    />
  );

  // One request set per choice; a newer choice cancels the older one, so an
  // old answer never shows after quick navigation.
  useEffect(() => {
    if (!analysisId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setDetailStatus("loading");
    });
    loadComparisonDetail(analysisId, lang, controller.signal)
      .then((data) => {
        setDetail({ id: analysisId, data });
        setDetailStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setDetailStatus("error");
      });
    return () => controller.abort();
  }, [analysisId, lang, detailTry]);

  // The map draws only what the backend says is available for this comparison.
  // Keep the last loaded detail in view while the next step is fetching so the
  // right panel and map never collapse or flash during timeline scrubbing.
  const currentDetail = detail?.data ?? null;
  const isDetailLoading =
    detailStatus === "loading" || Boolean(detail && detail.id !== analysisId);
  const changes = useMemo<ChangeLayers>(() => {
    if (!analysisId || !currentDetail) return NO_CHANGES;
    const has = (id: string) =>
      currentDetail.layers.some((layer) => layer.layer_id === id && layer.available);
    return {
      ...switches,
      generalUrl:
        has("radar_increase") || has("radar_decrease")
          ? artifactUrl(analysisId, GENERAL_CHANGE_ARTIFACT)
          : null,
      waterUrl: has("open_water") ? artifactUrl(analysisId, CHANGE_CANDIDATES_ARTIFACT) : null,
    };
  }, [analysisId, currentDetail, switches]);

  // Clickable inspection squares (hotspots) around Lajeado & Estrela.
  const [showHotspots, setShowHotspots] = useState(true);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [hotspotGeoData, setHotspotGeoData] = useState<{
    id: string;
    water: FeatureCollection | null;
    general: FeatureCollection | null;
  } | null>(null);

  useEffect(() => {
    if (!closeUp || !analysisId) return;
    const controller = new AbortController();
    const fetchJson = async (url: string | null): Promise<FeatureCollection | null> => {
      if (!url) return null;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return (await res.json()) as FeatureCollection;
      } catch {
        return null;
      }
    };
    Promise.all([fetchJson(changes.waterUrl), fetchJson(changes.generalUrl)]).then(
      ([water, general]) => {
        if (!controller.signal.aborted) {
          setHotspotGeoData({ id: analysisId, water, general });
        }
      },
    );
    return () => controller.abort();
  }, [closeUp, analysisId, changes.waterUrl, changes.generalUrl]);

  const activeHotspot = useMemo(
    () => (closeUp && showHotspots ? VALLEY_HOTSPOTS.find((h) => h.id === selectedHotspotId) ?? null : null),
    [closeUp, showHotspots, selectedHotspotId],
  );

  const activeHotspotStats = useMemo(() => {
    if (!activeHotspot) return null;
    const match = hotspotGeoData && hotspotGeoData.id === analysisId ? hotspotGeoData : null;
    return computeHotspotLiveStats(activeHotspot, match?.water ?? null, match?.general ?? null);
  }, [activeHotspot, hotspotGeoData, analysisId]);

  const hotspotsGeoJson = useMemo(
    () => (closeUp && showHotspots ? buildHotspotsGeoJson(VALLEY_HOTSPOTS, lang, selectedHotspotId) : null),
    [closeUp, showHotspots, lang, selectedHotspotId],
  );

  const hotspotPins = useMemo<MapHotspotPin[]>(
    () =>
      closeUp && showHotspots
        ? VALLEY_HOTSPOTS.map((h) => ({
          id: h.id,
          code: h.code,
          kind: h.kind,
          title: h.title[lang],
          point: [h.bounds[0], h.bounds[3]] as LngLat,
          selected: h.id === selectedHotspotId,
        }))
        : [],
    [closeUp, showHotspots, lang, selectedHotspotId],
  );

  const { tourOpen, setTourOpen } = useAutoValleyTour(phase === "map" && closeUp && !restoredFromLangSwitch);

  // Restore map state when the user switches language (PT <-> EN) while on the map.
  useEffect(() => {
    try {
      const switched = sessionStorage.getItem("surface_signal_lang_switch");
      if (!switched) return;
      sessionStorage.removeItem("surface_signal_lang_switch");
      const raw = sessionStorage.getItem("surface_signal_map_state");
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        phase?: "intro" | "leaving" | "map";
        placeId?: PlaceId;
        view?: ViewMode;
        selectedId?: string | null;
        selectedHotspotId?: string | null;
        satelliteImagery?: boolean;
      };
      if (saved.phase === "map" || saved.phase === "leaving") {
        setRestoredFromLangSwitch(true);
        setPhase("map");
      }
      if (saved.placeId) setPlaceId(saved.placeId);
      if (saved.view === "2d" || saved.view === "3d") {
        viewChosen.current = true;
        setView(saved.view);
      }
      if (saved.selectedId) setSelectedId(saved.selectedId);
      if (saved.selectedHotspotId) setSelectedHotspotId(saved.selectedHotspotId);
      if (typeof saved.satelliteImagery === "boolean") setSatelliteImagery(saved.satelliteImagery);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  // Keep current map state in sessionStorage so LanguageSwitch can preserve it.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "surface_signal_map_state",
        JSON.stringify({
          phase,
          placeId,
          view,
          selectedId,
          selectedHotspotId,
          satelliteImagery,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [phase, placeId, view, selectedId, selectedHotspotId, satelliteImagery]);

  const closeHotspot = () => {
    setSelectedHotspotId(null);
    mapHandle.current?.restoreSavedView();
  };

  const selectHotspot = (id: string) => {
    setTourOpen(false);
    setSelectedHotspotId((prev) => {
      const nextId = prev === id ? null : id;
      if (!nextId) {
        mapHandle.current?.restoreSavedView();
        return null;
      }
      const found = VALLEY_HOTSPOTS.find((h) => h.id === nextId);
      if (found) {
        mapHandle.current?.focusAt(found.center, found.kind === "hillslope" ? 13.9 : 13.7);
      }
      return nextId;
    });
  };

  const envReport = environmental.report?.status === "ready" ? environmental.report.value : null;
  const fmtNum = (v: number | null | undefined) => environmentalNumber(v, lang) ?? "0";

  const go = (id: string) => {
    if (!busy) setPlaceId(id as PlaceId);
  };

  // Look at the device while the introduction is on screen. A device that
  // reports well is then watched for a moment: if the globe would not draw
  // smoothly, the flat map is chosen instead.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const report = assessGraphics();
      if (report.tier === "low") {
        console.info("SurfaceSignal: starting in 2D because of", report.reasons);
        if (!cancelled) setTier("low");
        return;
      }
      const fps = await measureFps(1500);
      if (cancelled) return;
      const smooth = fps === null || fps >= SMOOTH_FPS;
      if (!smooth) {
        console.info("SurfaceSignal: starting in 2D,", Math.round(fps ?? 0), "fps");
      }
      setTier(smooth ? "high" : "low");
    }, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const chooseView = (next: ViewMode) => {
    viewChosen.current = true;
    setView(next);
    if (next === "3d") setSatelliteImagery(false);
  };

  useEffect(() => {
    if (view === "3d" && satelliteImagery) {
      setSatelliteImagery(false);
    }
  }, [view, satelliteImagery]);

  const begin = () => {
    // 3D from the start only when the device is known to be able to.
    if (!viewChosen.current) setView(tier === "high" ? "3d" : "2d");
    setPhase(motion === "none" ? "map" : "leaving");
  };

  useEffect(() => {
    if (phase !== "leaving") return;
    // Long enough for the globe to come forward and the camera to land.
    const timer = window.setTimeout(
      () => setPhase("map"),
      motion === "full" ? 2300 : 900,
    );
    return () => window.clearTimeout(timer);
  }, [phase, motion]);

  return (
    <section
      id="map"
      aria-label={labels.label}
      className="relative h-[calc(100svh-4.75rem)] min-h-[36rem] overflow-hidden bg-bg hc:border-b-2 hc:border-ink"
    >
      {status !== "error" && (
        <MapView
          ref={mapHandle}
          place={current}
          markers={phase === "map" ? markers : []}
          view={view}
          motion={motion}
          intro={phase === "intro"}
          changes={changes}
          reference={
            closeUp && reference && referenceData?.id === reference.layer_id ? referenceData.data : null
          }
          hotspots={phase === "map" ? hotspotsGeoJson : null}
          hotspotPins={phase === "map" ? hotspotPins : []}
          onHotspotSelect={selectHotspot}
          area={area?.geometry ?? null}
          label={labels.label}
          dotHint={labels.dotHint}
          upcomingLabel={labels.upcomingLabel}
          gestureText={{
            desktop: labels.gestureDesktop,
            mac: labels.gestureMac,
            mobile: labels.gestureMobile,
          }}
          onSelect={go}
          onReady={() => setStatus("ready")}
          onError={() => setStatus("error")}
          onBusyChange={setBusy}
          waterMotion={motion === "full" && tier !== "low"}
          colorblind={Boolean(prefs.colorblind)}
          satelliteImagery={satelliteImagery && view === "2d"}
        />
      )}

      {status === "loading" && <GlobeLoader lang={lang} overlay />}

      {phase !== "map" && (
        <div
          className={`intro-scrim absolute inset-0 z-10 flex overflow-y-auto ${phase === "leaving" ? "intro-leaving" : ""
            }`}
        >
          <div className="stagger mx-auto my-auto w-full max-w-6xl px-4 py-8">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand bg-brand-soft px-4 py-1 text-base font-bold text-brand-text">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-brand"
              />
              {hero.eyebrow}
            </p>
            <h1
              aria-label={hero.title}
              className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-8xl"
            >
              <span aria-hidden="true" className="block">
                {hero.titleLines[0]}
              </span>
              <span aria-hidden="true" className="text-gradient block">
                {hero.titleLines[1]}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-xl text-ink-soft sm:text-2xl">
              {hero.lead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={begin}
                className="pressable glow inline-flex min-h-16 items-center gap-3 rounded-2xl bg-brand px-10 text-2xl font-bold text-brand-ink"
              >
                {hero.start}
                <ArrowRightIcon />
              </button>
              <a
                href="#how"
                className="inline-flex min-h-16 items-center rounded-2xl border-2 border-line px-6 text-xl font-bold hover:border-brand hc:border-ink"
              >
                {labels.more}
              </a>
            </div>
            {tier && (
              <p className="mt-4 max-w-xl text-base text-ink-soft">
                {tier === "high" ? labels.auto3d : labels.auto2d}
              </p>
            )}
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
              {hero.facts.map((fact) => (
                <div key={fact.label} className="border-l-2 border-brand pl-4">
                  <dt className="text-base font-bold text-brand-text">
                    {fact.label}
                  </dt>
                  <dd className="brand-name text-3xl leading-tight sm:text-4xl">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {phase === "map" && (
        <div className="rise-in pointer-events-none absolute inset-0 z-10">
          <h1 className="sr-only">{hero.title}</h1>

          {status === "loading" && (
            <p
              role="status"
              className="absolute inset-0 flex items-center justify-center text-xl text-ink-soft"
            >
              {labels.loading}
            </p>
          )}
          {status === "error" && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xl">
              {labels.unsupported}
            </p>
          )}

          {/* Top: where you are, and the 2D / 3D switch. */}
          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
            <nav aria-label={labels.breadcrumb} className="pointer-events-auto">
              <ol className="glass flex flex-wrap items-center gap-1 rounded-2xl p-1.5">
                {path.map((place, index) => {
                  const isLast = index === path.length - 1;
                  return (
                    <li key={place.id} className="flex items-center gap-1">
                      {index > 0 && (
                        <span aria-hidden="true" className="text-ink-soft">
                          ›
                        </span>
                      )}
                      {isLast ? (
                        <span
                          aria-current="page"
                          className="rounded-xl bg-brand px-3 py-1.5 text-base font-bold text-brand-ink"
                        >
                          {labels.places[place.id].name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => go(place.id)}
                          disabled={busy}
                          className="min-h-9 rounded-xl px-2 text-base font-bold underline hover:text-brand-text"
                        >
                          {labels.places[place.id].name}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div
              data-tour="top-controls"
              className="pointer-events-auto flex flex-wrap items-center gap-2"
            >
              {closeUp && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHotspotId(null);
                    setTourOpen(true);
                  }}
                  aria-label={lang === "pt" ? "Abrir tutorial passo a passo" : "Open step-by-step tour"}
                  title={lang === "pt" ? "Como usar (Tutorial)" : "How to use (Tour)"}
                  className="glass flex size-12 items-center justify-center rounded-2xl border border-brand/60 bg-brand-soft text-lg font-extrabold text-brand-text transition hover:bg-brand hover:text-brand-ink"
                >
                  ?
                </button>
              )}
              {closeUp && (
                <div className="glass flex rounded-2xl p-1.5">
                  <button
                    type="button"
                    aria-pressed={satelliteImagery && view === "2d"}
                    disabled={view === "3d" || busy}
                    onClick={() => setSatelliteImagery((v) => !v)}
                    title={
                      view === "3d"
                        ? lang === "pt"
                          ? "A foto real de satélite funciona apenas no modo 2D (Mapa plano)"
                          : "Real satellite imagery is only available in 2D mode (Flat map)"
                        : lang === "pt"
                          ? "Mostrar foto real de satélite por baixo das manchas do radar"
                          : "Show real satellite photo underneath the radar patches"
                    }
                    className={`flex min-h-12 items-center gap-2 rounded-xl px-4 transition ${
                      view === "3d"
                        ? "cursor-not-allowed opacity-50 text-ink-soft"
                        : satelliteImagery
                          ? "bg-brand text-brand-ink"
                          : "text-ink hover:bg-brand-soft"
                    }`}
                  >
                    <span className="text-lg font-bold leading-none">
                      🛰️ {lang === "pt" ? "Satélite" : "Satellite"}
                    </span>
                    <span className="hidden text-xs leading-tight sm:block">
                      {view === "3d"
                        ? lang === "pt"
                          ? "Apenas no 2D"
                          : "2D only"
                        : satelliteImagery
                          ? lang === "pt"
                            ? "Foto ativa (2D)"
                            : "Photo on (2D)"
                          : lang === "pt"
                            ? "Foto real (2D)"
                            : "Real photo (2D)"}
                    </span>
                  </button>
                </div>
              )}
              <div
                role="radiogroup"
                aria-label={labels.view}
                className="glass flex gap-1 rounded-2xl p-1.5"
              >
                {(
                  [
                    ["2d", labels.view2d, labels.view2dHint],
                    ["3d", labels.view3d, labels.view3dHint],
                  ] as const
                ).map(([value, title, hint]) => {
                  const checked = view === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={`${title}: ${hint}`}
                      onClick={() => chooseView(value)}
                      disabled={busy}
                      className={`flex min-h-12 items-center gap-2 rounded-xl px-4 ${checked
                          ? "bg-brand text-brand-ink"
                          : "text-ink hover:bg-brand-soft"
                        }`}
                    >
                      <span className="text-2xl font-bold leading-none">
                        {title}
                      </span>
                      <span className="hidden text-sm leading-tight sm:block">
                        {hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive 4-step guided tour (opens on first visit to the valley or via top button). */}
          {closeUp && (
            <MapTour
              lang={lang}
              open={tourOpen}
              onClose={() => setTourOpen(false)}
            />
          )}

          {/* Modern floating popup when a hotspot square (Q1..Q6) is clicked. */}
          {activeHotspot && (
            <HotspotPopup
              spot={activeHotspot}
              stats={activeHotspotStats}
              lang={lang}
              labels={environment}
              view={view}
              onSwitch3d={() => chooseView("3d")}
              onSelectSpot={selectHotspot}
              onClose={closeHotspot}
              fmtNum={fmtNum}
            />
          )}

          {/* Bottom left: what you are looking at and where to go next. */}
          <div
            data-tour="left-panel"
            aria-live="polite"
            className={`glass rise-in pointer-events-auto absolute inset-x-3 bottom-3 flex flex-col rounded-3xl sm:inset-x-auto sm:left-4 sm:bottom-6 ${
              activeHotspot ? "hidden" : ""
            } ${
              closeUp
                ? `max-h-[60svh] overflow-hidden p-3 lg:bottom-[8.25rem] lg:top-[5rem] lg:max-h-none ${
                    infoTab ? "sm:w-[23rem]" : "sm:w-[19rem]"
                  }`
                : "gap-3 p-4 sm:w-[24rem]"
            }`}
          >
            <div
              className={`flex min-h-0 flex-col ${closeUp ? "flex-1 gap-2 overflow-y-auto pr-1" : "gap-3"
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className={`font-bold leading-tight ${closeUp ? "text-lg" : "text-2xl"}`}>
                  {labels.places[current.id].name}
                </h2>
                <SpeakButton
                  text={[
                    labels.places[current.id].name,
                    labels.places[current.id].description,
                    free3d ? labels.hint3d : null,
                    closeUp && area ? labels.area : null,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  lang={lang}
                  label={lang === "pt" ? "Ouvir" : "Listen"}
                />
              </div>
              <p className={`text-ink-soft ${closeUp ? "text-sm" : ""}`}>
                {labels.places[current.id].description}
              </p>
              {free3d && <p className="text-sm text-ink-soft">{labels.hint3d}</p>}
              {!free3d && !closeUp && (
                <p className="hidden text-sm text-ink-soft lg:block">
                  {labels.mouseHint}
                </p>
              )}
              {closeUp && area && (
                <p className="flex items-center gap-2 text-sm font-bold">
                  <span
                    aria-hidden="true"
                    className="h-0 w-5 border-t-2 border-dashed border-brand"
                  />
                  {labels.area}
                </p>
              )}
              {closeUp && (
                <div className="rounded-2xl border border-line bg-surface p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-brand-text">{environment.hotspotsToggle}</span>
                    <input
                      type="checkbox"
                      checked={showHotspots}
                      onChange={(e) => {
                        setShowHotspots(e.target.checked);
                        if (!e.target.checked) closeHotspot();
                      }}
                      aria-label={environment.hotspotsToggle}
                      className="size-4 accent-cyan-400"
                    />
                  </div>
                  {showHotspots && (
                    <>
                      {/* Hotspot Square Buttons */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {VALLEY_HOTSPOTS.map((spot) => {
                          const active = spot.id === selectedHotspotId;
                          return (
                            <button
                              key={spot.id}
                              type="button"
                              onClick={() => selectHotspot(spot.id)}
                              title={spot.title[lang]}
                              className={`rounded-lg border px-2 py-1 text-xs font-bold transition-colors ${
                                active
                                  ? "border-amber-300 bg-amber-400 text-slate-950"
                                  : "border-line bg-canvas text-ink hover:border-brand"
                              }`}
                            >
                              {spot.kind === "hillslope" ? "⛰" : "▣"} {spot.code}
                            </button>
                          );
                        })}
                      </div>

                      {/* Quick Relief Toggle */}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2">
                        <span className="text-[11px] text-ink-soft">
                          {lang === "pt" ? "Relevo de morros (Copernicus 30m):" : "Hill relief (Copernicus 30m):"}
                        </span>
                        <button
                          type="button"
                          onClick={() => chooseView(view === "3d" ? "2d" : "3d")}
                          className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold transition ${
                            view === "3d"
                              ? "border-amber-300 bg-amber-300 text-slate-950"
                              : "border-line bg-bg text-ink hover:border-brand"
                          }`}
                        >
                          {view === "3d"
                            ? lang === "pt"
                              ? "⛰ 3D Ativo"
                              : "⛰ 3D On"
                            : lang === "pt"
                              ? "Ativar 3D"
                              : "Enable 3D"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {closeUp && currentDetail && (
                <InfoAccordion
                  labels={labels.compare}
                  lang={lang}
                  detail={currentDetail}
                  tab={infoTab}
                  onTab={setInfoTab}
                />
              )}
              {closeUp && timelineStatus === "error" && (
                <div className="flex flex-col items-start gap-2 border-t border-line pt-3">
                  <p className="text-base">{labels.timeline.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineStatus("loading");
                      setTimelineTry((n) => n + 1);
                    }}
                    className="tool-button"
                  >
                    {labels.timeline.retry}
                  </button>
                </div>
              )}
              {closeUp && timeline && (
                <div className="flex flex-col gap-4 border-t border-line pt-3 lg:hidden">
                  <Timeline
                    environmentalEvents={environmental.region?.status === "ready" ? environmental.region.value.events : []}
                    environmentLabels={environment}
                    data={timeline}
                    lang={lang}
                    labels={labels.timeline}
                    featured={labels.featured}
                    selectedId={selectedId}
                    onSelect={(step) => setSelectedId(step.id)}
                  />
                  <ComparePanel
                    labels={labels.compare}
                    featured={labels.featured}
                    lang={lang}
                    step={selectedStep}
                    detail={currentDetail}
                    status={detailStatus === "error" ? "error" : isDetailLoading ? "loading" : "ready"}
                    onRetry={() => setDetailTry((n) => n + 1)}
                    changes={switches}
                    onChanges={setSwitches}
                    environmentalReport={envReport}
                  />
                  {environmentPanel}
                </div>
              )}
            </div>
            <div className={`flex flex-wrap gap-2 ${closeUp ? "shrink-0 border-t border-line pt-2" : ""}`}>
              {current.parent && (
                <button
                  type="button"
                  onClick={() => go(current.parent as string)}
                  disabled={busy}
                  className="pressable flex min-h-12 items-center gap-2 rounded-xl border-2 border-line px-4 font-bold hover:border-brand hc:border-ink"
                >
                  <ArrowRightIcon className="rotate-180" />
                  {labels.back}
                </button>
              )}
              {next.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => go(place.id)}
                  disabled={busy}
                  className="pressable glow flex min-h-12 flex-1 items-center justify-between gap-2 rounded-xl bg-brand px-4 text-left font-bold text-brand-ink disabled:opacity-60"
                >
                  {fill(labels.goTo, { name: labels.places[place.id].name })}
                  <ArrowRightIcon className="shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Bottom: the timeline of passes and comparisons (wide screens). */}
          {closeUp && timeline && (
            <div
              data-tour="timeline"
              className="glass rise-in pointer-events-auto absolute bottom-6 left-4 right-[26.5rem] hidden rounded-3xl px-4 py-3 lg:block"
            >
              <Timeline
                environmentalEvents={environmental.region?.status === "ready" ? environmental.region.value.events : []}
                environmentLabels={environment}
                data={timeline}
                lang={lang}
                labels={labels.timeline}
                featured={labels.featured}
                selectedId={selectedId}
                onSelect={(step) => setSelectedId(step.id)}
              />
            </div>
          )}

          {/* Right: before/after and the layers (wide screens). */}
          {closeUp && timeline && (
            <div
              data-tour="right-panel"
              className="glass rise-in pointer-events-auto absolute bottom-6 right-16 top-20 hidden w-[22rem] overflow-y-auto rounded-3xl p-3 lg:block"
            >
              <ComparePanel
                labels={labels.compare}
                featured={labels.featured}
                lang={lang}
                step={selectedStep}
                detail={currentDetail}
                status={detailStatus === "error" ? "error" : isDetailLoading ? "loading" : "ready"}
                onRetry={() => setDetailTry((n) => n + 1)}
                changes={switches}
                onChanges={setSwitches}
                environmentalReport={envReport}
              />
              {environmentPanel}
            </div>
          )}

          {/* Right edge: quiet camera controls. */}
          <div className="quiet pointer-events-auto absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-2 max-sm:top-24 max-sm:translate-y-0">
            <ControlButton
              label={labels.zoomIn}
              onClick={() => mapHandle.current?.zoomBy(1)}
            >
              +
            </ControlButton>
            <ControlButton
              label={labels.zoomOut}
              onClick={() => mapHandle.current?.zoomBy(-1)}
            >
              −
            </ControlButton>
            {free3d && (
              <>
                <span aria-hidden="true" className="h-1" />
                <ControlButton
                  label={labels.rotateLeft}
                  onClick={() => mapHandle.current?.rotateBy(-30)}
                >
                  ↺
                </ControlButton>
                <ControlButton
                  label={labels.rotateRight}
                  onClick={() => mapHandle.current?.rotateBy(30)}
                >
                  ↻
                </ControlButton>
                <ControlButton
                  label={labels.tiltMore}
                  onClick={() => mapHandle.current?.tiltBy(10)}
                >
                  ▲
                </ControlButton>
                <ControlButton
                  label={labels.tiltLess}
                  onClick={() => mapHandle.current?.tiltBy(-10)}
                >
                  ▼
                </ControlButton>
                <ControlButton
                  label={labels.resetView}
                  onClick={() => mapHandle.current?.resetView()}
                >
                  N
                </ControlButton>
              </>
            )}
          </div>

          {/* Bottom centre: the way down to the rest of the page. */}
          <a
            href="#how"
            className={`glass quiet pointer-events-auto absolute bottom-8 left-1/2 hidden min-h-11 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-base font-bold ${closeUp ? "" : "lg:flex"
              }`}
          >
            {labels.more}
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      )}
    </section>
  );
}
