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
import { useMotionLevel } from "@/preferences/store";
import { ArrowRightIcon } from "../icons";
import {
  assessGraphics,
  measureFps,
  SMOOTH_FPS,
  type GraphicsTier,
} from "./hardware";
import type { ViewMode } from "./camera";
import { NO_CHANGES, type ChangeLayers, type MapMarker, type MapViewHandle } from "./MapView";
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
  const motion = useMotionLevel();

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
  const currentDetail = detail && detail.id === analysisId ? detail.data : null;
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
  };

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
        />
      )}

      {phase !== "map" && (
        <div
          className={`intro-scrim absolute inset-0 z-10 flex overflow-y-auto ${
            phase === "leaving" ? "intro-leaving" : ""
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
              role="radiogroup"
              aria-label={labels.view}
              className="glass pointer-events-auto flex gap-1 rounded-2xl p-1.5"
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
                    className={`flex min-h-12 items-center gap-2 rounded-xl px-4 ${
                      checked
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

          {/* Bottom left: what you are looking at and where to go next. */}
          <div
            aria-live="polite"
            className={`glass rise-in pointer-events-auto absolute inset-x-3 bottom-3 flex flex-col rounded-3xl sm:inset-x-auto sm:left-4 sm:bottom-6 ${
              closeUp
                ? `max-h-[60svh] overflow-hidden p-3 lg:bottom-auto lg:top-[13.75rem] lg:max-h-[calc(100svh-31rem)] xl:top-[5rem] xl:max-h-[calc(100svh-20rem)] ${
                  infoTab ? "sm:w-[23rem]" : "sm:w-[19rem]"
                }`
                : "gap-3 p-4 sm:w-[24rem]"
            }`}
          >
            <div
              className={`flex min-h-0 flex-col ${
                closeUp ? "flex-1 gap-2 overflow-y-auto pr-1" : "gap-3"
              }`}
            >
            <h2 className={`font-bold leading-tight ${closeUp ? "text-lg" : "text-2xl"}`}>
              {labels.places[current.id].name}
            </h2>
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
                  status={detailStatus}
                  onRetry={() => setDetailTry((n) => n + 1)}
                  changes={switches}
                  onChanges={setSwitches}
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
            <div className="glass rise-in pointer-events-auto absolute bottom-6 left-4 right-[26.5rem] hidden rounded-3xl px-4 py-3 lg:block">
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
            <div className="glass rise-in pointer-events-auto absolute bottom-6 right-16 top-20 hidden w-[22rem] overflow-y-auto rounded-3xl p-3 lg:block">
              <ComparePanel
                  labels={labels.compare}
                  featured={labels.featured}
                  lang={lang}
                  step={selectedStep}
                  detail={currentDetail}
                  status={detailStatus}
                  onRetry={() => setDetailTry((n) => n + 1)}
                  changes={switches}
                  onChanges={setSwitches}
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
            className={`glass quiet pointer-events-auto absolute bottom-8 left-1/2 hidden min-h-11 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-base font-bold ${
              closeUp ? "" : "lg:flex"
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
