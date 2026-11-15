<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SurfaceSignal — Frontend Architecture, Decisions & Concepts (`frontend/`)

This document records the core product concepts, architectural rules, UX decisions, and implementation status of the **SurfaceSignal** frontend (Team Sudo Nova — NASA Space Apps Challenge 2026, *Dancing with the SARs*).

---

## 1. Core Concept & Product Philosophy
- **Mission:** Translate complex NASA/ISRO **NISAR L2 GCOV** L-band (24 cm, HHHH) Synthetic Aperture Radar (SAR) data over the **Taquari Valley (Lajeado, Estrela, Cruzeiro do Sul — RS, Brazil)** into plain, accessible language for citizens while preserving full scientific rigor and HDF5 telemetry for researchers and Civil Defense specialists.
- **Strict Monorepo Scope:** The frontend (`frontend/`) is 100% isolated from backend processing (`backend/`). All data enters exclusively through `src/data/source.ts` (reading the versioned compact static snapshot in `public/data/compact/api/v1/` by default, or `NEXT_PUBLIC_API_BASE_URL` in API mode).
- **Honest Scientific Communication:**
  - Never claim a radar threshold alone proves flood or landslide truth without field/optical/InSAR validation.
  - Convert abstract areas (`km²`) into everyday scales (**football pitches** of `105 m × 68 m = 0.00714 km²`, e.g., `3.64 km² ≈ 510 football pitches`).

---

## 2. Accessibility First — Explicit Minority & Audience Mapping (`AccessibilityMenu.tsx`)
All accessibility customizations live inside the header's **`♿ Acessibilidade / Accessibility`** menu (`src/components/AccessibilityMenu.tsx` + `src/preferences/`). Each control displays an explicit target-audience badge so judges and visitors immediately see **who** it serves:
1. **Tamanho do texto (`Normal / Grande / Muito grande`):** Badge `👵 Idosos · Baixa visão` (*Older adults · Low vision*). Scales root `html` font size in `rem`; all flex controls use `shrink-0` so text never overflows buttons in `xl` mode.
2. **Alto contraste (`contrast: "high"`):** Badge `👁️ Deficiência visual · Catarata` (*Visual impairment · Glare sensitivity*). Pure black `#000` background with `>17:1` yellow/white contrast.
3. **Modo daltônico (`colorblind: true`):** Badge `🎨 Daltonismo (Deuteranopia / Protanopia)` (*Color blindness*). Replaces the blue map basemap (`recolourBasemap` in `MapView.tsx`) with neutral charcoal (`#1a1f2c`), gold (`#f0e442`) outlines/relief/river, cyan (`#00e5ff`) water, and magenta (`#ff4d94`) signal increase.
4. **Leitura espaçada (`readingSpacing: true`):** Badge `📖 Dislexia · TDAH · Idosos` (*Dyslexia · ADHD · Seniors*). Widens letter, word, and line spacing (`html[data-spacing="wide"]`).
5. **Voz pausada (`speechSlow: true`) + Botões `🔊 Ouvir / Listen` (`SpeakButton` / `ListenButton`):** Badge `🔊 Baixa visão · Leitura por áudio` (*Low vision · Audio-first reading*). Present on every page section, inside the map's Left Panel, Right Panel (*"Durante a cheia"*), Hotspot Popups (`Q1–Q6`), and Guided Tour.
6. **Reduzir movimento (`motion: "reduce"`):** Badge `🌀 Labirintite · Sensibilidade vestibular` (*Vestibular sensitivity · Motion sickness*). Disables camera flights and river animations.
7. **Surdos e Deficiência Auditiva:** Explicit visual note explaining that because sirens and radio warnings do not reach deaf residents, all flood/radar context is 100% visual and plain-text.

---

## 3. Interactive Map & Visual Decisions (`src/components/map/`)
- **Interactive Globe Loading Screen (`GlobeLoader.tsx`):** Shown during initial WebGL/MapLibre initialization so the user never sees an unstyled flash.
- **Language Auto-Detection & Map State Persistence (`LanguageSwitch.tsx`, `MapStage.tsx`):**
  - Entry route (`/`) detects `navigator.languages`: Portuguese (`pt*`) routes to `/pt/`, and all other languages default to `/en/` for international judges.
  - Switching `PT ↔ EN` while on the map saves `{ phase, placeId, view, selectedId, selectedHotspotId, satelliteImagery }` in `sessionStorage` so the user stays right on the map without resetting to the hero screen.
- **Top-Right View Controls (`?` · `🛰️ Satélite` · `2D` · `3D`):**
  - **`🛰️ Satélite (Foto real 2D)`:** Placed right next to the `2D / 3D` switch. Overlays Esri World Imagery aerial photography underneath the radar patches (`SATELLITE_LAYER` in `MapView.tsx`).
  - **2D-Only Rule for Satellite Photo:** Because 3D mode (`relief === true`) renders opaque hillshade/elevation color layers (`relief-color`, `relief-shade`) over the base, the satellite photo toggle is enabled **only in 2D mode**. Clicking `3D` automatically turns `satelliteImagery` off and immediately hides `SATELLITE_LAYER` (without waiting for `map.isStyleLoaded()`, which becomes `false` while 3D terrain tiles load).
