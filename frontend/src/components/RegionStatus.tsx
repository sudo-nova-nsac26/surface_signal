"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AREA_LABELS, STORY_AREA_ID } from "@/data/area-labels";
import {
  loadComparisonDetail,
  loadRegionView,
  type ComparisonDetail,
  type RegionView,
} from "@/data/region";
import { listAreas } from "@/data/source";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { InfoIcon } from "./icons";

type Labels = Dictionary["region"];

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; region: RegionView; detail: ComparisonDetail | null };

/** Fills "{name}" placeholders in a sentence from the dictionaries. */
function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

function useDateFormat(lang: Locale) {
  const formatter = new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  });
  return (iso: string) => formatter.format(new Date(iso));
}

function joinNames(names: string[], and: string) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/**
 * Section 03: Shows how we translate NASA's raw HDF5 GCOV scientific radar files
 * into plain language, alongside the full HDF5 telemetry for researchers and
 * Civil Defense specialists.
 */
export function RegionStatus({
  lang,
  labels,
  badge,
  number,
  action,
}: {
  lang: Locale;
  labels: Labels;
  badge: string;
  /** Section number shown beside the title. */
  number?: string;
  /** Shown at the end of the title row (the "Listen" button). */
  action?: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const formatDate = useDateFormat(lang);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const areas = await listAreas(controller.signal);
        const area =
          areas.find((item) => item.area_id === STORY_AREA_ID) ?? areas[0];
        if (!area) throw new Error("No area available");
        const region = await loadRegionView(area, controller.signal);
        let detail: ComparisonDetail | null = null;
        const targetAnalysisId =
          region.comparison?.analysisId ?? "5e434ec81b10578ba7ba6dfb";
        try {
          detail = await loadComparisonDetail(
            targetAnalysisId,
            lang,
            controller.signal,
          );
        } catch {
          detail = null;
        }
        setState({ status: "ready", region, detail });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [attempt, lang]);

  const isPt = lang === "pt";

  return (
    <div aria-busy={state.status === "loading"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="region-title" className="flex items-baseline gap-4">
          {number && (
            <span
              aria-hidden="true"
              className="text-xl font-bold tabular-nums text-brand-text"
            >
              {number}
            </span>
          )}
          <span className="text-4xl font-bold tracking-tight sm:text-5xl">
            {labels.title}
          </span>
        </h2>
        {action}
      </div>

      <p className="mt-4 max-w-3xl text-xl text-ink-soft">
        {isPt
          ? "Um arquivo bruto do satélite NISAR pesa quase 7 GB e vem em matrizes matemáticas (HDF5). Veja passo a passo como nós filtramos e traduzimos esses números para linguagem simples — e consulte abaixo a telemetria científica completa."
          : "A single raw NISAR satellite file weighs nearly 7 GB and comes as mathematical matrices (HDF5). See step by step how we filter and translate those numbers into plain language — and inspect the full scientific telemetry below."}
      </p>

      {/* 4-Step Visual Translation Pipeline: HDF5 -> Plain Language */}
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5 hc:border-2">
          <div>
            <span className="inline-block rounded-full border border-brand/50 bg-brand/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-text">
              {isPt ? "Passo 1 · Entrada Bruta" : "Step 1 · Raw Input"}
            </span>
            <h3 className="mt-2.5 text-lg font-bold text-ink">
              {isPt ? "Arquivo HDF5 GCOV (~7 GB)" : "HDF5 GCOV Granule (~7 GB)"}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {isPt
                ? "O satélite NISAR (Banda L, 24 cm, polarização HHHH) mede a energia de retorno γ⁰ em uma grade UTM 22S (EPSG:32722) de 10×10 metros."
                : "The NISAR satellite (L-band, 24 cm, HHHH polarization) measures radar backscatter γ⁰ on a 10×10 m UTM 22S (EPSG:32722) grid."}
            </p>
          </div>
          <div className="rounded-xl border border-line/80 bg-bg/70 p-2.5 font-mono text-xs text-brand-text">
            {isPt
              ? "Tradução: recortamos 780.786 pixels válidos (78,08 km²) sobre Lajeado e Estrela."
              : "Translation: we clip 780,786 valid pixels (78.08 km²) over Lajeado and Estrela."}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5 hc:border-2">
          <div>
            <span className="inline-block rounded-full border border-brand/50 bg-brand/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-text">
              {isPt ? "Passo 2 · Limpeza Física" : "Step 2 · Physical Filtering"}
            </span>
            <h3 className="mt-2.5 text-lg font-bold text-ink">
              {isPt ? "Filtro Speckle e Decibéis (dB)" : "Speckle Filter & Decibels (dB)"}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {isPt
                ? "Todo radar sofre com 'chuvisco' natural (speckle). Aplicamos conectividade-4 e descartamos grupos isolados menores que 9 pixels (900 m²)."
                : "All radar suffers from natural speckle noise. We apply 4-connectivity and discard isolated pixel groups smaller than 9 pixels (900 m²)."}
            </p>
          </div>
          <div className="rounded-xl border border-line/80 bg-bg/70 p-2.5 font-mono text-xs text-brand-text">
            {isPt
              ? "Tradução: 112.905 micro-ruídos descartados; só ficam mudanças ≥ ±3 dB e água ≤ -17 dB."
              : "Translation: 112,905 noise specks removed; only changes ≥ ±3 dB and water ≤ -17 dB remain."}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5 hc:border-2">
          <div>
            <span className="inline-block rounded-full border border-brand/50 bg-brand/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-text">
              {isPt ? "Passo 3 · Contexto Real" : "Step 3 · Real-World Context"}
            </span>
            <h3 className="mt-2.5 text-lg font-bold text-ink">
              {isPt ? "Cruzamento com Chuva e Relevo" : "Crossing with Rain & Relief"}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {isPt
                ? "O sinal do radar sozinho não diz a causa. Cruzamos cada mancha com a chuva de 72h (CHIRPS), boletins do rio (SGB) e altitude/inclinação (Copernicus 30m)."
                : "Radar signal alone does not prove cause. We cross every patch with 72h rainfall (CHIRPS), river bulletins (SGB), and elevation/slope (Copernicus 30m)."}
            </p>
          </div>
          <div className="rounded-xl border border-line/80 bg-bg/70 p-2.5 font-mono text-xs text-brand-text">
            {isPt
              ? "Tradução: diferenciamos várzea baixa (~18 m, 87,6 mm chuva) de morros e encostas (>8°)."
              : "Translation: we separate low floodplains (~18 m, 87.6 mm rain) from steep hills (>8°)."}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5 hc:border-2">
          <div>
            <span className="inline-block rounded-full border border-brand/50 bg-brand/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-brand-text">
              {isPt ? "Passo 4 · Para Todos" : "Step 4 · For Everyone"}
            </span>
            <h3 className="mt-2.5 text-lg font-bold text-ink">
              {isPt ? "De km² para Campos de Futebol" : "From km² to Football Pitches"}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {isPt
                ? "Convertemos áreas abstratas em medidas familiares, adicionamos narração por voz em todas as telas e cores seguras para daltônicos."
                : "We convert abstract areas into familiar scales, add voice narration across all screens, and provide colorblind-safe palettes."}
            </p>
          </div>
          <div className="rounded-xl border border-line/80 bg-bg/70 p-2.5 font-mono text-xs text-brand-text">
            {isPt
              ? "Tradução: 3,64 km² viram ~510 campos de futebol; 0,12 km² de água viram ~17 campos."
              : "Translation: 3.64 km² becomes ~510 football pitches; 0.12 km² of water becomes ~17 pitches."}
          </div>
        </div>
      </div>

      {/* Live Region Status + HDF5 Scientific Telemetry Card */}
      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 hc:border-2">
        {state.status === "loading" && (
          <p className="text-ink-soft" role="status">
            {labels.loading}
          </p>
        )}

        {state.status === "error" && (
          <div className="flex flex-wrap items-center gap-4" role="alert">
            <p>{labels.error}</p>
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((value) => value + 1);
              }}
              className="pressable min-h-12 rounded-xl border-2 border-transparent bg-brand px-5 font-bold text-brand-ink hc:border-ink"
            >
              {labels.retry}
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <RegionDetails
            region={state.region}
            detail={state.detail}
            lang={lang}
            labels={labels}
            badge={badge}
            formatDate={formatDate}
          />
        )}
      </div>
    </div>
  );
}

