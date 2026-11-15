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

> **Taking over?** Read [`docs/frontend-handoff.md`](docs/frontend-handoff.md) after this file: current state,
> decisions already made, pitfalls, how to test, and the ordered next tasks (written 2026-11-14 at a hand-off).

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
- The glow around the globe (`setSky` atmosphere) is sequenced, not tied to the projection (owner asked,
  tying it to the zoom curve still looked early): going globe -> map it fades out FIRST (200 ms) and then
  the whole unfold runs; going map -> globe the whole unfold runs with no glow and the glow fades in
  AFTER (450 ms). `fadeGlow` in `MapView`. It is 0 on the flat map.
- The map is created when the browser is idle so the page paints first; the worker file is copied to
  `public/vendor` by `scripts/copy-map-worker.mjs` (not committed).
- Browsers/Windows with "reduce animations" get *gentle* motion, not none; the in-app switch overrides the device.

## Workflow

Git flow: `feature/*` -> `develop` -> `main`, small Conventional Commits, draft PRs, never push to
`develop`/`main` directly. **Ask the owner before any push.** Never commit tokens, `.env*`, HDF5 or
anything private. The backend branch history is owned by Mateus; do not rewrite it. The repo is
public: check what you stage.

## Status (update as you go)

Front-end is about **70%** (owner estimate, 2026-11-14). Draft PR #6 (`feature/frontend-guided-map`) holds the
whole map; it is **map only, no real NISAR results yet**.

Done: scaffold, PT/EN, accessibility panel, data layer with API/static switch, Sudo Nova theme, full-screen
guided map (intro, 2D/3D unfold, dots, outlines, locked places), hardware-based start view, timeline
stepper (17 steps from the real catalog), logo/wordmark/header buttons.

Also done: before/after control and layer switches (`ComparePanel`), on PR #6.

Outside the map (2026-11-14, owner asked): stronger hero ("A cheia do Taquari, vista do espaço", pass at 18h33 BRT,
747 km, 2 h 34 min after the river bulletin; times from `scenes.json` / `analyses.json`), "How it works" in 4 steps
with a drawing whose before/after line can be dragged (pointer + hidden range input for keyboard/screen reader),
sticky section menu (`SectionNav`), new sections 04 "De onde vêm os dados" and 05 "Dúvidas" (FAQ), an
"Em caso de cheia" block (tap-to-call 199/193, SMS 40199) that replaced the small notice, "Ouvir" read-aloud on
every section (`ListenButton`, browser speech, one section at a time), WhatsApp share + copy link
(`ShareButtons`), and "Sobre nós" (header + footer + section menu) linking to the team site (`src/links.ts`).

Owner feedback on that round (2026-11-14, done): the "How it works" drawing is now a large night scene of the valley
(real river, streets, roads and bridges of Lajeado/Estrela from OpenStreetMap, turned so Lajeado is on the left;
regenerate with `frontend/scripts/build-valley-scene.mjs`, see its header; the flooded extent is only an illustration) across the full width, before/after as two stacked SVGs with a CSS
`clip-path` on the "after" one; the 4 steps are a row below it and the chosen step is told in one panel (no long
text column, no empty space). FAQ keeps only: why we made the site, how radar sees through clouds, plans to cover
other regions/countries (yes: that is why the map starts on a globe), who made it. **Emergency numbers are NOT
clickable** (owner: older people could call by accident) and all three cards share one colour. The section menu is
centred on wide screens.

Next round (2026-11-15, done): hero "Onde: Lajeado e região" and the lead mentions the flood's "diversos impactos e
mudanças no planeta". The valley drawing shows, on the "after" side, water entering the low streets (an SVG mask
around the river), houses on real streets hit by the water (amber outline), the bridges over the river white only
over the water and broken after, a landslide on the hillside and a field covered in mud. At step 4 amber pins name
these "possible impacts" (a preview of the globe layers). All of that is an illustration; the caption says so.
The NISAR radar previews the owner showed are NOT in the repo yet: do not use them until they arrive on GitHub.
Next topic agreed with the owner: simulate how the data will look on the globe/map.

Not done (in this order): landmarks and "Onde estou", VLibras, mobile and weak-phone checks,
anything that needs real data. Stepping the timeline does not change the map yet because no step has real shapes:
expected, see the handoff doc.

