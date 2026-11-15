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
      className="rise-in pointer-events-auto absolute inset-x-3 bottom-3 z-20 flex max-h-[68svh] flex-col overflow-hidden rounded-3xl border-2 border-cyan-400/75 bg-slate-950/95 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.88)] backdrop-blur-md sm:inset-x-auto sm:left-4 sm:bottom-6 sm:w-[23.5rem] lg:bottom-auto lg:left-4 lg:top-16 lg:max-h-[calc(100svh-13.5rem)]"
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
        {/* Clean Real Satellite Banner + Live Metrics Overlay */}
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-900 sm:h-36">
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

          {/* Top-left badge */}
          <span className="absolute left-2.5 top-2 rounded-lg bg-slate-950/85 px-2 py-0.5 text-[11px] font-bold text-cyan-200 backdrop-blur-sm">
            🛰️ {lang === "pt" ? "Imagem real de satélite (Esri)" : "Real satellite imagery (Esri)"}
          </span>

          {/* Bottom live metrics inside the satellite card */}
          <div className="absolute inset-x-2.5 bottom-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-slate-300">{spot.subtitle[lang]}</p>
              <p className="text-sm font-extrabold text-cyan-300">
                {stats
                  ? lang === "pt"
                    ? `${totalPatches} manchas detectadas no ponto`
                    : `${totalPatches} patches detected in spot`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-right">
              <p className="text-xs font-extrabold text-white">{fmtNum(areaM2)} m²</p>
              {pitches > 0 && (
                <p className="text-[10px] text-slate-300">
                  ≈ {fmtNum(Number(pitches.toFixed(1)))}{" "}
                  {lang === "pt" ? "campos de futebol" : "soccer fields"}
                </p>
              )}
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