- **5-Step Spotlight Guided Tour (`MapTour.tsx`):**
  - Opens automatically when entering the Taquari Valley close-up (`useAutoValleyTour`), and can be reopened anytime via the `?` button.
  - Dynamically measures target DOM rectangles (`getBoundingClientRect`) to illuminate:
    1. Center of the map (`Q1–Q6` inspection squares),
    2. Top-right controls (`🛰️ Satélite`, `2D`, and `3D` buttons summary),
    3. Right panel (Flood summary, layer cards, environmental crossings),
    4. Bottom timeline ruler & 2-period comparator,
    5. Left panel (`Q1–Q6` shortcuts, 3D relief toggle, and HDF5 technical details).
- **Inspection Squares `Q1–Q6` (`hotspots.ts`, `HotspotPopup.tsx`):**
  - 6 curated hotspots covering floodplains (`Q1–Q4`), bridges/infrastructure (`Q5`), and steep hillslopes (`Q6`, ~58 m elevation, ~8.5° slope in Copernicus DEM 30m).
  - Clicking a square zooms in and opens a compact floating side popup (positioned at `top-20 left-4`, never covering the center map or bottom timeline) with a large satellite photo and single-open accordion sections.
- **Zero-Flicker Right Panel During Timeline Scrubbing (`ComparePanel.tsx`, `useEnvironmental.ts`, `MapStage.tsx`):**
  - When scrubbing between timeline dates, `MapStage.tsx` and `useEnvironmental.ts` retain the previous step's loaded `detail` and `environmental.report` until the new JSON resolves, while `ComparePanel.tsx` locks a minimum height (`min-h-[12.5rem]`) and applies a smooth `animate-pulse` skeleton state. This prevents the right panel and timeline from jumping or flashing.

---

## 4. RoamingEye-Style Timeline & Non-Sequential Comparator (`Timeline.tsx`, `region.ts`)
- **Draggable Tick Ruler:** Inspired by NASA's *RoamingEye* UI, featuring all **8 consecutive Descending Track 53 comparisons** (`17 Jun` to `15 Oct 2026`), smooth pointer-capture scrubbing (`onPointerDown / Move / Up`), vertical ruler ticks, month labels, a mini dB scale (`-17 dB` to `+3 dB`), and a fixed-height bottom status row.
- **Non-Sequential 2-Period Comparator (`⇄ Comparar 2 períodos`):**
  - Allows comparing any **Period A (Base)** and **Period B (Compared)** (with quick presets for *"⚡ 1st vs. Latest (Jun × Oct)"* and *"🌊 Flood vs. Latest (Jul × Oct)"*).
  - Includes an explicit **`✓ Confirmar e comparar no mapa` (`Confirm & compare on map`)** button that activates an on-map comparison bar (`⚡ COMPARANDO NO MAPA`), letting the user toggle the map polygons between Period A and Period B in 1 click, view the `Δ km²` difference, and exit anytime via **`✕ Sair da comparação` (`Exit comparison`)**.

---

## 5. HDF5 Translation Pipeline & Scientific Telemetry (`RegionStatus.tsx`, `ComparisonInfo.tsx`)
- **Section `03` (`Dos dados técnicos HDF5 à linguagem simples` in `RegionStatus.tsx`):**
  - Explains our 4-step translation pipeline:
    1. Raw ~7 GB NASA `NISAR_L2_PR_GCOV` HDF5 granule (`L-band 24 cm, HHHH, EPSG:32722, 10×10 m`) → clipped to `780,786 valid pixels` (`78.08 km²`).
    2. Physical speckle noise filtering (`4-connectivity`, `< 9 pixels / 900 m²` discarded = `112,905 noise specks removed`) and dB thresholds (`|Δγ⁰| ≥ 3.0 dB`, `γ⁰ ≤ -17.0 dB` for open water).
    3. Environmental crossing with 72h rainfall (`CHIRPS`, `87.6 mm`), river bulletins (`SGB`), land cover (`ESA WorldCover 10m`), and terrain (`Copernicus DEM 30m`).
    4. Plain-language conversion (`km²` → football pitches, audio read-aloud, and colorblind-safe palettes).
  - Displays the full **HDF5 Scientific Telemetry Grid** (Orbits `#04996 → #05169`, Track `53`, Frame `103`, `DHDH 40+5 MHz`, `Δγ⁰` percentiles `P5, P25, P50, P75, P95`, pixel accounting, and direct NASA Earthdata `.h5` download links).
  - Includes a plain-text pointer (no broken anchor button) noting that this telemetry is also available for every pass inside the map's left panel (`"Detalhes técnicos"` tab in `ComparisonInfo.tsx`).

---

## 6. SEO, GEO (Generative Engine Optimization) & Typography (`layout.tsx`, `globals.css`)
- **Social Preview, SEO & GEO (`src/app/[lang]/layout.tsx`):**
  - Full `openGraph`, `twitter` (`summary_large_image`), `alternates.languages`, geographic meta tags (`geo.region: BR-RS`, `geo.position: -29.467;-51.961`), academic citation tags, and a structured `Schema.org` `JSON-LD` `@graph` (`WebApplication` + `Dataset`) for AI search engines (ChatGPT, Gemini, Perplexity) and Google Dataset Search.
- **Typography (`Google Sans` / `Plus Jakarta Sans` in `src/app/globals.css`):**
  - Configured via `--font-sans` and `--font-mono` in `globals.css` (lines 102–107) to eliminate the slashed zeros (`51Ø`, `Ø,12 km²`) of `Atkinson Hyperlegible`. The previous font variable remains commented right above `--font-sans` for instant 1-line reversion if needed.