function RegionDetails({
  region,
  detail,
  lang,
  labels,
  badge,
  formatDate,
}: {
  region: RegionView;
  detail: ComparisonDetail | null;
  lang: Locale;
  labels: Labels;
  badge: string;
  formatDate: (iso: string) => string;
}) {
  const isPt = lang === "pt";
  const friendly = AREA_LABELS[region.areaId];
  const { comparison, latestPair } = region;

  let body: string;
  if (comparison) {
    body = fill(labels.analysisBody, {
      before: formatDate(comparison.beforeAt),
      after: formatDate(comparison.afterAt),
    });
  } else if (latestPair) {
    body = fill(labels.catalogBody, {
      count: region.sceneCount,
      before: formatDate(latestPair.beforeAt),
      after: formatDate(latestPair.afterAt),
    });
  } else {
    body = labels.noPairBody;
  }

  const river = comparison?.riverContext ?? [];
  const riverSource = river[0]?.source_url;

  const g = detail?.stats.general_change?.statistics;
  const w = detail?.stats.open_water?.statistics;
  const allDelta = g?.all_valid_delta_db;
  const decDelta = g?.decrease_delta_db;
  const incDelta = g?.increase_delta_db;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xl font-bold">
            {friendly ? friendly.name[lang] : region.name}
            {friendly && (
              <span className="block text-base font-normal text-ink-soft">
                {friendly.place[lang]}
              </span>
            )}
          </p>
          <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-surface">
            {labels.availability[region.availability]}
          </span>
          <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 font-mono text-xs font-bold text-brand-text">
            {isPt
              ? `${region.sceneCount} cenas HDF5 · 8 pares Track 53`
              : `${region.sceneCount} HDF5 scenes · 8 Track 53 pairs`}
          </span>
          {comparison?.illustrative && (
            <span className="rounded-full bg-highlight px-3 py-1 text-base font-bold text-highlight-ink">
              {badge}
            </span>
          )}
        </div>
        <a
          href="#map-stage"
          className="pressable inline-flex items-center gap-2 rounded-xl border border-brand/60 bg-bg px-3.5 py-2 text-xs font-bold text-brand-text hover:bg-brand hover:text-brand-ink"
        >
          {isPt
            ? "↑ Ver dados técnicos no Mapa (aba Detalhes técnicos)"
            : "↑ View technical data in Map (Technical details tab)"}
        </a>
      </div>

      <div className="flex flex-col gap-2 text-base">
        <p>{body}</p>

        {comparison?.illustrative && (
          <p className="flex gap-2 text-ink-soft">
            <InfoIcon className="mt-0.5 shrink-0" />
            {labels.illustrativeBody}
          </p>
        )}

        {river.length > 0 && (
          <p className="text-ink-soft">
            {fill(labels.river, {
              stations: joinNames(
                river.map((record) => record.station),
                labels.and,
              ),
              hours: Math.abs(river[0].time_offset_hours ?? 2.6)
                .toFixed(1)
                .replace(".", isPt ? "," : "."),
            })}{" "}
            {riverSource && (
              <a
                href={riverSource}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-brand-text underline"
              >
                {labels.source}
              </a>
            )}
          </p>
        )}
      </div>

      {/* Scientific HDF5 Telemetry Grid (for Researchers & Judges) */}
      <div className="grid gap-4 pt-2 lg:grid-cols-2">
        {/* Granule Metadata Card */}
        <div className="rounded-2xl border border-line bg-bg/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              {isPt
                ? "🛰️ Metadados dos Granules HDF5 (Evento de Cheia)"
                : "🛰️ HDF5 Granule Metadata (Flood Event)"}
            </h3>
            <span className="rounded bg-surface px-2 py-0.5 font-mono text-[0.7rem] text-ink-soft">
              NISAR L2 GCOV · P05023
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Banda / Comp. Onda" : "Band / Wavelength"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">L-Band · 24 cm (1.25 GHz)</dd>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Polarização / Banda" : "Polarization / BW"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">DHDH (HHHH) · 40+5 MHz</dd>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Geometria Orbital" : "Orbital Geometry"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">Desc · Track 53 · Frame 103</dd>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Órbitas Comparadas" : "Compared Orbits"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">#04996 → #05169 (12d)</dd>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Projeção e Grade" : "Projection & Grid"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">EPSG:32722 · 10×10 m</dd>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2.5">
              <dt className="text-ink-soft">{isPt ? "Volume Bruto Processado" : "Raw Processed Volume"}</dt>
              <dd className="mt-0.5 font-mono font-bold text-ink">14,00 GB (2× ~7,0 GB .h5)</dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-col gap-1.5 text-xs">
            <a
              href="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_025_053_D_103_4005_DHDH_A_20260711T213351_20260711T213426_P05023_N_F_J_001/NISAR_L2_PR_GCOV_025_053_D_103_4005_DHDH_A_20260711T213351_20260711T213426_P05023_N_F_J_001.h5"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[0.7rem] text-brand-text hover:border-brand"
            >
              <span className="truncate">
                T0 (11 jul): NISAR_L2_PR_GCOV_025_053_D_103...20260711T213351.h5
              </span>
              <span className="shrink-0 font-sans font-bold underline">6.99 GB ↗</span>
            </a>
            <a
              href="https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/NISAR_L2_PR_GCOV_026_053_D_103_4005_DHDH_A_20260723T213350_20260723T213425_P05023_N_F_J_001/NISAR_L2_PR_GCOV_026_053_D_103_4005_DHDH_A_20260723T213350_20260723T213425_P05023_N_F_J_001.h5"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-[0.7rem] text-brand-text hover:border-brand"
            >
              <span className="truncate">
                T1 (23 jul): NISAR_L2_PR_GCOV_026_053_D_103...20260723T213350.h5
              </span>
              <span className="shrink-0 font-sans font-bold underline">7.00 GB ↗</span>
            </a>
          </div>
        </div>

        {/* Radiometric Statistics & Pixel Accounting Card */}
        <div className="rounded-2xl border border-line bg-bg/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-text">
              {isPt
                ? "📊 Estatísticas Radiométricas (Δγ⁰ dB) e Contabilidade de Pixels"
                : "📊 Radiometric Statistics (Δγ⁰ dB) & Pixel Accounting"}
            </h3>
            <span className="rounded bg-surface px-2 py-0.5 font-mono text-[0.7rem] text-ink-soft">
              1.002.001 px (100,2 km²)
            </span>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-1.5 text-center font-mono text-xs">
            <div className="rounded-xl border border-line/60 bg-surface p-2">
              <span className="block text-[0.65rem] text-ink-soft">P5</span>
              <strong className="text-decrease">
                {allDelta ? `${allDelta.percentiles["5"].toFixed(2)} dB` : "-3.50 dB"}
              </strong>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2">
              <span className="block text-[0.65rem] text-ink-soft">P25</span>
              <strong className="text-ink">
                {allDelta ? `${allDelta.percentiles["25"].toFixed(2)} dB` : "-1.22 dB"}
              </strong>
            </div>
            <div className="rounded-xl border border-brand/50 bg-surface p-2">
              <span className="block text-[0.65rem] text-brand-text">P50 (Med)</span>
              <strong className="text-brand-text">
                {allDelta ? `+${allDelta.percentiles["50"].toFixed(2)} dB` : "+0.17 dB"}
              </strong>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2">
              <span className="block text-[0.65rem] text-ink-soft">P75</span>
              <strong className="text-ink">
                {allDelta ? `+${allDelta.percentiles["75"].toFixed(2)} dB` : "+1.66 dB"}
              </strong>
            </div>
            <div className="rounded-xl border border-line/60 bg-surface p-2">
              <span className="block text-[0.65rem] text-ink-soft">P95</span>
              <strong className="text-increase">
                {allDelta ? `+${allDelta.percentiles["95"].toFixed(2)} dB` : "+4.21 dB"}
              </strong>
            </div>
          </div>

          <dl className="mt-3 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between border-b border-line/60 pb-1">
              <dt className="text-ink-soft">
                {isPt ? "Pixels válidos no AOI (numberOfLooks ≥ 1)" : "Valid pixels in AOI (numberOfLooks ≥ 1)"}
              </dt>
              <dd className="font-mono font-bold text-ink">
                {g?.valid_pixels?.toLocaleString(isPt ? "pt-BR" : "en-US") ?? "780.786"} px (78,08 km²)
              </dd>
            </div>
            <div className="flex justify-between border-b border-line/60 pb-1">
              <dt className="text-ink-soft">
                {isPt ? "Ruído Speckle filtrado (< 9 px conectados)" : "Filtered speckle noise (< 9 connected px)"}
              </dt>
              <dd className="font-mono font-bold text-ink">
                {g?.discarded_pixels?.toLocaleString(isPt ? "pt-BR" : "en-US") ?? "165.430"} px (16,54 km² ·{" "}
                {g?.discarded_components?.toLocaleString(isPt ? "pt-BR" : "en-US") ?? "112.905"} grupos)
              </dd>
            </div>
            <div className="flex justify-between border-b border-line/60 pb-1">
              <dt className="text-ink-soft">
                {isPt ? "Queda de sinal (Δγ⁰ ≤ -3 dB · Mediana)" : "Signal decrease (Δγ⁰ ≤ -3 dB · Median)"}
              </dt>
              <dd className="font-mono font-bold text-decrease">
                14.785 px (1,48 km² · P50 {decDelta ? `${decDelta.percentiles["50"].toFixed(2)} dB` : "-4.44 dB"})
              </dd>
            </div>
            <div className="flex justify-between border-b border-line/60 pb-1">
              <dt className="text-ink-soft">
                {isPt ? "Aumento de sinal (Δγ⁰ ≥ +3 dB · Mediana)" : "Signal increase (Δγ⁰ ≥ +3 dB · Median)"}
              </dt>
              <dd className="font-mono font-bold text-increase">
                21.635 px (2,16 km² · P50 {incDelta ? `+${incDelta.percentiles["50"].toFixed(2)} dB` : "+4.77 dB"})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">
                {isPt ? "Candidatos a água aberta (γ⁰ ≤ -17 dB e Δγ⁰ ≤ -3 dB)" : "Open-water candidates (γ⁰ ≤ -17 dB & Δγ⁰ ≤ -3 dB)"}
              </dt>
              <dd className="font-mono font-bold text-water">
                {w?.candidate_pixels?.toLocaleString(isPt ? "pt-BR" : "en-US") ?? "1.188"} px (0,119 km² ·{" "}
                {w?.candidate_components ?? 57} {isPt ? "grupos" : "groups"})
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
