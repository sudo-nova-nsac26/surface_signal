"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ApiArea } from "@/data/api-types";
import { STORY_AREA_ID } from "@/data/area-labels";
import { boundsOf } from "@/data/region";
import { listAreas } from "@/data/source";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useReducedMotion } from "@/preferences/store";
import { ArrowRightIcon } from "../icons";
import { OVERVIEW_STOPS, regionStop, type CameraStop } from "./camera";
import type { MapViewHandle } from "./MapView";

// The map library is large, so it is downloaded only when the visitor
// reaches this part of the page, and never on the server.
const MapView = dynamic(() => import("./MapView"), { ssr: false });

type MapStatus = "idle" | "loading" | "ready" | "error";

const noopSubscribe = () => () => {};

/** Phones and computers with little memory start in the lighter flat view. */
function useLowPowerDevice() {
  return useSyncExternalStore(
    noopSubscribe,
    () => {
      const memory = (navigator as Navigator & { deviceMemory?: number })
        .deviceMemory;
      return (
        (memory !== undefined && memory <= 2) ||
        navigator.hardwareConcurrency <= 2
      );
    },
    () => false,
  );
}

function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

export function GuidedStory({
  steps,
  labels,
}: {
  steps: string[];
  labels: Dictionary["map"];
}) {
  const [step, setStep] = useState(0);
  const [area, setArea] = useState<ApiArea | null>(null);
  const [status, setStatus] = useState<MapStatus>("idle");
  const [simpleChoice, setSimpleChoice] = useState<boolean | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mapHandle = useRef<MapViewHandle>(null);

  const reducedMotion = useReducedMotion();
  const lowPower = useLowPowerDevice();
  // Until the visitor chooses, the flat view follows the device and the
  // "reduce motion" preference.
  const simple = simpleChoice ?? (reducedMotion || lowPower);

  const last = steps.length - 1;

  const stops = useMemo<CameraStop[]>(() => {
    const fallback = regionStop([-51.961, -29.467]);
    if (!area) return [...OVERVIEW_STOPS, fallback];
    const [[west, south], [east, north]] = boundsOf(area);
    return [
      ...OVERVIEW_STOPS,
      regionStop([(west + east) / 2, (south + north) / 2]),
    ];
  }, [area]);

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
          setStatus((current) => (current === "idle" ? "loading" : current));
          observer.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
      <div
        ref={frameRef}
        className="relative h-[24rem] overflow-hidden rounded-3xl border border-line bg-bg-raised sm:h-[34rem] hc:border-2"
      >
        {status !== "idle" && status !== "error" && (
          <MapView
            ref={mapHandle}
            stops={stops}
            step={step}
            simple={simple}
            reducedMotion={reducedMotion}
            area={area?.geometry ?? null}
            label={labels.label}
            gestureText={{
              desktop: labels.gestureDesktop,
              mac: labels.gestureMac,
              mobile: labels.gestureMobile,
            }}
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
            {step === last && area && (
              <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-line bg-bg-raised/90 px-3 py-1 text-base font-bold">
                <span
                  aria-hidden="true"
                  className="h-0 w-6 border-t-[3px] border-dashed border-brand"
                />
                {labels.area}
              </p>
            )}
            <div className="absolute bottom-10 right-3 flex flex-col gap-2">
              <button
                type="button"
                aria-label={labels.zoomIn}
                onClick={() => mapHandle.current?.zoomBy(1)}
                className="pressable flex size-12 items-center justify-center rounded-xl border-2 border-line bg-bg-raised text-3xl font-bold leading-none hc:border-ink"
              >
                +
              </button>
              <button
                type="button"
                aria-label={labels.zoomOut}
                onClick={() => mapHandle.current?.zoomBy(-1)}
                className="pressable flex size-12 items-center justify-center rounded-xl border-2 border-line bg-bg-raised text-3xl font-bold leading-none hc:border-ink"
              >
                −
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-2">
          {steps.map((title, index) => {
            const active = index === step;
            return (
              <li key={title}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStep(index)}
                  className={`pressable flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left font-bold ${
                    active
                      ? "border-brand bg-brand-soft hc:border-highlight"
                      : "border-line bg-surface"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xl ${
                      active
                        ? "bg-brand text-brand-ink"
                        : "bg-line text-ink hc:bg-surface hc:outline hc:outline-2 hc:outline-ink"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {title}
                </button>
              </li>
            );
          })}
        </ol>

        <div
          aria-live="polite"
          className="rounded-2xl border border-line bg-surface p-4 hc:border-2"
        >
          <p className="text-base font-bold text-brand-text">
            {fill(labels.stepOf, { current: step + 1, total: steps.length })}
          </p>
          <p className="mt-1 text-xl">{labels.descriptions[step]}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="pressable flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 text-xl font-bold disabled:opacity-40 hc:border-ink"
          >
            <ArrowRightIcon className="rotate-180" />
            {labels.previous}
          </button>
          <button
            type="button"
            disabled={step === last}
            onClick={() => setStep((current) => Math.min(last, current + 1))}
            className="pressable glow flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-transparent bg-brand px-4 text-xl font-bold text-brand-ink disabled:opacity-40 hc:border-ink"
          >
            {labels.next}
            <ArrowRightIcon />
          </button>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={simple}
          onClick={() => setSimpleChoice(!simple)}
          className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-left hc:border-ink"
        >
          <span>
            <span className="block font-bold">{labels.simple}</span>
            <span className="block text-base text-ink-soft">
              {labels.simpleHint}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-ink p-0.5 ${
              simple ? "justify-end bg-brand" : "justify-start bg-surface"
            }`}
          >
            <span
              className={`size-6 rounded-full ${simple ? "bg-brand-ink" : "bg-ink"}`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