**Who does what now (owner decision 2026-11-14):** the front-end stays ours until it is 100% and ready
for the real data. Deploy, public repo and licence, submission texts and the 7-slide demo are with the
other team members for now; do not spend time on them unless asked.

Open questions for the team: hosting (Vercel works as is; Mateus's `ci/firebase-hosting` assumes a static
`frontend/dist` that Next.js does not produce), licence (Apache-2.0 suggested, not applied), pre-event
eligibility of the backend, the root README still describes the frontend as Vite on port 5173, and a
**deadline with Mateus** for the real data (see roadmap 1).

## Real data integration (started 2026-11-15)

Mateus's backend MVP (PRs #7 and #9) publishes 17 real comparisons. The static bundle (~142 MB, 68 GeoJSON)
stays OUT of Git: unpack the `.tar.gz` the team shares (check its `.sha256` first) so that its `api/v1/`
folder becomes `frontend/public/data/api/v1/` (git-ignored). The synthetic sample lives in
`public/data/demo/api/v1/` and must NOT be used as an automatic fallback (backend decision).
Plan to follow: the backend team's 10-step integration plan (data/types -> timeline -> general layers ->
statistics and stories -> regional view -> accessibility, performance, deploy).

Done so far: MVP types in `api-types.ts` and `source.ts` functions (overview, timeline, statistics, layers,
story, static `.pt/.en.json` paths). A dev-only **data lab** at `/pt/lab` (404 in production) shows one
comparison at a time on the map with increase/decrease/possible water, the numbers, the PT/EN story, sizes and
timings. Findings: valid area 78.1 km2 in all 17; every comparison has water candidates (2 to 72 groups);
all `not_validated`; general-change.geojson already holds increase + decrease (use one source with two
filtered layers, never fetch the three files); raw sizes 0.6 to 11 MB, but gzip shrinks them about 7x (the
heaviest transfers ~1.5 MB, ~3,800 polygons, ~1.5 s to draw on a desktop); polygons are 10 m pixel blocks,
so they look blocky beyond zoom ~14; fast clicking never showed an old answer (AbortController per pick).
The host must serve GeoJSON compressed. Phone performance not measured yet.

Map wired to real data (2026-11-15): the timeline reads `/areas/{id}/timeline` (backend comparison_id and
group_id, no pairs rebuilt from scenes) and shows a **curated story of 5 comparisons** (owner: more than 3, not all
17), all from the same descending group so geometries never mix: before the flood (29 Jun -> 11 Jul), during
(11 -> 23 Jul, the guided start), after (23 Jul -> 16 Aug), largest signal increase (9 -> 21 Sep) and largest
signal decrease (21 Sep -> 3 Oct). The list lives in `src/data/featured.ts` (matched by dates; "largest" is area,
never severity). Picking one loads statistics + layers + story together (`loadComparisonDetail`, cancelled on
the next pick); the map draws general-change.geojson as two layers filtered by `properties.class` plus the water
candidates, only when the backend lists them as available. ComparePanel: "Mostrar as mudanças" (shows/hides the
patches; the copy says the background map is current, not the earlier date), three layer switches with colour +
symbol + text, backend numbers with null as "indisponível", the PT/EN story with an expandable full explanation,
other layers with their status and limits. Load errors show a plain message and "Tentar de novo" (tested by hiding
the bundle). Not done yet: section 02 "Camadas" still lists the old fixed layers, the regional overview, the
How-it-works impact pins (they promise more than the backend measures; owner to decide), phone checks.

Owner round on the real-data map (2026-11-15, done): (1) **No input during transitions**: `lockInput` in MapView
turns every MapLibre gesture, the custom orbit, the camera buttons and the dots off while the intro, a 2D/3D unfold
or a flight into a place runs, and `onBusyChange` disables 2D/3D and the navigation buttons in MapStage (dragging
mid-flight used to leave the view broken). (2) **Layout like roamingeye.org, in our style**: at the close-up a
compact time bar along the bottom (stop chip with a menu, prev/next, mono dates, play, month ruler with clickable
featured markers), a right panel "O que você quer ver?" and a small left card (raised under the 2D/3D switch; on
phones everything stacks in a scrolling bottom sheet, time bar first). (3) **Plain words first**: the panel opens
with a summary built only from backend numbers (changed km2 and % of the analysed area, possible water) with
football pitches (105 x 68 m) as an everyday size; cards say "Possível água nova", "Refletiu menos o radar (pode
ser água, umidade ou plantas)" and "Refletiu mais o radar", wording taken from the backend's alternative
explanations. The full explanation, other layers and exact numbers/method sit in collapsible sections.
(4) The analysed area (dashed circle) **cannot be changed in the browser**: it is the backend's 5 km buffer and
every result was computed inside it; a new area means new processing by the backend.

