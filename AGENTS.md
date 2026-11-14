# SurfaceSignal development

This project contains a private exploratory prototype.
Do not merge this prototype into a competition submission without documented GO Team clearance.
Preserve dates/history. Keep main stable; target develop in draft PRs. Use Conventional Commits.

Python 3.12, FastAPI/Pydantic v2, offline processing via CLI; read-only API.
From backend: `uv sync --frozen --extra dev`, `uv run ruff check .`,
`uv run ruff format --check .`, `uv run pytest -q`.

Never commit credentials, Earthdata tokens, .netrc, heavy HDF5, raw private data.
Only real diagonal GCOV power terms use 10*log10. No inferred flood truth from a threshold.
Require comparable scene metadata and enforce memory/download budgets.
Mark synthetic data explicitly. Every output must preserve sources, parameters and hashes.
No public license or visibility change without repository owner authorization.

---

# Front-end (`frontend/`)

Notes for anyone (human or agent) working on the web app. The backend rules above
still apply to everything under `backend/`. This section is the front-end's memory:
what the project is, how the app is built, and what comes next. **Keep it current:**
when you finish or change something listed here, update this file in the same change.

## What we are building

**SurfaceSignal**, the Sudo Nova team's entry for the NASA Space Apps Challenge 2026,
challenge *Dancing with the SARs* (NISAR radar, https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/).
It turns NISAR radar changes around Lajeado and Estrela (Taquari Valley, Rio Grande do Sul)
into something anyone can understand, with the July 2026 flood as the anchor case
(NISAR passes 2026-07-11 and 2026-07-23; SGB bulletin 2026-07-23 16:00 BRT, river above
flood level and falling, 2 h 34 min before the pass).

