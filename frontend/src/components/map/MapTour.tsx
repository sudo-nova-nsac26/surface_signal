"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { SpeakButton } from "@/components/ui/SpeakButton";

interface TourStep {
  badge: { pt: string; en: string };
  targetLabel: { pt: string; en: string };
  title: { pt: string; en: string };
  body: { pt: string; en: string };
  tip: { pt: string; en: string };
  /** Optional DOM selector inside #map to measure exact pixel bounds */
  targetSelector?: string;
  /** Fallback Tailwind classes for the spotlight frame */
  spotlightClass: string;
  /** Fallback Tailwind classes for the explanation card */
  cardClass: string;
  /** Direction arrow badge shown on the spotlight */
  arrow: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  containerWidth: number;
  containerHeight: number;
}

const STEPS: TourStep[] = [
  {
    badge: { pt: "Passo 1 de 5 · Centro do mapa", en: "Step 1 of 5 · Center of the map" },
    targetLabel: { pt: "📍 Quadradinhos Q1 a Q6 no Vale", en: "📍 Squares Q1 to Q6 in the Valley" },
    title: {
      pt: "Clique nos quadradinhos para inspecionar cada local",
      en: "Click the squares to inspect each spot",
    },
    body: {
      pt: "No mapa estão os pontos Q1 a Q6 sobre áreas de várzea, bairros urbanos e encostas. Ao clicar em um quadrado, o mapa aproxima e abre um popup lateral com foto de satélite real e o Antes x Depois. Clicando de novo no quadrado, a câmera volta!",
      en: "On the map, squares Q1 to Q6 mark floodplains, urban areas, and hillslopes. Clicking a square zooms in and opens a side popup with a real satellite photo and Before vs. After. Clicking it again restores the camera!",
    },
    tip: {
      pt: "Dica: clique em qualquer quadrado tracejado (como Q2 no rio ou Q6 nas encostas) para abrir a análise local.",
      en: "Tip: click any dashed square (like Q2 on the river or Q6 on the hillslopes) to open the local analysis.",
    },
    spotlightClass:
      "inset-x-4 top-16 bottom-36 lg:left-[20.5rem] lg:right-[25rem] lg:top-16 lg:bottom-36 rounded-3xl",
    cardClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,26rem)]",
    arrow: "🎯",
  },
  {
    badge: { pt: "Passo 2 de 5 · Botões Satélite, 2D e 3D", en: "Step 2 of 5 · Satellite, 2D, and 3D buttons" },
    targetLabel: { pt: "🛰️ Foto de Satélite (2D) · 2D Plano · 3D Relevo", en: "🛰️ Satellite Photo (2D) · 2D Flat · 3D Relief" },
    title: {
      pt: "Alterne entre 2D, Foto Real de Satélite e Relevo 3D",
      en: "Switch between 2D, Real Satellite Photo, and 3D Relief",
    },
    body: {
      pt: "• 2D (Mapa plano): visão leve de cima, ideal para ver ruas e bairros.\n• 🛰️ Satélite (Foto real 2D): troca o fundo escuro pela foto aérea real de alta resolução de Lajeado e Estrela por baixo das manchas do radar.\n• 3D (Globo e relevo): ergue os morros e encostas do Vale (desliga a foto 2D automaticamente).",
      en: "• 2D (Flat map): light top-down view, ideal for streets and neighborhoods.\n• 🛰️ Satellite (2D photo): swaps the dark base for high-res aerial imagery of Lajeado and Estrela underneath the radar patches.\n• 3D (Globe & relief): raises the Valley's real hills and slopes (automatically turns off the 2D photo).",
    },
    tip: {
      pt: "Dica: para ver a foto real de satélite por baixo das manchas de água, certifique-se de estar no modo 2D!",
      en: "Tip: to see the real satellite photo under the water patches, make sure you are in 2D mode!",
    },
    targetSelector: '[data-tour="top-controls"]',
    spotlightClass:
      "inset-x-3 top-3 h-16 lg:left-auto lg:right-3 lg:top-3 lg:w-[32rem] lg:h-16 rounded-2xl",
    cardClass:
      "left-1/2 top-24 -translate-x-1/2 lg:left-auto lg:right-6 lg:top-24 lg:translate-x-0 w-[min(92vw,26rem)]",
    arrow: "☝️",
  },
  {
    badge: { pt: "Passo 3 de 5 · Painel da direita", en: "Step 3 of 5 · Right panel" },
    targetLabel: { pt: "🎨 Resumo da cheia e cartões de camadas", en: "🎨 Flood summary and layer cards" },
    title: {
      pt: "Ligue e desligue as camadas e veja os cruzamentos reais",
      en: "Toggle radar layers and inspect real environmental crossings",
    },
    body: {
      pt: "Aqui na direita você vê o resumo da passagem selecionada (chuva de 3 dias, divisão por município e altitude média) e liga/desliga os 3 sinais do satélite: Água (azul claro), Sinal mais fraco (azul escuro) e Sinal mais forte (laranja).",
      en: "Here on the right you see the selected pass summary (3-day rainfall, municipal share, and mean elevation) and toggle the 3 satellite signals: Water (light blue), Weaker signal (dark blue), and Stronger signal (orange).",
    },
    tip: {
      pt: "Role esse painel para ver os cruzamentos com IBGE, uso do solo (ESA), chuva diária (CHIRPS) e nível do rio (SGB).",
      en: "Scroll this panel to see crossings with IBGE, land cover (ESA), daily rainfall (CHIRPS), and river level (SGB).",
    },
    targetSelector: '[data-tour="right-panel"]',
    spotlightClass:
      "inset-x-3 top-20 bottom-6 lg:left-auto lg:right-16 lg:top-20 lg:bottom-6 lg:w-[22.25rem] rounded-3xl",
    cardClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-auto lg:right-[25rem] lg:top-24 lg:translate-x-0 lg:translate-y-0 w-[min(92vw,24.5rem)]",
    arrow: "👉",
  },
  {
    badge: { pt: "Passo 4 de 5 · Linha do tempo (embaixo)", en: "Step 4 of 5 · Timeline (bottom)" },
    targetLabel: { pt: "🗓️ Régua de passagens e Comparador de 2 períodos", en: "🗓️ Pass ruler and 2-period Comparator" },
    title: {
      pt: "Arraste a régua no tempo ou compare 2 períodos",
      en: "Drag the timeline ruler or compare any 2 periods",
    },
    body: {
      pt: "O satélite NISAR passa a cada 12 dias. Arraste a bolinha branca na régua (ou aperte Play ▶) para viajar de junho a outubro de 2026. Quer comparar a 1ª leitura com a última? Clique em '⇄ Comparar 2 períodos'!",
      en: "The NISAR satellite passes every 12 days. Drag the white thumb along the ruler (or press Play ▶) to travel from June to October 2026. Want to compare the 1st reading with the latest? Click '⇄ Compare 2 periods'!",
    },
    tip: {
      pt: "Os tracinhos coloridos na régua marcam dias de chuva forte (CHIRPS) e boletins do rio (SGB).",
      en: "The colored ticks along the ruler mark heavy rain days (CHIRPS) and river bulletins (SGB).",
    },
    targetSelector: '[data-tour="timeline"]',
    spotlightClass:
      "inset-x-3 bottom-4 h-36 lg:left-4 lg:right-[26.5rem] lg:bottom-6 lg:h-[8.25rem] rounded-3xl",
    cardClass:
      "left-1/2 bottom-44 -translate-x-1/2 lg:left-16 lg:bottom-[10.5rem] lg:translate-x-0 w-[min(92vw,26rem)]",
    arrow: "👇",
  },
  {
    badge: { pt: "Passo 5 de 5 · Painel da esquerda", en: "Step 5 of 5 · Left panel" },
    targetLabel: { pt: "🧭 Pontos Q1–Q6, relevo 3D e dados HDF5", en: "🧭 Spots Q1–Q6, 3D relief, and HDF5 data" },
    title: {
      pt: "Acesse os pontos Q1–Q6, ligue o Relevo 3D e explore",
      en: "Jump to spots Q1–Q6, enable 3D Relief, and explore",
    },
    body: {
      pt: "Na esquerda você clica direto nos quadradinhos (Q1 a Q6), ativa o Relevo 3D dos morros (Copernicus 30m) e abre as abas 'Entender esta comparação', 'Outras camadas' e 'Detalhes técnicos' (com dados brutos HDF5).",
      en: "On the left you can jump directly to squares Q1 to Q6, enable 3D hill relief (Copernicus 30m), and open 'Understand this comparison', 'Other layers', and 'Technical details' (with raw HDF5 data).",
    },
    tip: {
      pt: "No topo direito você encontra o botão '♿ Acessibilidade' (pensado para idosos, daltônicos, baixa visão e dislexia) e o botão '?' para reabrir este tour.",
      en: "At the top right you will find the '♿ Accessibility' button (designed for older adults, colorblind users, low vision, and dyslexia) and the '?' button to reopen this tour.",
    },
    targetSelector: '[data-tour="left-panel"]',
    spotlightClass:
      "inset-x-3 top-20 bottom-36 lg:left-4 lg:right-auto lg:top-[5rem] lg:h-[29rem] lg:w-[19rem] rounded-3xl",
    cardClass:
      "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:left-[21rem] lg:top-20 lg:translate-x-0 lg:translate-y-0 w-[min(92vw,24.5rem)]",
    arrow: "👈",
  },
];