Next owner round (2026-11-15, done): (1) the time ruler only draws the 7 passes of the 5 featured comparisons, so
nothing before the first one (29 Jun) or after the last looks reachable. (2) **Layer cards in plain words**:
"Água" (possível água nova), "Ficou mais escuro" and "Ficou mais claro" (the radar's measurement of the ground,
"não é uma foto"), each with "Possível: ..." taken from the backend's own alternative explanations. We did NOT use
"Terra molhada" or "Deslizamento" on purpose: the backend does not detect landslides (ground motion is
unavailable) and a radar decrease/increase does not tell wet from dry, so those words would be invented. The
cards have a sliding switch that pulses a few times plus the line "Toque nos cartões para ligar ou desligar".
(3) The three collapsible sections became one "Saber mais" button that opens a dialog with three tabs
(explanation, other layers, technical details). (4) The header (`.site-header-inner`) widens to the screen edges
when the map has the stage (`html[data-stage="map"]`, set by MapStage). (5) **3D spike fixed**: the free elevation
tiles have wrong points near the Taquari bridge (+257 m next to ~30 m ground at z10, -365 m at z11); tiles go
through `clean-dem.ts` (MapLibre protocol `cleandem://`) which replaces points that differ from the median of
their 5x5 neighbours by more than 120 m, only for zoom 10 to 13, up to 3 passes, and falls back to the original
tile if anything fails. Testing note: a hidden Browser pane freezes map animations and transitions (the map
looks stuck in its intro); show the pane (`show_pane` preview) before judging motion.

