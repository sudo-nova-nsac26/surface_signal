"use client";

import type { Locale } from "@/i18n/config";

/**
 * Interactive-looking 3D-style spinning globe + radar scan loader shown while
 * the initial language route or WebGL MapLibre globe is initializing.
 */
export function GlobeLoader({
  lang,
  overlay = false,
}: {
  lang?: Locale;
  overlay?: boolean;
}) {
  const title =
    lang === "pt"
      ? "Preparando o globo e os sinais de radar…"
      : lang === "en"
        ? "Preparing the globe and radar signals…"
        : "Preparing globe & radar · Preparando o globo…";

  const subtitle =
    lang === "pt"
      ? "Carregando relevo 3D e recortes do satélite NISAR (NASA–ISRO)"
      : lang === "en"
        ? "Loading 3D relief and NASA–ISRO NISAR satellite passes"
        : "NASA–ISRO NISAR · SurfaceSignal";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${
        overlay ? "pointer-events-auto absolute inset-0 z-40" : "min-h-screen w-full"
      } flex flex-col items-center justify-center bg-[#050b14] px-6 py-12 text-slate-100 select-none`}
    >
      {/* Ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl"
      />

      {/* Spinning 3D-style Globe + Orbiting NISAR Radar */}
      <div className="relative flex size-44 items-center justify-center">
        {/* Outer radar pulse rings */}
        <span
          aria-hidden="true"
          className="absolute inset-2 animate-ping rounded-full border border-cyan-400/25 [animation-duration:2.6s]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-spin rounded-full border border-dashed border-cyan-400/40 [animation-duration:14s]"
        />

        {/* Orbiting satellite dot */}
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-spin [animation-duration:4.5s]"
        >
          <span className="absolute -top-1.5 left-1/2 flex size-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-cyan-300 shadow-[0_0_14px_#22d3ee]">
            <span className="size-1.5 rounded-full bg-slate-950" />
          </span>
        </div>

        {/* Globe sphere */}
        <div className="relative size-32 overflow-hidden rounded-full border-2 border-cyan-400/70 bg-gradient-to-br from-[#0c243d] via-[#071526] to-[#030710] shadow-[inset_-14px_-14px_28px_rgba(0,0,0,0.85),inset_8px_8px_20px_rgba(34,211,238,0.22),0_0_35px_rgba(34,211,238,0.28)]">
          {/* Animated sliding continents / meridians SVG */}
          <svg
            aria-hidden="true"
            viewBox="0 0 240 120"
            className="h-full w-[200%] animate-[globeSlide_7s_linear_infinite] opacity-85"
          >
            <defs>
              <linearGradient id="radarBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Latitude lines */}
            <line x1="0" y1="25" x2="240" y2="25" stroke="#22d3ee" strokeOpacity="0.18" strokeWidth="0.8" />
            <line x1="0" y1="60" x2="240" y2="60" stroke="#22d3ee" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="0" y1="95" x2="240" y2="95" stroke="#22d3ee" strokeOpacity="0.18" strokeWidth="0.8" />

            {/* Stylized continents & river basins (repeated twice for seamless 200% loop) */}
            {[0, 120].map((offset) => (
              <g key={offset} transform={`translate(${offset}, 0)`}>
                {/* Meridians */}
                <path d="M20,0 Q32,60 20,120" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="0.9" />
                <path d="M60,0 Q72,60 60,120" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="0.9" />
                <path d="M100,0 Q112,60 100,120" fill="none" stroke="#22d3ee" strokeOpacity="0.2" strokeWidth="0.9" />

                {/* Stylized Americas / South America */}
                <path
                  d="M28,18 C36,16 44,22 42,32 C39,40 34,44 38,52 C45,56 54,64 52,78 C49,92 43,104 38,108 C34,102 35,88 33,76 C30,66 24,58 26,48 C28,36 22,24 28,18 Z"
                  fill="#0ea5e9"
                  fillOpacity="0.28"
                  stroke="#38bdf8"
                  strokeOpacity="0.65"
                  strokeWidth="1.1"
                />
                {/* Highlight dot over Southern Brazil (Taquari Valley) */}
                <circle cx="47" cy="84" r="2.8" fill="#22d3ee" />
                <circle cx="47" cy="84" r="6" fill="none" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="1" />

                {/* Stylized Afro-Eurasia */}
                <path
                  d="M76,22 C90,16 108,20 112,34 C114,46 104,54 98,64 C94,76 92,92 84,96 C78,90 78,74 74,62 C68,50 66,30 76,22 Z"
                  fill="#0ea5e9"
                  fillOpacity="0.22"
                  stroke="#38bdf8"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
              </g>
            ))}

            {/* Radar scan sweep */}
            <rect x="0" y="0" width="240" height="120" fill="url(#radarBeam)" />
          </svg>

          {/* Specular highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.22),transparent_55%)]"
          />
        </div>
      </div>

      {/* Brand + status copy */}
      <div className="relative mt-6 flex max-w-md flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-950/60 px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan-300">
          <span className="size-2 animate-pulse rounded-full bg-cyan-300" />
          SurfaceSignal · Radar SAR
        </div>
        <p className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {title}
        </p>
        <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>

        {/* Smooth indeterminate loading bar */}
        <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-800/90">
          <div className="h-full w-1/2 animate-[loaderBar_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-400" />
        </div>
      </div>

      <style>{`
        @keyframes globeSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes loaderBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

