"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { SpeakButton } from "@/components/ui/SpeakButton";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ViewMode } from "./camera";
import { VALLEY_HOTSPOTS, type HotspotLiveStats, type MapHotspot } from "./hotspots";

const PITCH_M2 = 7140;

type SectionId = "beforeAfter" | "whatHappened" | "meaning" | "technical";

/** Converts a LngLat to Web Mercator slippy tile coordinates (z/x/y) for real satellite preview. */
function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number; z: number } {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z };
}

/**
 * Renders a tailored SVG radar-change overlay for the "After (Jul 23)" side of the
 * interactive Before/After comparator inside each inspection square.
 */
function RadarAfterOverlay({ kind }: { kind: MapHotspot["kind"] }) {
  if (kind === "hillslope") {
    return (
      <svg viewBox="0 0 320 150" className="h-full w-full" preserveAspectRatio="none">
        {/* Subtle terrain contour lines on hillslope */}
        <path
          d="M 10,30 Q 90,15 180,35 T 310,25"
          fill="none"
          stroke="#fde047"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        <path
          d="M 5,70 Q 100,50 195,75 T 315,65"
          fill="none"
          stroke="#fde047"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        {/* Roughness increase / exposed hillslope patches (orange/amber) */}
        <polygon
          points="55,38 112,32 128,62 94,76 48,60"
          fill="#f97316"
          fillOpacity="0.58"
          stroke="#fdba74"
          strokeWidth="1.6"
        />
        <polygon
          points="158,46 226,38 244,74 198,92 148,72"
          fill="#f97316"
          fillOpacity="0.62"
          stroke="#fde047"
          strokeWidth="1.8"
        />
        {/* Wet thalweg / drainage line at the foot of the slope */}
        <polygon
          points="90,98 165,92 255,108 242,126 150,118 82,112"
          fill="#1d4ed8"
          fillOpacity="0.6"
          stroke="#60a5fa"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (kind === "river_corridor") {
    return (
      <svg viewBox="0 0 320 150" className="h-full w-full" preserveAspectRatio="none">
        {/* Expanded river channel / open water sheet */}
        <path
          d="M 0,48 Q 95,28 175,58 T 320,44 L 320,104 Q 185,118 95,88 T 0,98 Z"
          fill="#0284c7"
          fillOpacity="0.58"
          stroke="#38bdf8"
          strokeWidth="1.8"
        />
        {/* Specular new water pockets along low banks */}
        <polygon
          points="42,26 98,22 112,46 58,52"
          fill="#38bdf8"
          fillOpacity="0.72"
          stroke="#e0f2fe"
          strokeWidth="1.5"
        />
        <polygon
          points="182,32 248,28 262,56 196,60"
          fill="#38bdf8"
          fillOpacity="0.72"
          stroke="#e0f2fe"
          strokeWidth="1.5"
        />
        {/* Double-bounce in riverside trees & urban structures (orange) */}
        <polygon
          points="65,86 142,82 154,108 78,112"
          fill="#f97316"
          fillOpacity="0.65"
          stroke="#fdba74"
          strokeWidth="1.5"
        />
        <polygon
          points="204,88 278,80 292,106 218,114"
          fill="#f97316"
          fillOpacity="0.65"
          stroke="#fdba74"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  // Default: floodplain & agricultural fields (Q1, Q3, Q4)
  return (
    <svg viewBox="0 0 320 150" className="h-full w-full" preserveAspectRatio="none">
      {/* Broad signal-drop wet soil / shallow water sheet */}
      <polygon
        points="24,28 148,22 166,78 112,96 28,82"
        fill="#1d4ed8"
        fillOpacity="0.56"
        stroke="#60a5fa"
        strokeWidth="1.5"
      />
      <polygon
        points="162,32 292,26 302,88 214,104 156,78"
        fill="#1d4ed8"
        fillOpacity="0.56"
        stroke="#60a5fa"
        strokeWidth="1.5"
      />
      {/* High-confidence open water patches (cyan) */}
      <polygon
        points="48,40 122,36 134,68 62,74"
        fill="#38bdf8"
        fillOpacity="0.78"
        stroke="#e0f2fe"
        strokeWidth="1.8"
      />
      <polygon
        points="186,44 268,38 278,74 198,82"
        fill="#38bdf8"
        fillOpacity="0.78"
        stroke="#e0f2fe"
        strokeWidth="1.8"
      />
      {/* Flooded crop / riparian vegetation double-bounce (orange) */}
      <polygon
        points="88,88 188,82 204,112 96,116"
        fill="#f97316"
        fillOpacity="0.64"
        stroke="#fdba74"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function HotspotPopup({
  spot,
  stats,
  lang,
  labels,
  view,
  onSwitch3d,
  onSelectSpot,
  onClose,
  fmtNum,
}: {
  spot: MapHotspot;
  stats: HotspotLiveStats | null;
  lang: Locale;
  labels: Dictionary["environment"];
  view: ViewMode;
  onSwitch3d: () => void;
  onSelectSpot: (id: string) => void;
  onClose: () => void;
  fmtNum: (n: number | null | undefined) => string;
}) {
  // Always open the 1st accordion item ("beforeAfter") when a hotspot is selected
  const [openState, setOpenState] = useState<{ spotId: string; section: SectionId | null }>({
    spotId: spot.id,
    section: "beforeAfter",
  });
  // Before/After split percentage (0 = full After, 50 = split, 100 = full Before)
  const [splitPct, setSplitPct] = useState(45);

  const openSection: SectionId | null =
    openState.spotId === spot.id ? openState.section : "beforeAfter";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tile = lngLatToTile(spot.center[0], spot.center[1], 15);
  const satUrlLeft = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x}`;
  const satUrlRight = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${tile.z}/${tile.y}/${tile.x + 1}`;

  const isHillslope = spot.kind === "hillslope";
  const areaM2 = (stats?.generalDecreaseM2 ?? 0) + (stats?.generalIncreaseM2 ?? 0);
  const totalPatches = (stats?.waterPolygonCount ?? 0) + (stats?.increasePolygonCount ?? 0);
  const pitches = areaM2 > 0 ? Math.max(0.1, areaM2 / PITCH_M2) : 0;

  const speechText = `${spot.title[lang]}. ${spot.subtitle[lang]}. ${spot.beforeAfter[lang]} ${spot.whatHappened[lang]} ${spot.consequences[lang]}`;

  const sections: { id: SectionId; title: string; body: string; isTech?: boolean }[] = [
    {
      id: "beforeAfter",
      title: labels.hotspotBeforeAfter,
      body: spot.beforeAfter[lang],
    },
    {
      id: "whatHappened",
      title: labels.hotspotWhatHappened,
      body: spot.whatHappened[lang],
    },
    {
      id: "meaning",
      title: labels.hotspotConsequences,
      body: spot.consequences[lang],
    },
    {
      id: "technical",
      title: lang === "pt" ? "Visão Técnica (Defesa Civil / Pesquisa)" : "Technical View (Civil Defense / Research)",
      body: spot.technicalNote[lang],
      isTech: true,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={spot.title[lang]}
      className="rise-in pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex max-h-[68svh] flex-col overflow-hidden rounded-3xl border-2 border-cyan-400/75 bg-slate-950/95 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.88)] backdrop-blur-md sm:inset-x-auto sm:left-4 sm:bottom-6 sm:w-[24rem] lg:bottom-auto lg:left-4 lg:top-16 lg:max-h-[calc(100svh-13.5rem)]"
    >
      {/* Quick switcher between Q1..Q6 + Close button */}
      <div className="flex items-center justify-between gap-1.5 border-b border-slate-800/90 bg-slate-900/80 px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {VALLEY_HOTSPOTS.map((item) => {
            const active = item.id === spot.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSpot(item.id)}
                title={item.title[lang]}
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-extrabold transition ${
                  active
                    ? "border-amber-300 bg-amber-400 text-slate-950"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-400 hover:text-white"
                }`}
              >
                {item.kind === "hillslope" ? "⛰" : "▣"} {item.code}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SpeakButton text={speechText} lang={lang} />
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.hotspotClose}
            title={labels.hotspotClose}
            className="flex size-7 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-xs font-bold text-slate-200 transition hover:border-cyan-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Compact Title Header */}
      <div className="border-b border-slate-800/80 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
              isHillslope ? "bg-amber-300 text-slate-950" : "bg-cyan-400 text-slate-950"
            }`}
          >
            {isHillslope ? "⛰" : "▣"} {spot.code} · {spot.municipality}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-300">
            ~{spot.elevationApproxM} m · ~{spot.slopeApproxDeg}°
          </span>
        </div>
        <h3 className="mt-1 text-base font-extrabold leading-snug text-white sm:text-lg">
          {spot.title[lang]}
        </h3>
      </div>

      {/* Scrollable Body */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {/* Interactive Before vs. After Satellite + Radar Comparator */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-700/90 bg-slate-900/90 p-2">
          <div className="relative h-36 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 select-none">
            {/* Base optical satellite imagery (Before - Jul 11) */}
            <div className="grid h-full w-full grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={satUrlLeft}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={satUrlRight}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>

            {/* Clipped "After (Jul 23 + NISAR Radar)" overlay on the right side of splitPct */}
            <div
              aria-hidden="true"
              style={{ clipPath: `inset(0 0 0 ${splitPct}%)` }}
              className="pointer-events-none absolute inset-0 bg-sky-950/35"
            >
              <RadarAfterOverlay kind={spot.kind} />
            </div>

            {/* Vertical Divider Line + Handle */}
            <div
              aria-hidden="true"
              style={{ left: `${splitPct}%` }}
              className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-cyan-300 shadow-[0_0_10px_#22d3ee]"
            >
              <span className="absolute left-1/2 top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-950 bg-cyan-300 text-[10px] font-extrabold text-slate-950 shadow">
                ↔
              </span>
            </div>

            {/* Invisible full-area range slider for smooth dragging */}
            <input
              type="range"
              min={0}
              max={100}
              value={splitPct}
              onChange={(e) => setSplitPct(Number(e.target.value))}
              aria-label={
                lang === "pt"
                  ? "Comparador Antes e Depois neste quadradinho"
                  : "Before and After comparator in this square"
              }
              className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
            />

            {/* Top corner Before / After badges */}
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-slate-950/85 px-2 py-0.5 text-[10px] font-extrabold text-slate-200">
              {lang === "pt" ? "Antes · 11 jul (Seco)" : "Before · Jul 11 (Dry)"}
            </span>
            <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-md bg-cyan-950/90 border border-cyan-400/50 px-2 py-0.5 text-[10px] font-extrabold text-cyan-200">
              {lang === "pt" ? "Depois · 23 jul (+ Radar)" : "After · Jul 23 (+ Radar)"}
            </span>

            {/* Bottom live metrics bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent px-2.5 pb-1.5 pt-5">
              <span className="text-xs font-extrabold text-cyan-300">
                {stats
                  ? lang === "pt"
                    ? `${totalPatches} manchas no ponto`
                    : `${totalPatches} patches in spot`
                  : "—"}
              </span>
              <span className="text-xs font-extrabold text-white">
                {fmtNum(areaM2)} m²{" "}
                {pitches > 0 && (
                  <span className="font-normal text-slate-300">
                    (≈ {fmtNum(Number(pitches.toFixed(1)))}{" "}
                    {lang === "pt" ? "campos" : "fields"})
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Accessible 1-click buttons + Symbol Legend (colorblind-safe icons: ● ▼ ▲) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-0.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="text-sky-300">●</span>
                {lang === "pt" ? "Água" : "Water"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-blue-400">▼</span>
                {lang === "pt" ? "Queda" : "Drop"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="text-orange-400">▲</span>
                {lang === "pt" ? "Aumento" : "Increase"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  [100, lang === "pt" ? "Só Antes" : "Before"],
                  [45, "50/50"],
                  [0, lang === "pt" ? "Só Depois" : "After"],
                ] as const
              ).map(([val, txt]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSplitPct(val)}
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition ${
                    Math.abs(splitPct - val) <= 10
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                  }`}
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* If hillslope (Q6) and currently in 2D, offer 1-click 3D relief button */}
        {isHillslope && view !== "3d" && (
          <button
            type="button"
            onClick={onSwitch3d}
            className="flex items-center justify-between gap-2 rounded-2xl border border-amber-300/60 bg-amber-400/15 px-3.5 py-2 text-xs font-extrabold text-amber-200 transition hover:bg-amber-400/25"
          >
            <span>⛰ {lang === "pt" ? "Ver inclinação desta encosta em Relevo 3D" : "View this hillslope in 3D Relief"}</span>
            <span className="rounded-lg bg-amber-300 px-2 py-0.5 text-slate-950">3D →</span>
          </button>
        )}

        {/* Single-open Accordion (1st open by default, opening another closes the previous) */}
        <div className="flex flex-col divide-y divide-slate-800/90 rounded-2xl border border-slate-800 bg-slate-900/60">
          {sections.map((sec) => {
            const isOpen = openSection === sec.id;
            return (
              <div key={sec.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenState({
                      spotId: spot.id,
                      section: isOpen ? null : sec.id,
                    })
                  }
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-extrabold text-cyan-300 transition hover:bg-slate-800/50"
                >
                  <span>{sec.title}</span>
                  <ChevronDownIcon
                    className={`size-4 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180 text-cyan-300" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div
                    className={`px-3.5 pb-3 text-xs leading-relaxed ${
                      sec.isTech ? "font-mono text-[11px] text-slate-300" : "text-slate-100"
                    }`}
                  >
                    {sec.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Compact Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-950 px-4 py-2.5">
        <span className="text-[11px] text-slate-400">
          {lang === "pt"
            ? "Clique de novo no quadrado para afastar"
            : "Click the square again to zoom out"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-cyan-400 px-3 py-1 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-300"
        >
          {lang === "pt" ? "← Voltar visão" : "← Restore view"}
        </button>
      </div>
    </div>
  );
}