Details round (2026-11-15, done): the FAQ answer "Por que fizemos este site?" now states the challenge (show the
changes a satellite sees on a region's surface in a simple way anyone can understand). Cards were renamed again:
"Água", "Sinal mais fraco", "Sinal mais forte" (owner: "mais escuro/claro" made no sense), all with the same
"Possível: água, umidade ou plantas" in the same order, plus the explicit reason we show them ("onde a superfície
mudou entre as duas datas; mostram onde olhar, não dizem se ficou melhor ou pior"). The "tap" emoji is gone, the
"Resultado real · ainda não conferido em campo" note is the LAST thing in the right panel, and the "Real x Exemplo"
box of section 04 was removed (the data is real now). The three info buttons (Entender, Outras camadas, Detalhes
técnicos) live in the left card; their content opens in a box right above the time bar (from 1280 px; below that
it opens inside the left card), see `ComparisonInfo.tsx`. **Water movement**: three thin glint lines
(`river-flow*` layers, a shifting dash pattern, ~12 fps) run down the Taquari inside the analysed circle only,
from `public/data/boundaries/taquari-river.geojson` (OSM, clipped to the circle). It is shown only with full
motion and not on devices measured as weak (`waterMotion` prop).

## Owner decisions on the map (2026-11-14, done)

- Place tree is **World > Country > State > Region of the state**. No continent or
  "Região Sul" level. World: Brazil open, other countries locked. Brazil: RS open, the other
  26 states locked. RS: Taquari Valley open, other regions locked. Names of locked places
  live in `places.ts` (both languages).
- After "Start" the globe **zooms in on Brazil and stays there** (no zoom-out). The world view
  uses one fixed zoom for globe and flat map (`worldZoom`), so the two match in scale.
- **2D <-> 3D** is NOT a fade, and must never zoom out and in again (owner rejected both). At world/
  country/state level it is `unfold` in `MapView`: the projection is tied to the zoom for 1.5 s
  (`interpolate` on `["zoom"]` from `vertical-perspective` to `mercator`), so the globe flattens in
  one continuous half-step of zoom, exactly as it already looks on the way into the valley. For this
  to end on the final view, the flat map sits `UNFOLD_ZOOM` (0.5) closer than the globe and every
  place is framed by one formula (`frameBounds`, not `cameraForBounds`, which differs per projection).
  The intro also ends with `unfold` when the visitor starts in 2D. At the close-up the plain tilt
  animation is kept. `crossfade` remains only for the gentle-motion hand-over.
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

Order agreed with the owner on 2026-11-14. The goal is a front-end that is 100% finished and only waits for
data: every piece below must work with the synthetic sample today and with real analyses later, with no
code change (data comes through `src/data/source.ts`).

1. **Real data (Mateus).** Needs an Earthdata account and a machine with ~180 GB free (`history run`, see
   `docs/real-data-execution.md`). Ask for the **11 Jul -> 23 Jul pair first**: it is enough for the story.
   Agree a deadline with Mateus. If real data does not arrive in time, the project is delivered honestly as
   "map + method + real catalog" with the sample labelled illustrative. When data arrives: check the
   timeline against real analyses, show real numbers (area changed) with `null` handled, make the
   timeline read as a story in plain words.
2. **Before/after on the valley (done, waits for data).** `ComparePanel` at the valley close-up: "Antes" /
   "Depois" buttons and a slider that fade the chosen comparison's change shapes in (0 = map as it was,
   1 = what appeared), plus the 3 layer switches. Only water is interactive (the backend's
   `change-candidates.geojson`); vegetation and slopes are listed with their honest status and a "not
   available yet" note until their data exists. It is a fade of the shapes, not a swipe: a swipe would need
   a second map (heavy on weak phones). Tested with temporary shapes (reverted): the sample file stays empty
   on purpose, and the panel then disables the controls and says why. Not wired yet: the radar previews
   (`before-preview.png` / `after-preview.png`) of each analysis; they are raw grey radar and not
   georeferenced, so decide with the owner whether to show them at all.
3. **Landmarks** ("Centro de Lajeado", the bridge, "Centro de Estrela") and "Onde estou" (centres the map
   only, never sent anywhere).
4. **Accessibility extras:** VLibras (PT). ("Ouvir" read-aloud and WhatsApp share are done.)
5. **Polish and checks:** phone-sized screens, high contrast, English, keyboard and screen reader on the new
   map controls and timeline, a real weak phone (the 40 fps threshold in `hardware.ts` is an estimate),
   the 2D fallback on a weak device.
6. **Explorer (only if time is left):** the 3 availability states (analysis / catalog / no pair) for other
   regions; a 2nd cut in the same NISAR pair (Muçum / Roca Sales / Encantado, or Arroio do Meio /
   Cruzeiro do Sul).
7. **Delivery (others for now):** deploy, public repo + licence, 7-slide English demo, English submission
   texts, AI-use declaration, FortiGuard classification of the site. Submission closes Sunday 2026-11-15
   23:59 (owner's time).

## Backend MVP update — 2026-11-15

Backend 0.2.0 provides general gamma0 changes, independent water candidates, deterministic PT/EN
narratives, capabilities, region history and verified static export. Keep original `artifacts/`
immutable; derivatives live in `data/derived/<analysis>/<derived>/`. Never run derivation or
publication from HTTP. `derive build` and `publish build` are serial offline CLI jobs.
The 19-scene/17-comparison local run is technical evidence, not scientific validation.
The full vector snapshot is distributed outside Git; preserve the isolated synthetic demo.
Read docs/backend-mvp.md and docs/static-publication.md for handoff. Existing frontend visual
components remain unchanged; general-layer rendering is a separate frontend integration task.

## Backend local analysis and preparation — 2026-11-15

Backend-only feature branch `feature/local-analysis-preparation-plans` adds offline
`preparation build|verify`, immutable `data/preparation/<area>/<report>/` outputs,
PT/EN local evidence and proposed plans for residents/municipal teams, two additive
GET routes and opt-in `publish build --include-preparation`. No frontend changes.
Real data is the default; `--illustrative` selects synthetic analyses only. Local
GeoJSON context is optional and requires provenance. Without it, report unavailable
context and generic sourced guidance; never invent named facilities or affected people.
Negative intersections stay unknown because no valid-coverage vector footprint is
available. Plans require human review and do not establish current conditions,
confirmed impacts, prediction or official instructions. Keep all writers serial,
old reports immutable and original artifacts unchanged. Read
`docs/local-analysis-preparation.md` for budgets, source review and handoff.