**Audience, in this order:** older adults (RS is Brazil's oldest state), deaf and hard-of-hearing
people (sirens and radio do not reach them), and anyone with no technical background.
Judges also read it, so submission material is English. Judging criteria: Impact, Creativity,
Validity, Relevance, Presentation.

**Rules that shape every decision**

- No radar jargon in the interface (no "backscatter", "dB", "coherence"). Plain words, large text.
- Never say "alert" or "risk". It is *what the satellite saw*. A candidate is not a confirmed flood.
  The "not an official alert" notice (199 / 193 / SMS 40199) stays on the page.
- Honest data: anything not real is labelled ("Dado ilustrativo"); unmeasured values are `null`, never 0.
  Layers: water = main; vegetation = exploratory; slopes = unavailable (needs InSAR), never invented.
- Colour is never the only signal (icon + text too). Data colours are Okabe-Ito; brand colours are
  space navy, cyan, white and amber (from the Sudo Nova logo), for identity only.
- Everything is sized in `rem`; touch targets >= 48 px; focus ring always visible; bilingual PT/EN.
- Weak phones matter: no heavy libraries, SVG/CSS over images, only `transform` and `opacity` animate.
- AI use must be declared (README credits + the Space Apps form). No NASA logos or branding in generated content.

## Stack and how to run

Next.js 16 (App Router, TypeScript, Tailwind 4), MapLibre GL JS 6 (no keys: OpenFreeMap tiles,
Mapzen terrain on AWS). No Docker, no database. **Read `frontend/node_modules/next/dist/docs/` before
using a Next.js API: this version differs from older ones.**

```bash
cd frontend && npm install && npm run dev      # http://localhost:3000
npm run lint && npm run build                  # must pass before every commit
```

If CSS looks stale after edits, restart `npm run dev` (Turbopack caches it).

## Architecture

```text
src/app/[lang]/        pages per language (/pt, /en); "/" redirects via src/proxy.ts
src/i18n/              dictionaries; pt.ts defines the shape, en.ts must match
src/preferences/       text size, contrast, motion (3 levels); boot script runs before first paint
src/data/              THE data layer
  source.ts            the only door to data: API mode (NEXT_PUBLIC_API_BASE_URL) or static snapshot
  api-types.ts         mirrors backend/src/surfacesignal/domain.py and docs/api-contract.md
  region.ts            backend records -> what the UI says (region state, timeline)
  area-labels.ts       everyday names for backend area ids
src/components/map/    the map (see below)
public/data/api/v1/    static snapshot of API responses (real AOI + real 19-scene catalog + 1 synthetic sample)
public/data/boundaries IBGE / Natural Earth outlines (credits in its README)
```

**Data rule:** components never read files or build API URLs. They call `src/data/source.ts`.
Switching to the real backend is configuration only. If the backend contract changes, edit
`api-types.ts` and `region.ts` only.

**Map** (`src/components/map`): `MapStage` is the whole first screen (intro, then full-screen map with
quiet controls). `MapView` owns MapLibre. `places.ts` is a tree (world > country > state > region of the state):
bright dots open a place, `UPCOMING` places are dark locked dots. Each place can carry a strong `outline`
and a `focus` (the world is framed on Brazil). `Timeline.tsx` draws real passes, published analyses and
river bulletins. `hardware.ts` picks 3D or 2D at "Start" (device report + 1.5 s smoothness probe);
the visitor's own 2D/3D choice always wins. 2D is the safe default.

**Hard-won lessons**

- MapLibre `easeTo` stops the previous move and stopping fires `moveend`: never restart an animation from
  a `moveend` handler without a re-entrancy guard (this froze the page once).
- Do not re-apply projection/terrain on every camera change: it interrupts flights.
- The map is created when the browser is idle so the page paints first; the worker file is copied to
  `public/vendor` by `scripts/copy-map-worker.mjs` (not committed).
- Browsers/Windows with "reduce animations" get *gentle* motion, not none; the in-app switch overrides the device.

## Workflow

Git flow: `feature/*` -> `develop` -> `main`, small Conventional Commits, draft PRs, never push to
`develop`/`main` directly. **Ask the owner before any push.** Never commit tokens, `.env*`, HDF5 or
anything private. The backend branch history is owned by Mateus; do not rewrite it. The repo is
public: check what you stage.

## Status (update as you go)

Done: scaffold, PT/EN, accessibility panel, data layer with API/static switch, Sudo Nova theme,
full-screen guided map (2D/3D, dots, outlines, timeline component), hardware-based start view.

Open questions for the team: hosting (Vercel works as is; Mateus's `ci/firebase-hosting` assumes a static
`frontend/dist` that Next.js does not produce), license (Apache-2.0 suggested, not applied), pre-event
eligibility of the backend, the root README still describes the frontend as Vite on port 5173.

## Owner decisions on the map (2026-11-14, done)

- Place tree is **World > Country > State > Region of the state**. No continent or
  "Região Sul" level. World: Brazil open, other countries locked. Brazil: RS open, the other
  26 states locked. RS: Taquari Valley open, other regions locked. Names of locked places
  live in `places.ts` (both languages).
- After "Start" the globe **zooms in on Brazil and stays there** (no zoom-out). The world view
  uses one fixed zoom for globe and flat map (`worldZoom`), so the two match in scale.
- **2D <-> 3D** is NOT a fade (owner rejected it): the camera pulls back a little, the projection
  changes while it moves, and the camera closes in on the new view (`morph` in `MapView`). At the
  close-up the plain tilt animation is kept. `crossfade` is used only when the intro hands over to
  the flat map.
- Header: SurfaceSignal logo symbol + name in Poppins Bold. The logo is a plain link to `/<lang>`
  (full reload, like F5). Language is a sliding switch (PT left, EN right, lit side = current
  language); accessibility is a framed button. Frameless buttons were rejected as not looking like buttons.
- "How it works": after the 3rd step the button becomes "Continue" and scrolls to the next section
  (`#layers`); it never loops back to step 1.
- **Timeline** is a stepper: each step compares one pass with the previous pass of the same kind
  (17 steps for the real catalog). Prev/next buttons, a slider and play move through them; the map
  draws the chosen step's change shapes when the backend has them. Steps without an analysis say
  they are not prepared yet. It becomes the story once Mateus publishes real pairs.

## Roadmap

1. **Real data.** The timeline is not useful yet: it only shows catalog passes and one synthetic
   sample. Mateus must run `history run` on a machine with an Earthdata account and ~180 GB free; each of
   the 17 consecutive pairs becomes an analysis served by the API. Then: make the timeline the story
   (what happened when, in plain words), draw each pair's `change-candidates.geojson`, fix the July 11->23
   pair as the anchor, show real numbers (area changed) with `null` handled.
2. **Before/after** slider on the valley, with the 3 layer switches (water / vegetation / slopes status).
3. **Landmarks** ("Centro de Lajeado", the bridge, "Centro de Estrela") and "Onde estou" (centre only).
4. **Accessibility extras:** VLibras (PT), "Ouvir" read-aloud, WhatsApp share.
5. **Explorer:** the 3 availability states (analysis / catalog / no pair) for other regions; 2nd cut in the
   same NISAR pair (Muçum / Roca Sales / Encantado, or Arroio do Meio / Cruzeiro do Sul).
6. **Delivery:** deploy, public repo + license, 7-slide English demo, English submission texts, AI-use
   declaration, FortiGuard classification of the site. Submission closes Sunday 2026-11-15 23:59 (owner's time).
7. **Measure** performance on a real weak phone (the 40 fps threshold in `hardware.ts` is an estimate).
