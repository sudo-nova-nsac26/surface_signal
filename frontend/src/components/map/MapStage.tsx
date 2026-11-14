"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ApiArea } from "@/data/api-types";
import { STORY_AREA_ID } from "@/data/area-labels";
import { boundsOf, type LngLat } from "@/data/region";
import { listAreas } from "@/data/source";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "../icons";
import type { ViewMode } from "./camera";
import type { MapMarker, MapViewHandle } from "./MapView";
import {
  buildPlaces,
  childrenOf,
  pathTo,
  upcomingOf,
  type PlaceId,
} from "./places";

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
  labels,
  hero,
}: {
  labels: Labels;
  hero: Dictionary["hero"];
}) {
  const [started, setStarted] = useState(false);
  const [placeId, setPlaceId] = useState<PlaceId>("world");
  const [view, setView] = useState<ViewMode>("2d");
  const [area, setArea] = useState<ApiArea | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const mapHandle = useRef<MapViewHandle>(null);
  const reducedMotion = useReducedMotion();

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
        name: labels.upcoming[place.id],
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
    [places, current.id, labels],
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

  const go = (id: string) => setPlaceId(id as PlaceId);

  return (
    <section
      aria-label={labels.label}
      className="relative h-[calc(100svh-4.75rem)] min-h-[36rem] overflow-hidden bg-bg hc:border-b-2 hc:border-ink"
    >
      {status !== "error" && (
        <MapView
          ref={mapHandle}
          place={current}
          markers={started ? markers : []}
          view={view}
          reducedMotion={reducedMotion}
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
        />
      )}

      {!started && (
        <div className="intro-scrim absolute inset-0 z-10 flex overflow-y-auto">
          <div className="rise-in mx-auto my-auto w-full max-w-6xl px-4 py-8">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand bg-brand-soft px-4 py-1 text-base font-bold text-brand-text">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-brand"
              />
              {hero.eyebrow}
            </p>
            <h1 className="text-gradient max-w-4xl text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl lg:text-8xl">
              {hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-xl text-ink-soft sm:text-2xl">
              {hero.lead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setStarted(true)}
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
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {hero.facts.map((fact) => (
                <div key={fact.label} className="border-l-2 border-brand pl-4">
                  <dt className="text-base font-bold text-brand-text">
                    {fact.label}
                  </dt>
                  <dd className="text-lg font-bold leading-snug">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {started && (
        <div className="pointer-events-none absolute inset-0 z-10">
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
                    onClick={() => setView(value)}
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
            className="glass rise-in pointer-events-auto absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-3xl p-4 sm:inset-x-auto sm:left-4 sm:bottom-8 sm:w-[24rem]"
          >
            <h2 className="text-2xl font-bold leading-tight">
              {labels.places[current.id].name}
            </h2>
            <p className="text-ink-soft">
              {labels.places[current.id].description}
            </p>
            {free3d && <p className="text-base text-ink-soft">{labels.hint3d}</p>}
            {!free3d && (
              <p className="hidden text-sm text-ink-soft lg:block">
                {labels.mouseHint}
              </p>
            )}
            {closeUp && area && (
              <p className="flex items-center gap-2 text-base font-bold">
                <span
                  aria-hidden="true"
                  className="h-0 w-7 border-t-[3px] border-dashed border-brand"
                />
                {labels.area}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {current.parent && (
                <button
                  type="button"
                  onClick={() => go(current.parent as string)}
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
                  className="pressable glow flex min-h-12 flex-1 items-center justify-between gap-2 rounded-xl bg-brand px-4 text-left font-bold text-brand-ink"
                >
                  {fill(labels.goTo, { name: labels.places[place.id].name })}
                  <ArrowRightIcon className="shrink-0" />
                </button>
              ))}
            </div>
          </div>

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
            className="glass quiet pointer-events-auto absolute bottom-8 left-1/2 hidden min-h-11 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-base font-bold lg:flex"
          >
            {labels.more}
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      )}
    </section>
  );
}
