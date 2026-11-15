"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { ArrowRightIcon } from "./icons";

type Labels = Dictionary["how"];

const RIVER = "M150 118 C185 140 115 160 150 182 S195 204 172 226";

/**
 * A small explanatory drawing with three states, one per step. It is drawn
 * with plain SVG and CSS so it stays light on slow phones. The drawing is
 * decorative: every step is fully described by the text next to it.
 */
function Scene({ step, labels }: { step: number; labels: Labels }) {
  const show = (index: number) => ({ opacity: step === index ? 1 : 0 });

  return (
    <svg
      viewBox="0 0 320 230"
      className="block h-auto w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="scene-frame">
          <rect width="320" height="230" rx="18" />
        </clipPath>
        <clipPath id="scene-right-half">
          <rect x="160" width="160" height="230" />
        </clipPath>
        <pattern
          id="scene-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill="var(--water-soft)" />
          <rect width="4" height="8" fill="var(--water)" />
        </pattern>
      </defs>

      <g clipPath="url(#scene-frame)">
        <rect width="320" height="230" fill="var(--scene-sky)" />
        <path
          d="M0 112 Q55 62 118 100 T236 92 T320 106 V230 H0 Z"
          fill="var(--scene-hill)"
        />
        <path
          d="M0 132 Q80 112 160 128 T320 124 V230 H0 Z"
          fill="var(--scene-land)"
        />

        {/* Step 3: everything the river gained, hatched so it reads without color. */}
        <g className="scene-layer" style={show(2)}>
          <path
            className="scene-pulse"
            d={RIVER}
            fill="none"
            stroke="url(#scene-hatch)"
            strokeWidth="46"
            strokeLinecap="round"
          />
        </g>

        {/* Step 2: the later date, shown only on the right half. */}
        <g
          className="scene-layer"
          style={show(1)}
          clipPath="url(#scene-right-half)"
        >
          <path
            d={RIVER}
            fill="none"
            stroke="var(--water)"
            strokeWidth="46"
            strokeLinecap="round"
          />
        </g>

        {/* The river inside its normal banks, always visible. */}
        <path
          d={RIVER}
          fill="none"
          stroke="var(--water)"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Two small towns, one on each bank. */}
        <g fill="var(--scene-town)" stroke="var(--scene-stroke)" strokeWidth="1.5">
          <rect x="52" y="150" width="18" height="14" rx="2" />
          <rect x="76" y="144" width="14" height="20" rx="2" />
          <rect x="60" y="172" width="22" height="13" rx="2" />
          <rect x="226" y="156" width="20" height="14" rx="2" />
          <rect x="252" y="150" width="14" height="20" rx="2" />
          <rect x="236" y="178" width="22" height="13" rx="2" />
        </g>

        {/* Step 1: the satellite and its radar beam. */}
        <g className="scene-layer" style={show(0)}>
          <g className="scene-beam">
            <path
              d="M160 34 L104 168 H216 Z"
              fill="var(--highlight)"
              opacity="0.45"
            />
          </g>
          <g stroke="var(--scene-stroke)" strokeWidth="1.5">
            <rect x="124" y="27" width="24" height="14" fill="var(--water)" />
            <rect x="172" y="27" width="24" height="14" fill="var(--water)" />
            <rect
              x="148"
              y="22"
              width="24"
              height="24"
              rx="4"
              fill="var(--scene-town)"
            />
          </g>
        </g>

        {/* Step 2: divider and date labels. */}
        <g className="scene-layer" style={show(1)}>
          <path d="M160 0 V230" stroke="var(--scene-stroke)" strokeWidth="3" />
          <circle
            cx="160"
            cy="115"
            r="13"
            fill="var(--scene-town)"
            stroke="var(--scene-stroke)"
            strokeWidth="3"
          />
          <path
            d="M155 110 l-5 5 5 5 M165 110 l5 5 -5 5"
            fill="none"
            stroke="var(--scene-stroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <SceneLabel x={14} text={labels.before} />
          <SceneLabel x={306} text={labels.after} anchor="end" />
        </g>

        {/* Step 3: label for the hatched area. */}
        <g className="scene-layer" style={show(2)}>
          <SceneLabel x={160} text={labels.newWater} anchor="middle" />
        </g>
      </g>
    </svg>
  );
}

function SceneLabel({
  x,
  text,
  anchor = "start",
}: {
  x: number;
  text: string;
  anchor?: "start" | "middle" | "end";
}) {
  const width = text.length * 8.4 + 20;
  const left =
    anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
  return (
    <g>
      <rect
        x={left}
        y="12"
        width={width}
        height="28"
        rx="14"
        fill="var(--scene-town)"
        stroke="var(--scene-stroke)"
        strokeWidth="2"
      />
      <text
        x={left + width / 2}
        y="31"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--scene-stroke)"
      >
        {text}
      </text>
    </g>
  );
}

export function HowItWorks({ labels }: { labels: Labels }) {
  const [step, setStep] = useState(0);
  const total = labels.steps.length;

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <figure className="overflow-hidden rounded-3xl border border-line bg-surface p-3 hc:border-2">
        <Scene step={step} labels={labels} />
        <figcaption className="px-2 pt-2 text-base text-ink-soft">
          {labels.sceneNote}
        </figcaption>
      </figure>

      <div className="flex flex-col gap-3">
        <ol className="flex flex-col gap-3">
          {labels.steps.map((item, index) => {
            const active = index === step;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStep(index)}
                  className={`pressable flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left ${
                    active
                      ? "border-brand bg-brand-soft hc:border-highlight"
                      : "border-line bg-surface"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${
                      active
                        ? "bg-brand text-brand-ink hc:bg-highlight hc:text-highlight-ink"
                        : "bg-line text-ink hc:bg-surface hc:outline hc:outline-2 hc:outline-ink"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-xl font-bold">
                      {item.title}
                    </span>
                    <span className="block text-ink-soft">{item.body}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => {
            if (step < total - 1) {
              setStep(step + 1);
              return;
            }
            // Last step: carry on down the page instead of starting over.
            document
              .getElementById("layers")
              ?.scrollIntoView({ block: "start" });
          }}
          className="pressable inline-flex min-h-14 items-center justify-center gap-3 self-start rounded-2xl border-2 border-transparent bg-brand px-6 text-xl font-bold text-brand-ink hc:border-ink"
        >
          {step < total - 1 ? labels.next : labels.continue}
          {step < total - 1 ? (
            <ArrowRightIcon />
          ) : (
            <ArrowRightIcon className="rotate-90" />
          )}
        </button>
      </div>
    </div>
  );
}