/**
 * Opens the guided tour every time the user enters the Lajeado/Estrela valley
 * analysis screen (`activeInValley` transitions to true).
 */
export function useAutoValleyTour(activeInValley: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!activeInValley) return;
    const timer = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(timer);
  }, [activeInValley]);

  const closeTour = () => {
    setOpen(false);
  };

  return {
    tourOpen: open,
    setTourOpen: setOpen,
    closeTour,
  };
}

export function MapTour({
  lang,
  open,
  onClose,
}: {
  lang: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [measuredRect, setMeasuredRect] = useState<SpotlightRect | null>(null);

  const step = STEPS[stepIdx] ?? STEPS[0];

  // Dynamically measure the exact bounding box of the target element inside #map
  useEffect(() => {
    if (!open) return;

    const updateRect = () => {
      if (!step.targetSelector || typeof window === "undefined" || window.innerWidth < 1024) {
        setMeasuredRect(null);
        return;
      }
      const mapEl = document.getElementById("map");
      const targetEl = mapEl?.querySelector<HTMLElement>(step.targetSelector);
      if (!mapEl || !targetEl) {
        setMeasuredRect(null);
        return;
      }
      const mapBox = mapEl.getBoundingClientRect();
      const targetBox = targetEl.getBoundingClientRect();
      if (targetBox.width === 0 || targetBox.height === 0) {
        setMeasuredRect(null);
        return;
      }
      setMeasuredRect({
        top: Math.max(8, targetBox.top - mapBox.top - 4),
        left: Math.max(8, targetBox.left - mapBox.left - 4),
        width: targetBox.width + 8,
        height: targetBox.height + 8,
        containerWidth: mapBox.width,
        containerHeight: mapBox.height,
      });
    };

    updateRect();
    const timer = window.setTimeout(updateRect, 120);
    window.addEventListener("resize", updateRect);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, stepIdx, step.targetSelector]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isLast = stepIdx === STEPS.length - 1;
  const speechText = `${step.title[lang]}. ${step.body[lang]} ${step.tip[lang]}`;

  const finish = () => {
    setStepIdx(0);
    onClose();
  };

  // Compute exact pixel positioning for the card when we have a measured spotlight
  const cardInlineStyle: React.CSSProperties | undefined = (() => {
    if (!measuredRect) return undefined;
    if (step.targetSelector === '[data-tour="top-controls"]') {
      return {
        right: "20px",
        top: `${Math.max(88, measuredRect.top + measuredRect.height + 18)}px`,
        left: "auto",
        bottom: "auto",
        transform: "none",
      };
    }
    if (step.targetSelector === '[data-tour="timeline"]') {
      // Place card cleanly 22px ABOVE the measured top of the timeline
      const bottomPx = measuredRect.containerHeight - measuredRect.top + 22;
      return {
        left: `${Math.max(24, measuredRect.left + 24)}px`,
        bottom: `${Math.max(140, bottomPx)}px`,
        top: "auto",
        transform: "none",
      };
    }
    if (step.targetSelector === '[data-tour="left-panel"]') {
      return {
        left: `${measuredRect.left + measuredRect.width + 20}px`,
        top: `${Math.max(64, measuredRect.top)}px`,
        bottom: "auto",
        transform: "none",
      };
    }
    if (step.targetSelector === '[data-tour="right-panel"]') {
      const rightPx = measuredRect.containerWidth - measuredRect.left + 20;
      return {
        right: `${rightPx}px`,
        top: `${Math.max(64, measuredRect.top + 8)}px`,
        left: "auto",
        bottom: "auto",
        transform: "none",
      };
    }
    return undefined;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === "pt" ? "Tour guiado do mapa" : "Guided map tour"}
      className="pointer-events-auto absolute inset-0 z-30 overflow-hidden"
    >
      {/* Click outside backdrop to close */}
      <div
        onClick={finish}
        aria-hidden="true"
        className="absolute inset-0 cursor-pointer"
      />

      {/* Illuminated Spotlight Frame that darkens everything outside it via huge box-shadow */}
      <div
        aria-hidden="true"
        style={
          measuredRect
            ? {
                top: `${measuredRect.top}px`,
                left: `${measuredRect.left}px`,
                width: `${measuredRect.width}px`,
                height: `${measuredRect.height}px`,
                right: "auto",
                bottom: "auto",
              }
            : undefined
        }
        className={`pointer-events-none absolute rounded-3xl border-2 border-cyan-400 transition-all duration-300 ease-out shadow-[0_0_0_9999px_rgba(2,8,18,0.82),0_0_32px_rgba(34,211,238,0.45),inset_0_0_24px_rgba(34,211,238,0.18)] ${
          measuredRect ? "" : step.spotlightClass
        }`}
      >
        <span className="absolute -top-3.5 left-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-300 bg-cyan-400 px-3 py-0.5 text-xs font-extrabold text-slate-950 shadow">
          <span>{step.arrow}</span>
          <span>{step.targetLabel[lang]}</span>
        </span>
      </div>

      {/* Explanation Card positioned right next to the highlighted spotlight */}
      <div
        style={cardInlineStyle}
        className={`rise-in absolute z-10 rounded-3xl border-2 border-cyan-400/70 bg-slate-950/95 p-5 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.9)] transition-all duration-300 ease-out ${step.cardClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/50 bg-cyan-950/80 px-3 py-0.5 text-xs font-extrabold text-cyan-300">
            {step.badge[lang]}
          </span>
          <div className="flex items-center gap-1.5">
            <SpeakButton text={speechText} lang={lang} />
            <button
              type="button"
              onClick={finish}
              aria-label={lang === "pt" ? "Fechar tutorial" : "Close tour"}
              className="flex size-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-slate-200 hover:border-cyan-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <h3 className="mt-3 text-lg font-extrabold leading-snug text-white sm:text-xl">
          {step.title[lang]}
        </h3>

        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-200">
          {step.body[lang]}
        </p>

        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-2.5 text-xs leading-relaxed text-cyan-200">
          💡 {step.tip[lang]}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStepIdx(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIdx ? "w-6 bg-cyan-400" : "w-2 bg-slate-700 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIdx > 0 ? (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-cyan-400"
              >
                {lang === "pt" ? "← Anterior" : "← Back"}
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200"
              >
                {lang === "pt" ? "Pular" : "Skip"}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLast) finish();
                else setStepIdx((i) => i + 1);
              }}
              className="rounded-xl bg-cyan-400 px-4 py-1.5 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-300"
            >
              {isLast
                ? lang === "pt"
                  ? "Concluir ✓"
                  : "Finish ✓"
                : lang === "pt"
                  ? "Próximo →"
                  : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
