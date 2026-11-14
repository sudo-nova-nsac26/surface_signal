"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiArea } from "@/data/api-types";
import { STORY_AREA_ID } from "@/data/area-labels";
import { boundsOf, type LngLat } from "@/data/region";
import { listAreas } from "@/data/source";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "../icons";
import type { ViewMode } from "./camera";
import type { MapViewHandle } from "./MapView";
import { buildPlaces, childrenOf, pathTo, type PlaceId } from "./places";

// The map library is large, so it is downloaded only when the visitor
// reaches this part of the page, and never on the server.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

type MapStatus = "idle" | "loading" | "ready" | "error";
type Labels = Dictionary["map"];

const FALLBACK_VALLEY: LngLat = [-51.961, -29.467];

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function ViewToggle({
  view,
  onChange,
  labels,
}: {
  view: ViewMode;
  onChange: (next: ViewMode) => void;
  labels: Labels;
}) {
  const options: { value: ViewMode; title: string; hint: string }[] = [
    { value: "2d", title: labels.view2d, hint: labels.view2dHint },
    { value: "3d", title: labels.view3d, hint: labels.view3dHint },
  ];
  return (
    <div role="radiogroup" aria-label={labels.view} className="mt-6">
      <p className="mb-2 font-bold" aria-hidden="true">
        {labels.view}
      </p>
      <div className="grid max-w-xl grid-cols-2 gap-3">
        {options.map((option) => {
          const checked = view === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.value)}
              className={`pressable flex min-h-20 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${
                checked
                  ? "border-brand bg-brand text-brand-ink glow"
                  : "border-line bg-surface hover:border-brand"
              }`}
            >
              <span className="text-4xl font-bold leading-none">
                {option.title}
              </span>
              <span className="text-base leading-tight">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="pressable flex size-12 items-center justify-center rounded-xl border-2 border-line bg-bg-raised text-2xl font-bold leading-none hc:border-ink"
    >
      {children}
    </button>
  );
}

export function GuidedStory({ labels }: { labels: Labels }) {
  const [placeId, setPlaceId] = useState<PlaceId>("world");
  const [view, setView] = useState<ViewMode>("2d");
  const [area, setArea] = useState<ApiArea | null>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const frameRef = useRef<HTMLDivElement>(null);
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
  const markers = useMemo(
    () =>
      childrenOf(places, current.id).map((place) => ({
        id: place.id,
        name: labels.places[place.id].name,
        point: place.point,
      })),
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

  // Start downloading the map shortly before it scrolls into view.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStatus((value) => (value === "idle" ? "loading" : value));
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const go = (id: string) => setPlaceId(id as PlaceId);

  return (
    <div>
      <ViewToggle view={view} onChange={setView} labels={labels} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
        <div
          ref={frameRef}
          className="relative h-[26rem] overflow-hidden rounded-3xl border border-line bg-bg-raised sm:h-[36rem] hc:border-2"
        >
          {status !== "idle" && status !== "error" && (
            <MapView
              ref={mapHandle}
              place={current}
              markers={markers}
              view={view}
              reducedMotion={reducedMotion}
              area={area?.geometry ?? null}
              label={labels.label}
              dotHint={labels.dotHint}
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

          {(status === "idle" || status === "loading") && (
            <p
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-bg-raised text-ink-soft"
            >
              {labels.loading}
            </p>
          )}

          {status === "error" && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center">
              {labels.unsupported}
            </p>
          )}

          {status === "ready" && (
            <>
              {closeUp && area && (
                <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-line bg-bg-raised/90 px-3 py-1 text-base font-bold">
                  <span
                    aria-hidden="true"
                    className="h-0 w-6 border-t-[3px] border-dashed border-brand"
                  />
                  {labels.area}
                </p>
              )}

              {free3d && (
                <div className="absolute bottom-3 left-3 flex flex-col gap-2 rounded-2xl border border-line bg-bg-raised/90 p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-20 pl-1 text-base font-bold">
                      {labels.rotateLabel}
                    </span>
                    <RoundButton
                      label={labels.rotateLeft}
                      onClick={() => mapHandle.current?.rotateBy(-30)}
                    >
                      ↺
                    </RoundButton>
                    <RoundButton
                      label={labels.rotateRight}
                      onClick={() => mapHandle.current?.rotateBy(30)}
                    >
                      ↻
                    </RoundButton>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-20 pl-1 text-base font-bold">
                      {labels.tiltLabel}
                    </span>
                    <RoundButton
                      label={labels.tiltLess}
                      onClick={() => mapHandle.current?.tiltBy(-10)}
                    >
                      −
                    </RoundButton>
                    <RoundButton
                      label={labels.tiltMore}
                      onClick={() => mapHandle.current?.tiltBy(10)}
                    >
                      +
                    </RoundButton>
                    <button
                      type="button"
                      onClick={() => mapHandle.current?.resetView()}
                      className="pressable min-h-12 rounded-xl border-2 border-line px-3 text-base font-bold hc:border-ink"
                    >
                      {labels.resetView}
                    </button>
                  </div>
                </div>
              )}

              <div className="absolute bottom-10 right-3 flex flex-col gap-2">
                <RoundButton
                  label={labels.zoomIn}
                  onClick={() => mapHandle.current?.zoomBy(1)}
                >
                  +
                </RoundButton>
                <RoundButton
                  label={labels.zoomOut}
                  onClick={() => mapHandle.current?.zoomBy(-1)}
                >
                  −
                </RoundButton>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <nav aria-label={labels.breadcrumb}>
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
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
                        className="rounded-full bg-brand px-3 py-1 text-base font-bold text-brand-ink"
                      >
                        {labels.places[place.id].name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => go(place.id)}
                        className="min-h-10 rounded-full border border-line px-3 text-base font-bold underline"
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
            aria-live="polite"
            className="rounded-2xl border border-line bg-surface p-4 hc:border-2"
          >
            <p className="text-xl">{labels.places[current.id].description}</p>
            {next.length > 0 && (
              <p className="mt-2 text-base text-ink-soft">{labels.dotHint}</p>
            )}
            {free3d && (
              <p className="mt-2 text-base text-ink-soft">{labels.hint3d}</p>
            )}
          </div>

          {next.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => go(place.id)}
              className="pressable glow flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-transparent bg-brand px-4 py-2 text-left text-xl font-bold text-brand-ink hc:border-ink"
            >
              {fill(labels.goTo, { name: labels.places[place.id].name })}
              <ArrowRightIcon className="shrink-0" />
            </button>
          ))}

          {current.parent && (
            <button
              type="button"
              onClick={() => go(current.parent as string)}
              className="pressable flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 text-xl font-bold hc:border-ink"
            >
              <ArrowRightIcon className="rotate-180" />
              {labels.back}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
